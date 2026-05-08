// Cria checkout de assinatura no Paddle
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PADDLE_API_KEY = Deno.env.get("PADDLE_API_KEY") ?? "";
const PADDLE_ENV = Deno.env.get("PADDLE_ENV") ?? "sandbox"; // sandbox | live
const PADDLE_BASE =
  PADDLE_ENV === "live" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
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

    const body = await req.json();
    const plano_slug = String(body?.plano_slug ?? "");
    const periodo = body?.periodo === "anual" ? "anual" : "mensal";
    if (!plano_slug) {
      return new Response(JSON.stringify({ error: "plano_slug obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Empresa do usuário
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("empresa_id, empresas(nome)")
      .eq("user_id", user.id)
      .not("empresa_id", "is", null)
      .maybeSingle();
    const empresa_id = (roleRow?.empresa_id as string) ?? null;
    if (!empresa_id) {
      return new Response(JSON.stringify({ error: "Sem empresa vinculada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Plano
    const { data: plano } = await supabase
      .from("planos")
      .select("*")
      .eq("slug", plano_slug)
      .maybeSingle();
    if (!plano) {
      return new Response(JSON.stringify({ error: "Plano não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const priceId =
      periodo === "anual" ? plano.paddle_price_id_anual : plano.paddle_price_id_mensal;

    if (!PADDLE_API_KEY || !priceId) {
      // Modo de desenvolvimento — sem credenciais Paddle ainda. Atualiza assinatura local.
      await supabase
        .from("assinaturas")
        .update({
          plano_id: plano.id,
          periodo,
          status: "active",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(
            Date.now() + (periodo === "anual" ? 365 : 30) * 86400000
          ).toISOString(),
        })
        .eq("empresa_id", empresa_id);

      const origin = req.headers.get("origin") ?? "";
      return new Response(
        JSON.stringify({
          checkout_url: `${origin}/billing?success=mock`,
          mock: true,
          message: "Paddle não configurado — assinatura ativada em modo de desenvolvimento",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cria transaction de checkout no Paddle
    const origin = req.headers.get("origin") ?? "";
    const paddleResp = await fetch(`${PADDLE_BASE}/transactions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PADDLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ price_id: priceId, quantity: 1 }],
        customer_email: user.email,
        custom_data: {
          empresa_id,
          plano_id: plano.id,
          periodo,
          user_id: user.id,
        },
        checkout: { url: `${origin}/billing?success=true` },
      }),
    });

    const paddleJson = await paddleResp.json();
    if (!paddleResp.ok) {
      console.error("Paddle error", paddleJson);
      return new Response(JSON.stringify({ error: paddleJson?.error?.detail ?? "Erro Paddle" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const checkout_url = paddleJson?.data?.checkout?.url;
    return new Response(JSON.stringify({ checkout_url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
