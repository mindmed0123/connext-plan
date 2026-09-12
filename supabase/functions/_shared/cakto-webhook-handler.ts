// Lógica única do webhook da Cakto, compartilhada pelas funções `cakto-webhook` e `webhook`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cakto-signature, x-webhook-secret, x-cakto-secret",
};

// Refs no formato antigo "empresa|plano|periodo|user" só são aceitos (apenas para
// identificar a EMPRESA) até esta data. Depois disso, apenas checkout_intents.
const LEGACY_REF_DEADLINE = new Date("2026-10-11T23:59:59Z");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
type Any = any;

export async function handleCaktoWebhook(req: Request, serviceName: string): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET" || req.method === "HEAD") return ok({ ok: true, service: serviceName });
  if (req.method !== "POST") return ok({ error: "method_not_allowed" }, 405);

  const raw = await req.text();
  let event: Any = {};
  try {
    event = raw ? JSON.parse(raw) : {};
  } catch {
    return ok({ error: "invalid_json" }, 400);
  }

  // --- Autenticação: secret via body, header ou query ---
  const CAKTO_WEBHOOK_SECRET = Deno.env.get("CAKTO_WEBHOOK_SECRET") ?? "";
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

  if (!CAKTO_WEBHOOK_SECRET) {
    console.error(`${serviceName}: CAKTO_WEBHOOK_SECRET não configurado`);
    return ok({ error: "webhook não configurado" }, 500);
  }
  if (!timingSafeEqual(provided, CAKTO_WEBHOOK_SECRET)) {
    console.warn(`${serviceName}: secret inválido`, {
      hasBody: !!bodySecret,
      hasHeader: !!headerSig,
      hasQuery: !!tokenQuery,
    });
    return ok({ error: "unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const eventType: string = event?.event ?? event?.event_id ?? event?.type ?? event?.event_type ?? "unknown";
  const eventId: string = event?.id ?? event?.event_log_id ?? event?.data?.id ?? crypto.randomUUID();
  const data: Any = event?.data ?? event;

  const subscriptionId: string | null =
    data?.subscription_id ?? data?.subscription?.id ?? data?.assinatura_id ?? null;
  const customerId: string | null =
    data?.customer_id ?? data?.customer?.id ?? data?.client?.id ?? null;
  const customerEmail: string | null = (
    data?.customer?.email ?? data?.customer_email ?? data?.client?.email ?? data?.email ?? null
  )?.toLowerCase?.()?.trim?.() ?? null;
  const productId: string | null =
    data?.product?.id ?? data?.product_id ?? data?.offer?.product?.id ?? null;
  const orderId: string | null = data?.order?.id ?? data?.order_id ?? data?.transaction_id ?? null;

  const rawAmount =
    data?.amount ?? data?.paid_amount ?? data?.total ?? data?.value ??
    data?.order?.amount ?? data?.offer?.price ?? null;
  const paidAmount = rawAmount == null ? null : Number(rawAmount);

  const registrarAlerta = async (tipo: string, detalhe: Record<string, unknown>) => {
    await supabase.from("billing_events").insert({
      event_id: `${eventId}-${tipo}`,
      event_type: tipo,
      cakto_subscription_id: subscriptionId,
      payload: { origem: serviceName, evento: eventType, detalhe },
    });
  };

  // --- ref (checkout_intent) ---
  const metadata: Any =
    data?.metadata ?? data?.subscription?.metadata ?? data?.checkout?.metadata ?? data?.order?.metadata ?? {};
  let refRaw: string | null =
    data?.ref ?? data?.utm?.ref ?? metadata?.ref ?? data?.checkout?.ref ?? data?.tracking?.ref ?? null;
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

  let empresa_id: string | null = null;
  let plano_id: string | null = null;
  let periodo: string | null = null;

  const RENEWAL_EVENTS = ["subscription_renewed", "payment.approved", "payment.completed"];
  // Só uma ativação consome o checkout_intent (pix gerado / recusa NÃO consomem)
  const ACTIVATION_EVENTS = [
    "purchase_approved", "subscription_created", "subscription.activated",
    ...RENEWAL_EVENTS,
  ];
  const evtLower = String(eventType).toLowerCase();
  const ehAtivacao = ACTIVATION_EVENTS.includes(evtLower);
  let intentBloqueado = false;

  if (refRaw && typeof refRaw === "string") {
    const refTrim = refRaw.trim();
    if (UUID_RE.test(refTrim)) {
      const { data: intent } = await supabase
        .from("checkout_intents")
        .select("id, empresa_id, usado_em")
        .eq("id", refTrim)
        .maybeSingle();
      if (intent) {
        const jaUsado = !!(intent as Any).usado_em;
        if (!jaUsado) {
          empresa_id = (intent as Any).empresa_id;
          if (ehAtivacao) {
            await supabase.from("checkout_intents")
              .update({ usado_em: new Date().toISOString() })
              .eq("id", refTrim);
          }
        } else {
          // Intent já usado: só vale para renovação da MESMA assinatura
          let renovacaoValida = false;
          if (subscriptionId) {
            const { data: assin } = await supabase
              .from("assinaturas")
              .select("empresa_id, cakto_subscription_id")
              .eq("empresa_id", (intent as Any).empresa_id)
              .maybeSingle();
            renovacaoValida =
              (assin as Any)?.cakto_subscription_id === subscriptionId &&
              RENEWAL_EVENTS.includes(evtLower);
          }
          if (renovacaoValida) {
            empresa_id = (intent as Any).empresa_id;
          } else {
            intentBloqueado = true;
            await registrarAlerta("checkout_intent_reutilizado", {
              intent_id: refTrim, subscriptionId, orderId,
            });
          }
        }
      }
    } else if (refTrim.includes("|") && new Date() <= LEGACY_REF_DEADLINE) {

      // Formato antigo: usa APENAS a empresa, ignora plano/período. Expira em 11/10/2026.
      const legacyEmpresa = refTrim.split("|")[0];
      if (UUID_RE.test(legacyEmpresa)) empresa_id = legacyEmpresa;
    }
  }

  // Plano e período vêm SEMPRE do product_id da Cakto
  let planoRow: Any = null;
  if (productId) {
    const { data: planoMatch } = await supabase
      .from("planos")
      .select("id, slug, preco_mensal, preco_anual, cakto_product_id_mensal, cakto_product_id_anual")
      .or(`cakto_product_id_mensal.eq.${productId},cakto_product_id_anual.eq.${productId}`)
      .maybeSingle();
    if (planoMatch) {
      planoRow = planoMatch;
      plano_id = planoMatch.id;
      periodo = planoMatch.cakto_product_id_anual === productId ? "anual" : "mensal";
    }
  }

  await supabase.from("billing_events").upsert({
    event_id: String(eventId),
    event_type: String(eventType),
    empresa_id,
    cakto_subscription_id: subscriptionId,
    payload: event,
  }, { onConflict: "event_id" });

  const evt = String(eventType).toLowerCase();
  const updates: Record<string, Any> = {};

  const ACTIVATION_EVENTS = [
    "purchase_approved", "subscription_created", "subscription_renewed",
    "subscription.activated", "payment.approved", "payment.completed",
  ];
  const genericStatus = (data?.status ?? data?.subscription?.status ?? "").toString().toLowerCase();
  const isActivation = ACTIVATION_EVENTS.includes(evt) ||
    ["active", "ativo", "paid", "approved"].includes(genericStatus);

  const encerrar = async (reason: string) => {
    await supabase.from("billing_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("event_id", String(eventId));
    return ok({ ok: true, event: eventType, processed: false, reason });
  };

  if (isActivation) {
    if (!planoRow) {
      console.warn(`${serviceName}: product_id sem plano correspondente`, { productId, eventType });
      await registrarAlerta("produto_desconhecido", { productId, orderId });
      return await encerrar("plano_nao_identificado");
    }
    const precoEsperado = Number(periodo === "anual" ? planoRow.preco_anual : planoRow.preco_mensal) || 0;
    if (paidAmount != null && Number.isFinite(paidAmount) && precoEsperado > 0 &&
        paidAmount < precoEsperado * 0.5) {
      console.warn(`${serviceName}: valor pago incompatível`, { paidAmount, precoEsperado, productId });
      await registrarAlerta("valor_incompativel", { paidAmount, precoEsperado, productId, orderId });
      return await encerrar("valor_incompativel");
    }
  }

  const setActive = () => {
    updates.status = "active";
    updates.current_period_start = new Date().toISOString();
    updates.current_period_end = new Date(
      Date.now() + ((periodo === "anual" ? 365 : 30) * 86400000),
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
    case "refund":
    case "chargeback":
      updates.status = "canceled";
      updates.canceled_at = new Date().toISOString();
      break;
    case "subscription.expired":
      updates.status = "expired";
      break;
    default: {
      if (["active", "ativo", "paid", "approved"].includes(genericStatus)) setActive();
      else if (["past_due", "overdue", "atrasado"].includes(genericStatus)) updates.status = "past_due";
      else if (["canceled", "cancelled", "cancelado"].includes(genericStatus)) updates.status = "canceled";
      else if (["expired", "expirado"].includes(genericStatus)) updates.status = "expired";
    }
  }

  if (customerId) updates.cakto_customer_id = customerId;
  if (plano_id) updates.plano_id = plano_id;
  if (periodo === "mensal" || periodo === "anual") updates.periodo = periodo;

  if (Object.keys(updates).length > 0) {
    let target: { id: string; empresa_id: string; status?: string; cakto_subscription_id?: string | null } | null = null;

    if (subscriptionId) {
      const { data: existing } = await supabase
        .from("assinaturas")
        .select("id, empresa_id, status, cakto_subscription_id")
        .eq("cakto_subscription_id", subscriptionId)
        .maybeSingle();
      target = existing as Any;
    }
    if (!target && empresa_id) {
      const { data: existing } = await supabase
        .from("assinaturas")
        .select("id, empresa_id, status, cakto_subscription_id")
        .eq("empresa_id", empresa_id)
        .maybeSingle();
      target = existing as Any;
    }
    // Fallback por e-mail: comparação exata em minúsculas, sem curingas
    if (!target && customerEmail) {
      let emp: string | null = null;
      const { data: pessoasMatch } = await supabase
        .from("pessoas")
        .select("empresa_id, email")
        .eq("email", customerEmail);
      const empresasPessoa = Array.from(
        new Set(((pessoasMatch ?? []) as Any[])
          .filter((p) => (p.email ?? "").toLowerCase().trim() === customerEmail)
          .map((p) => p.empresa_id)),
      );
      if (empresasPessoa.length > 1) {
        await registrarAlerta("email_em_multiplas_empresas", {
          email: customerEmail, empresas: empresasPessoa,
        });
        return await encerrar("email_ambiguo");
      }
      emp = empresasPessoa[0] ?? null;

      if (!emp) {
        const { data: usr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
        const u = (usr?.users ?? []).find((x: Any) => (x.email ?? "").toLowerCase().trim() === customerEmail);
        if (u) {
          const { data: ur } = await supabase
            .from("user_roles").select("empresa_id")
            .eq("user_id", u.id).not("empresa_id", "is", null);
          const empresasRole = Array.from(new Set(((ur ?? []) as Any[]).map((r) => r.empresa_id)));
          if (empresasRole.length > 1) {
            await registrarAlerta("email_em_multiplas_empresas", {
              email: customerEmail, empresas: empresasRole,
            });
            return await encerrar("email_ambiguo");
          }
          emp = empresasRole[0] ?? null;
        }
      }
      if (emp) {
        const { data: existing } = await supabase
          .from("assinaturas")
          .select("id, empresa_id, status, cakto_subscription_id")
          .eq("empresa_id", emp)
          .maybeSingle();
        target = existing as Any;
      }
    }

    if (target) {
      // Nunca troca o id de assinatura de uma assinatura ativa sem registrar o caso
      if (subscriptionId) {
        const atual = target.cakto_subscription_id ?? null;
        if (!atual) {
          updates.cakto_subscription_id = subscriptionId;
        } else if (atual !== subscriptionId) {
          await registrarAlerta("troca_de_assinatura_cakto", {
            assinatura_id: target.id, empresa_id: target.empresa_id,
            atual, recebido: subscriptionId, status: target.status,
          });
          if (target.status !== "active") updates.cakto_subscription_id = subscriptionId;
        }
      }
      await supabase.from("assinaturas").update(updates).eq("id", target.id);
      empresa_id = empresa_id ?? target.empresa_id;
    } else {
      console.warn(`${serviceName}: assinatura não encontrada`, {
        subscriptionId, empresa_id, eventType, productId, orderId,
      });
    }
  }

  await supabase.from("billing_events")
    .update({ processed_at: new Date().toISOString(), empresa_id })
    .eq("event_id", String(eventId));

  // E-mail transacional (best-effort)
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
          .from("pessoas").select("email,nome").eq("empresa_id", empresa_id)
          .not("email", "is", null).limit(1).maybeSingle();
        toEmail = (admin as Any)?.email ?? null;
        toName = toName ?? (admin as Any)?.nome ?? null;
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
}
