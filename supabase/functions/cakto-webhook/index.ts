// Webhook da Cakto: recebe eventos de assinatura e pagamento
// URL recomendada (limpa, sem query): https://<project>.supabase.co/functions/v1/cakto-webhook
// Aceita GET (healthcheck para validação de URL no painel Cakto) e POST (eventos).
// Autenticação: a Cakto envia o `secret` configurado no webhook dentro do PAYLOAD
// (campo `secret` ou `fields.secret`). Também aceitamos via header/query como fallback.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cakto-signature, x-webhook-secret, x-cakto-secret",
};

const CAKTO_WEBHOOK_SECRET = Deno.env.get("CAKTO_WEBHOOK_SECRET") ?? "";

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Healthcheck: a Cakto valida a URL antes de salvar.
  if (req.method === "GET" || req.method === "HEAD") {
    return ok({ ok: true, service: "cakto-webhook" });
  }

  if (req.method !== "POST") {
    return ok({ error: "method_not_allowed" }, 405);
  }

  const raw = await req.text();
  let event: any = {};
  try {
    event = raw ? JSON.parse(raw) : {};
  } catch {
    return ok({ error: "invalid_json" }, 400);
  }

  // --- Autenticação: aceita secret via body, header ou query ---
  const url = new URL(req.url);
  const tokenQuery = url.searchParams.get("token") ?? url.searchParams.get("secret") ?? "";
  const headerSig = req.headers.get("x-cakto-signature")
    ?? req.headers.get("x-webhook-secret")
    ?? req.headers.get("x-cakto-secret")
    ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
    ?? "";
  const bodySecret =
    event?.secret ??
    event?.fields?.secret ??
    event?.data?.secret ??
    event?.webhook?.secret ??
    "";
  const provided = (bodySecret || headerSig || tokenQuery || "").toString().trim();

  if (CAKTO_WEBHOOK_SECRET && provided !== CAKTO_WEBHOOK_SECRET) {
    console.warn("Cakto webhook: secret inválido", {
      hasBody: !!bodySecret,
      hasHeader: !!headerSig,
      hasQuery: !!tokenQuery,
      providedLen: provided.length,
      expectedLen: CAKTO_WEBHOOK_SECRET.length,
      providedPrefix: provided.slice(0, 4),
      expectedPrefix: CAKTO_WEBHOOK_SECRET.slice(0, 4),
      topLevelKeys: Object.keys(event ?? {}),
      dataKeys: event?.data ? Object.keys(event.data) : [],
    });
    return ok({ error: "unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Cakto envia: { event, data, secret } com event = custom_id (ex: purchase_approved)
  const eventType: string =
    event?.event ?? event?.event_id ?? event?.type ?? event?.event_type ?? "unknown";
  const eventId: string =
    event?.id ?? event?.event_log_id ?? event?.data?.id ?? crypto.randomUUID();
  const data: any = event?.data ?? event;

  const subscriptionId: string | null =
    data?.subscription_id ?? data?.subscription?.id ?? data?.assinatura_id ?? null;
  const customerId: string | null =
    data?.customer_id ?? data?.customer?.id ?? data?.client?.id ?? null;
  const customerEmail: string | null = (
    data?.customer?.email ?? data?.customer_email ?? data?.client?.email ?? data?.email ?? null
  )?.toLowerCase?.() ?? null;
  const productId: string | null =
    data?.product?.id ?? data?.product_id ?? data?.offer?.product?.id ?? null;
  const orderId: string | null =
    data?.order?.id ?? data?.order_id ?? data?.transaction_id ?? null;

  // metadata pode vir em vários locais
  const metadata: any =
    data?.metadata ?? data?.subscription?.metadata ?? data?.checkout?.metadata ?? data?.order?.metadata ?? {};
  let empresa_id: string | null = metadata?.empresa_id ?? null;
  let plano_id: string | null = metadata?.plano_id ?? null;
  let periodo: string | null = metadata?.periodo ?? null;
  let user_id: string | null = metadata?.user_id ?? null;

  // Fallback: parametro `ref` que enviamos no link de checkout
  // Formato: empresa_id|plano_id|periodo|user_id
  // A Cakto pode devolver o ref em data.ref OU embutido em data.checkoutUrl como query string.
  let refRaw: string | null =
    data?.ref ?? data?.utm?.ref ?? metadata?.ref ??
    data?.checkout?.ref ?? data?.tracking?.ref ?? null;
  if (!refRaw) {
    const checkoutUrl: string | null =
      data?.checkoutUrl ?? data?.checkout_url ?? data?.checkout?.url ?? null;
    if (checkoutUrl && typeof checkoutUrl === "string") {
      try {
        const u = new URL(checkoutUrl);
        const r = u.searchParams.get("ref");
        if (r) refRaw = r;
      } catch { /* ignore */ }
    }
  }
  if (refRaw && typeof refRaw === "string" && refRaw.includes("|")) {
    const [r_empresa, r_plano, r_periodo, r_user] = refRaw.split("|");
    empresa_id = empresa_id ?? r_empresa ?? null;
    plano_id = plano_id ?? r_plano ?? null;
    periodo = periodo ?? r_periodo ?? null;
    user_id = user_id ?? r_user ?? null;
  }

  // Fallback: localizar plano pelo product_id da Cakto
  if (!plano_id && productId) {
    const { data: planoMatch } = await supabase
      .from("planos")
      .select("id, slug, cakto_product_id_mensal, cakto_product_id_anual")
      .or(`cakto_product_id_mensal.eq.${productId},cakto_product_id_anual.eq.${productId}`)
      .maybeSingle();
    if (planoMatch) {
      plano_id = (planoMatch as any).id;
      if (!periodo) {
        periodo = (planoMatch as any).cakto_product_id_anual === productId ? "anual" : "mensal";
      }
    }
  }

  // Fallback: detecta período pelo recurrence_period da assinatura Cakto (>=350 dias = anual)
  if (!periodo) {
    const recPeriod = Number(data?.subscription?.recurrence_period ?? 0);
    if (recPeriod >= 350) periodo = "anual";
    else if (recPeriod > 0) periodo = "mensal";
  }
  // Idempotência por event_id
  await supabase.from("billing_events").upsert({
    event_id: String(eventId),
    event_type: String(eventType),
    empresa_id,
    cakto_subscription_id: subscriptionId,
    payload: event,
  }, { onConflict: "event_id" });

  // Mapeamento Cakto -> nosso enum (custom_id oficial da Cakto)
  const evt = String(eventType).toLowerCase();
  const updates: Record<string, any> = {};

  const setActive = () => {
    updates.status = "active";
    updates.current_period_start = new Date().toISOString();
    updates.current_period_end = new Date(
      Date.now() + ((periodo === "anual" ? 365 : 30) * 86400000)
    ).toISOString();
    updates.cancel_at_period_end = false;
  };

  switch (evt) {
    case "purchase_approved":
    case "subscription_created":
    case "subscription_renewed":
    case "subscription.activated":
    case "payment.approved":
    case "payment.completed":
      setActive();
      break;
    case "purchase_refused":
    case "payment.failed":
    case "payment.refused":
    case "subscription_renewal_refused":
      updates.status = "past_due";
      break;
    case "subscription_canceled":
    case "subscription.canceled":
    case "subscription.cancelled":
      updates.status = "canceled";
      updates.canceled_at = new Date().toISOString();
      break;
    case "refund":
    case "chargeback":
      updates.status = "canceled";
      updates.canceled_at = new Date().toISOString();
      break;
    case "subscription.expired":
      updates.status = "expired";
      break;
    default: {
      // tenta mapear status genérico se vier no payload
      const s = (data?.status ?? data?.subscription?.status ?? "").toString().toLowerCase();
      if (["active", "ativo", "paid", "approved"].includes(s)) setActive();
      else if (["past_due", "overdue", "atrasado"].includes(s)) updates.status = "past_due";
      else if (["canceled", "cancelled", "cancelado"].includes(s)) updates.status = "canceled";
      else if (["expired", "expirado"].includes(s)) updates.status = "expired";
    }
  }

  if (subscriptionId) updates.cakto_subscription_id = subscriptionId;
  if (customerId) updates.cakto_customer_id = customerId;
  if (plano_id) updates.plano_id = plano_id;
  if (periodo === "mensal" || periodo === "anual") updates.periodo = periodo;

  if (Object.keys(updates).length > 0) {
    let target: { id: string; empresa_id: string } | null = null;
    if (subscriptionId) {
      const { data: existing } = await supabase
        .from("assinaturas")
        .select("id, empresa_id")
        .eq("cakto_subscription_id", subscriptionId)
        .maybeSingle();
      target = existing as any;
    }
    if (!target && empresa_id) {
      const { data: existing } = await supabase
        .from("assinaturas")
        .select("id, empresa_id")
        .eq("empresa_id", empresa_id)
        .maybeSingle();
      target = existing as any;
    }
    // Fallback: localizar empresa pelo email do cliente (pessoas OU admin via auth.users)
    if (!target && customerEmail) {
      let emp: string | null = null;
      const { data: pessoa } = await supabase
        .from("pessoas").select("empresa_id").ilike("email", customerEmail).maybeSingle();
      emp = (pessoa as any)?.empresa_id ?? null;
      if (!emp) {
        // procura admin/owner pelo auth.users.email -> user_roles.empresa_id
        const { data: usr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
        const u = (usr?.users ?? []).find((x: any) => (x.email ?? "").toLowerCase() === customerEmail);
        if (u) {
          const { data: ur } = await supabase
            .from("user_roles").select("empresa_id")
            .eq("user_id", u.id).not("empresa_id", "is", null).maybeSingle();
          emp = (ur as any)?.empresa_id ?? null;
        }
      }
      if (emp) {
        const { data: existing } = await supabase
          .from("assinaturas").select("id, empresa_id").eq("empresa_id", emp).maybeSingle();
        target = existing as any;
      }
    }
    if (target) {
      await supabase.from("assinaturas").update(updates).eq("id", target.id);
      empresa_id = empresa_id ?? target.empresa_id;
    } else {
      console.warn("Cakto webhook: assinatura não encontrada", {
        subscriptionId, empresa_id, customerEmail, eventType, productId, orderId,
      });
    }
  }

  // Marca evento como processado
  await supabase.from("billing_events")
    .update({ processed_at: new Date().toISOString(), empresa_id })
    .eq("event_id", String(eventId));

  // Dispara e-mail transacional (best-effort) para eventos relevantes
  try {
    const templateName = (() => {
      if (["purchase_approved", "subscription_created", "subscription_renewed", "payment.approved", "payment.completed"].includes(evt))
        return "payment-approved";
      if (["purchase_refused", "subscription_renewal_refused", "payment.failed", "payment.refused"].includes(evt))
        return "payment-failed";
      if (["subscription_canceled", "subscription.canceled", "subscription.cancelled", "refund", "chargeback"].includes(evt))
        return "subscription-canceled";
      return null;
    })();

    if (templateName && (customerEmail || empresa_id)) {
      let toEmail = customerEmail;
      let toName: string | null = (data?.customer?.name ?? data?.client?.name ?? null);
      if (!toEmail && empresa_id) {
        const { data: admin } = await supabase
          .from("pessoas")
          .select("email,nome")
          .eq("empresa_id", empresa_id)
          .not("email", "is", null)
          .limit(1)
          .maybeSingle();
        toEmail = (admin as any)?.email ?? null;
        toName = toName ?? (admin as any)?.nome ?? null;
      }
      if (toEmail) {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName,
            recipientEmail: toEmail,
            idempotencyKey: `cakto-${eventId}-${templateName}`,
            templateData: { name: toName ?? undefined },
          },
        }).catch((e) => console.warn("send-transactional-email invoke failed", e));
      }
    }
  } catch (e) {
    console.warn("erro ao disparar e-mail", e);
  }

  return ok({ ok: true, event: eventType, processed: true });
});
