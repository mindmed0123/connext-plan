// Alias do webhook Cakto: /functions/v1/webhook (URL mais curta para colar no painel)
// Mesmo comportamento de cakto-webhook. Mantemos um arquivo separado por ser uma
// edge function diferente, mas a lógica é idêntica.
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
  if (req.method === "GET" || req.method === "HEAD") {
    return ok({ ok: true, service: "webhook" });
  }
  if (req.method !== "POST") return ok({ error: "method_not_allowed" }, 405);

  const raw = await req.text();
  let event: any = {};
  try { event = raw ? JSON.parse(raw) : {}; } catch { return ok({ error: "invalid_json" }, 400); }

  const url = new URL(req.url);
  const tokenQuery = url.searchParams.get("token") ?? url.searchParams.get("secret") ?? "";
  const headerSig = req.headers.get("x-cakto-signature")
    ?? req.headers.get("x-webhook-secret")
    ?? req.headers.get("x-cakto-secret")
    ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
    ?? "";
  const bodySecret =
    event?.secret ?? event?.fields?.secret ?? event?.data?.secret ?? event?.webhook?.secret ?? "";
  const provided = (bodySecret || headerSig || tokenQuery || "").toString().trim();

  if (CAKTO_WEBHOOK_SECRET && provided !== CAKTO_WEBHOOK_SECRET) {
    console.warn("Cakto webhook (alias): secret inválido");
    return ok({ error: "unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const eventType: string = event?.event ?? event?.event_id ?? event?.type ?? event?.event_type ?? "unknown";
  const eventId: string = event?.id ?? event?.event_log_id ?? event?.data?.id ?? crypto.randomUUID();
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

  const metadata: any =
    data?.metadata ?? data?.subscription?.metadata ?? data?.checkout?.metadata ?? data?.order?.metadata ?? {};
  let empresa_id: string | null = metadata?.empresa_id ?? null;
  let plano_id: string | null = metadata?.plano_id ?? null;
  let periodo: string | null = metadata?.periodo ?? null;

  let refRaw: string | null =
    data?.ref ?? data?.utm?.ref ?? metadata?.ref ?? data?.checkout?.ref ?? data?.tracking?.ref ?? null;
  if (!refRaw) {
    const checkoutUrl: string | null = data?.checkoutUrl ?? data?.checkout_url ?? data?.checkout?.url ?? null;
    if (checkoutUrl && typeof checkoutUrl === "string") {
      try { const u = new URL(checkoutUrl); const r = u.searchParams.get("ref"); if (r) refRaw = r; } catch { /* ignore */ }
    }
  }
  if (refRaw && typeof refRaw === "string" && refRaw.includes("|")) {
    const [r_empresa, r_plano, r_periodo] = refRaw.split("|");
    empresa_id = empresa_id ?? r_empresa ?? null;
    plano_id = plano_id ?? r_plano ?? null;
    periodo = periodo ?? r_periodo ?? null;
  }
  if (!periodo) {
    const recPeriod = Number(data?.subscription?.recurrence_period ?? 0);
    if (recPeriod >= 350) periodo = "anual";
    else if (recPeriod > 0) periodo = "mensal";
  }

  if (!plano_id && productId) {
    const { data: planoMatch } = await supabase
      .from("planos")
      .select("id, cakto_product_id_mensal, cakto_product_id_anual")
      .or(`cakto_product_id_mensal.eq.${productId},cakto_product_id_anual.eq.${productId}`)
      .maybeSingle();
    if (planoMatch) {
      plano_id = (planoMatch as any).id;
      if (!periodo) periodo = (planoMatch as any).cakto_product_id_anual === productId ? "anual" : "mensal";
    }
  }

  await supabase.from("billing_events").upsert({
    event_id: String(eventId), event_type: String(eventType),
    empresa_id, cakto_subscription_id: subscriptionId, payload: event,
  }, { onConflict: "event_id" });

  const evt = String(eventType).toLowerCase();
  const updates: Record<string, any> = {};
  const setActive = () => {
    updates.status = "active";
    updates.current_period_start = new Date().toISOString();
    updates.current_period_end = new Date(Date.now() + ((periodo === "anual" ? 365 : 30) * 86400000)).toISOString();
    updates.cancel_at_period_end = false;
  };
  switch (evt) {
    case "purchase_approved": case "subscription_created": case "subscription_renewed":
    case "subscription.activated": case "payment.approved": case "payment.completed":
      setActive(); break;
    case "purchase_refused": case "payment.failed": case "payment.refused": case "subscription_renewal_refused":
      updates.status = "past_due"; break;
    case "subscription_canceled": case "subscription.canceled": case "subscription.cancelled":
    case "refund": case "chargeback":
      updates.status = "canceled"; updates.canceled_at = new Date().toISOString(); break;
    case "subscription.expired":
      updates.status = "expired"; break;
    default: {
      const s = (data?.status ?? data?.subscription?.status ?? "").toString().toLowerCase();
      if (["active","ativo","paid","approved"].includes(s)) setActive();
      else if (["past_due","overdue","atrasado"].includes(s)) updates.status = "past_due";
      else if (["canceled","cancelled","cancelado"].includes(s)) updates.status = "canceled";
      else if (["expired","expirado"].includes(s)) updates.status = "expired";
    }
  }
  if (subscriptionId) updates.cakto_subscription_id = subscriptionId;
  if (customerId) updates.cakto_customer_id = customerId;
  if (plano_id) updates.plano_id = plano_id;
  if (periodo === "mensal" || periodo === "anual") updates.periodo = periodo;

  if (Object.keys(updates).length > 0) {
    let target: { id: string; empresa_id: string } | null = null;
    if (subscriptionId) {
      const { data: existing } = await supabase.from("assinaturas")
        .select("id, empresa_id").eq("cakto_subscription_id", subscriptionId).maybeSingle();
      target = existing as any;
    }
    if (!target && empresa_id) {
      const { data: existing } = await supabase.from("assinaturas")
        .select("id, empresa_id").eq("empresa_id", empresa_id).maybeSingle();
      target = existing as any;
    }
    if (!target && customerEmail) {
      const { data: pessoa } = await supabase.from("pessoas")
        .select("empresa_id").ilike("email", customerEmail).maybeSingle();
      const emp = (pessoa as any)?.empresa_id;
      if (emp) {
        const { data: existing } = await supabase.from("assinaturas")
          .select("id, empresa_id").eq("empresa_id", emp).maybeSingle();
        target = existing as any;
      }
    }
    if (target) {
      await supabase.from("assinaturas").update(updates).eq("id", target.id);
      empresa_id = empresa_id ?? target.empresa_id;
    } else {
      console.warn("Webhook (alias): assinatura não encontrada", { subscriptionId, empresa_id, customerEmail, eventType });
    }
  }

  await supabase.from("billing_events")
    .update({ processed_at: new Date().toISOString(), empresa_id })
    .eq("event_id", String(eventId));

  // Dispara e-mail (best-effort)
  try {
    const emailEvent = (() => {
      if (["purchase_approved","subscription_created","subscription_renewed","payment.approved","payment.completed"].includes(evt)) return "billing_payment_approved";
      if (["purchase_refused","subscription_renewal_refused","payment.failed","payment.refused"].includes(evt)) return "billing_payment_failed";
      if (["subscription_canceled","subscription.canceled","subscription.cancelled","refund","chargeback"].includes(evt)) return "billing_subscription_canceled";
      return null;
    })();
    if (emailEvent && (customerEmail || empresa_id)) {
      let toEmail = customerEmail;
      if (!toEmail && empresa_id) {
        const { data: admin } = await supabase.from("pessoas")
          .select("email").eq("empresa_id", empresa_id).not("email", "is", null).limit(1).maybeSingle();
        toEmail = (admin as any)?.email ?? null;
      }
      if (toEmail) {
        await supabase.functions.invoke("billing-email", {
          body: { to: toEmail, event: emailEvent, empresa_id, payload: { eventType, data } },
        }).catch((e) => console.warn("billing-email invoke failed", e));
      }
    }
  } catch (e) { console.warn("erro ao disparar e-mail", e); }

  return ok({ ok: true, event: eventType, processed: true });
});
