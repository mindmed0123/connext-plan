// Abre o portal do cliente no Paddle para gerenciar assinatura
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PADDLE_API_KEY = Deno.env.get("PADDLE_API_KEY") ?? "";
const PADDLE_ENV = Deno.env.get("PADDLE_ENV") ?? "sandbox";
const PADDLE_BASE =
  PADDLE_ENV === "live" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("empresa_id")
      .eq("user_id", user.id)
      .not("empresa_id", "is", null)
      .maybeSingle();
    const empresa_id = roleRow?.empresa_id as string | null;
    if (!empresa_id) {
      return new Response(JSON.stringify({ error: "Sem empresa" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: assinatura } = await supabase
      .from("assinaturas")
      .select("paddle_customer_id")
      .eq("empresa_id", empresa_id)
      .maybeSingle();

    if (!assinatura?.paddle_customer_id || !PADDLE_API_KEY) {
      const origin = req.headers.get("origin") ?? "";
      return new Response(
        JSON.stringify({ portal_url: `${origin}/billing` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resp = await fetch(
      `${PADDLE_BASE}/customers/${assinatura.paddle_customer_id}/portal-sessions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PADDLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );
    const json = await resp.json();
    return new Response(
      JSON.stringify({ portal_url: json?.data?.urls?.general?.overview }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
