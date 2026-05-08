// Webhook do Paddle: atualiza assinatura conforme eventos
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, paddle-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const raw = await req.text();
  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("invalid json", { status: 400, headers: corsHeaders });
  }

  const eventType: string = event?.event_type ?? event?.type ?? "unknown";
  const eventId: string = event?.event_id ?? crypto.randomUUID();
  const data: any = event?.data ?? {};
  const subscriptionId: string | null = data?.id ?? data?.subscription_id ?? null;
  const customData: any = data?.custom_data ?? {};
  const empresa_id: string | null = customData?.empresa_id ?? null;

  // Log de evento (idempotente por event_id)
  await supabase
    .from("billing_events")
    .upsert(
      {
        event_id: eventId,
        event_type: eventType,
        empresa_id,
        paddle_subscription_id: subscriptionId,
        payload: event,
      },
      { onConflict: "event_id" }
    );

  // Mapear status Paddle -> nosso enum
  const mapStatus = (s?: string) => {
    switch (s) {
      case "active":
        return "active";
      case "trialing":
        return "trialing";
      case "past_due":
        return "past_due";
      case "paused":
        return "paused";
      case "canceled":
        return "canceled";
      default:
        return null;
    }
  };

  const updates: Record<string, any> = {};
  if (mapStatus(data?.status)) updates.status = mapStatus(data?.status);
  if (subscriptionId) updates.paddle_subscription_id = subscriptionId;
  if (data?.customer_id) updates.paddle_customer_id = data.customer_id;
  if (data?.current_billing_period?.starts_at)
    updates.current_period_start = data.current_billing_period.starts_at;
  if (data?.current_billing_period?.ends_at)
    updates.current_period_end = data.current_billing_period.ends_at;
  if (data?.scheduled_change?.action === "cancel")
    updates.cancel_at_period_end = true;
  if (data?.canceled_at) updates.canceled_at = data.canceled_at;

  if (eventType === "subscription.canceled") {
    updates.status = "canceled";
    updates.canceled_at = new Date().toISOString();
  }

  // Localizar empresa por subscription_id ou custom_data
  if (Object.keys(updates).length > 0) {
    if (subscriptionId) {
      const { data: existing } = await supabase
        .from("assinaturas")
        .select("id, empresa_id")
        .eq("paddle_subscription_id", subscriptionId)
        .maybeSingle();

      if (existing) {
        await supabase.from("assinaturas").update(updates).eq("id", existing.id);
      } else if (empresa_id) {
        await supabase
          .from("assinaturas")
          .update(updates)
          .eq("empresa_id", empresa_id);
      }
    } else if (empresa_id) {
      await supabase
        .from("assinaturas")
        .update(updates)
        .eq("empresa_id", empresa_id);
    }
  }

  await supabase
    .from("billing_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("event_id", eventId);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
