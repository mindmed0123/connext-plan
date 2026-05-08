// Portal de cobrança Cakto — gera link para o cliente gerenciar assinatura
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CAKTO_API_KEY = Deno.env.get("CAKTO_API_KEY") ?? "";
const CAKTO_BASE = Deno.env.get("CAKTO_API_BASE") ?? "https://api.cakto.com.br/v1";
const CAKTO_PORTAL_URL = Deno.env.get("CAKTO_PORTAL_URL") ?? "https://app.cakto.com.br";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleRow } = await supabase
      .from("user_roles").select("empresa_id")
      .eq("user_id", user.id).not("empresa_id", "is", null).maybeSingle();
    const empresa_id = (roleRow?.empresa_id as string) ?? null;
    if (!empresa_id) {
      return new Response(JSON.stringify({ error: "Sem empresa" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: assinatura } = await supabase
      .from("assinaturas")
      .select("cakto_subscription_id, cakto_customer_id")
      .eq("empresa_id", empresa_id).maybeSingle();

    // Se houver API Cakto + customer, tenta gerar link de portal pessoal
    if (CAKTO_API_KEY && assinatura?.cakto_customer_id) {
      try {
        const resp = await fetch(`${CAKTO_BASE}/customers/${assinatura.cakto_customer_id}/portal`, {
          method: "POST",
          headers: { Authorization: `Bearer ${CAKTO_API_KEY}` },
        });
        const json = await resp.json();
        const portal_url = json?.url ?? json?.portal_url ?? json?.data?.url;
        if (resp.ok && portal_url) {
          return new Response(JSON.stringify({ portal_url }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (e) {
        console.warn("Cakto portal API falhou, usando fallback", e);
      }
    }

    // Fallback: portal público da Cakto
    return new Response(JSON.stringify({ portal_url: CAKTO_PORTAL_URL }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
