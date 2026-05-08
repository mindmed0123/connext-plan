// Alias simples para webhook da Cakto: /functions/v1/webhook
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cakto-signature, x-webhook-secret",
};

const CAKTO_WEBHOOK_SECRET = Deno.env.get("CAKTO_WEBHOOK_SECRET") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (CAKTO_WEBHOOK_SECRET) {
    const url = new URL(req.url);
    const tokenQuery = url.searchParams.get("token") ?? url.searchParams.get("secret") ?? url.searchParams.get("key") ?? "";
    const sig = req.headers.get("x-cakto-signature")
      ?? req.headers.get("x-webhook-secret")
      ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
      ?? tokenQuery
      ?? "";
    if (sig !== CAKTO_WEBHOOK_SECRET) {
      console.warn("Cakto webhook: assinatura inválida");
      return new Response("unauthorized", { status: 401, headers: corsHeaders });
    }
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const raw = await req.text();
  let event: any;
  try { event = JSON.parse(raw); } catch {
    return new Response("invalid json", { status: 400, headers: corsHeaders });
  }

  const eventType: string = event?.event ?? event?.type ?? event?.event_type ?? "unknown";
  const eventId: string = event?.id ?? event?.event_id ?? crypto.randomUUID();
  const data: any = event?.data ?? event;

  const subscriptionId: string | null =
    data?.subscription_id ?? data?.subscription?.id ?? data?.id ?? null;
  const customerId: string | null =
    data?.customer_id ?? data?.customer?.id ?? null;
  const customerEmail: string | null = (
    data?.customer?.email ?? data?.customer_email ?? data?.email ?? null
  )?.toLowerCase?.() ?? null;

  const metadata: any =
    data?.metadata ?? data?.subscription?.metadata ?? data?.checkout?.metadata ?? {};
  let empresa_id: string | null = metadata?.empresa_id ?? null;
  let plano_id: string | null = metadata?.plano_id ?? null;
  let periodo: string | null = metadata?.periodo ?? null;
  let user_id: string | null = metadata?.user_id ?? null;

  const refRaw: string | null =
    data?.ref ?? data?.utm?.ref ?? metadata?.ref
    ?? data?.checkout?.ref ?? data?.tracking?.ref ?? null;
  if (refRaw && typeof refRaw === "string" && refRaw.includes("|")) {
    const [r_empresa, r_plano, r_periodo, r_user] = refRaw.split("|");
    empresa_id = empresa_id ?? r_empresa ?? null;
    plano_id = plano_id ?? r_plano ?? null;
    periodo = periodo ?? r_periodo ?? null;
    user_id = user_id ?? r_user ?? null;
  }

  await supabase.from("billing_events").upsert({
    event_id: eventId,
    event_type: eventType,
    empresa_id,
    cakto_subscription_id: subscriptionId,
    payload: event,
  }, { onConflict: "event_id" });

  const mapStatus = (s?: string): string | null => {
    const v = (s ?? "").toLowerCase();
    if (["active", "ativo", "paid", "approved", "completed"].includes(v)) return "active";
    if (["trialing", "trial"].includes(v)) return "trialing";
    if (["past_due", "overdue", "atrasado"].includes(v)) return "past_due";
    if (["paused", "pausado"].includes(v)) return "paused";
    if (["canceled", "cancelled", "cancelado"].includes(v)) return "canceled";
    if (["expired", "expirado"].includes(v)) return "expired";
    return null;
  };

  const updates: Record<string, any> = {};
  const statusMapped = mapStatus(data?.status ?? data?.subscription?.status);
  if (statusMapped) updates.status = statusMapped;
  if (subscriptionId) updates.cakto_subscription_id = subscriptionId;
  if (customerId) updates.cakto_customer_id = customerId;
  if (plano_id) updates.plano_id = plano_id;
  if (periodo === "mensal" || periodo === "anual") updates.periodo = periodo;

  switch (eventType) {
    case "subscription.created":
    case "subscription.activated":
    case "payment.approved":
    case "payment.completed":
      updates.status = "active";
      updates.current_period_start = new Date().toISOString();
      updates.current_period_end = new Date(
        Date.now() + ((periodo === "anual" ? 365 : 30) * 86400000)
      ).toISOString();
      break;
    case "subscription.canceled":
    case "subscription.cancelled":
      updates.status = "canceled";
      updates.canceled_at = new Date().toISOString();
      break;
    case "payment.failed":
    case "payment.refused":
      updates.status = "past_due";
      break;
    case "subscription.expired":
      updates.status = "expired";
      break;
  }

  if (Object.keys(updates).length > 0) {
    let target: { id: string } | null = null;
    if (subscriptionId) {
      const { data: existing } = await supabase
        .from("assinaturas")
        .select("id")
        .eq("cakto_subscription_id", subscriptionId)
        .maybeSingle();
      target = existing as any;
    }
    if (!target && empresa_id) {
      const { data: existing } = await supabase
        .from("assinaturas")
        .select("id")
        .eq("empresa_id", empresa_id)
        .maybeSingle();
      target = existing as any;
    }
    if (!target && customerEmail) {
      const { data: pessoa } = await supabase
        .from("pessoas")
        .select("empresa_id")
        .ilike("email", customerEmail)
        .maybeSingle();
      const emp = (pessoa as any)?.empresa_id;
      if (emp) {
        const { data: existing } = await supabase
          .from("assinaturas")
          .select("id")
          .eq("empresa_id", emp)
          .maybeSingle();
        target = existing as any;
      }
    }
    if (target) {
      await supabase.from("assinaturas").update(updates).eq("id", target.id);
    } else {
      console.warn("Cakto webhook: assinatura não encontrada", {
        subscriptionId, empresa_id, customerEmail, eventType,
      });
    }
  }

  await supabase.from("billing_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("event_id", eventId);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});