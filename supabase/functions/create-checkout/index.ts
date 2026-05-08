// Cria checkout de assinatura na Cakto
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CAKTO_API_KEY = Deno.env.get("CAKTO_API_KEY") ?? "";
const CAKTO_BASE = Deno.env.get("CAKTO_API_BASE") ?? "https://api.cakto.com.br/v1";

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

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const plano_slug = String(body?.plano_slug ?? "");
    const periodo = body?.periodo === "anual" ? "anual" : "mensal";
    if (!plano_slug) {
      return new Response(JSON.stringify({ error: "plano_slug obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("empresa_id, empresas(nome)")
      .eq("user_id", user.id)
      .not("empresa_id", "is", null)
      .maybeSingle();
    const empresa_id = (roleRow?.empresa_id as string) ?? null;
    const empresa_nome = ((roleRow?.empresas as any)?.nome as string) ?? "";
    if (!empresa_id) {
      return new Response(JSON.stringify({ error: "Sem empresa vinculada" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: plano } = await supabase
      .from("planos").select("*").eq("slug", plano_slug).maybeSingle();
    if (!plano) {
      return new Response(JSON.stringify({ error: "Plano não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const productId = periodo === "anual"
      ? plano.cakto_product_id_anual
      : plano.cakto_product_id_mensal;

    const origin = req.headers.get("origin") ?? "";

    // Modo desenvolvimento (sem API key Cakto ou produto não cadastrado): ativa direto
    if (!CAKTO_API_KEY || !productId) {
      await supabase.from("assinaturas").update({
        plano_id: plano.id,
        periodo,
        status: "active",
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(
          Date.now() + (periodo === "anual" ? 365 : 30) * 86400000
        ).toISOString(),
      }).eq("empresa_id", empresa_id);

      return new Response(JSON.stringify({
        checkout_url: `${origin}/billing?success=mock`,
        mock: true,
        message: "Cakto não configurado — assinatura ativada em modo desenvolvimento",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Cria checkout na Cakto
    const caktoResp = await fetch(`${CAKTO_BASE}/checkouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CAKTO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_id: productId,
        customer: { email: user.email, name: empresa_nome },
        success_url: `${origin}/billing?success=true`,
        cancel_url: `${origin}/pricing?canceled=true`,
        metadata: {
          empresa_id,
          plano_id: plano.id,
          periodo,
          user_id: user.id,
        },
      }),
    });

    const caktoJson = await caktoResp.json();
    if (!caktoResp.ok) {
      console.error("Cakto error", caktoJson);
      return new Response(JSON.stringify({
        error: caktoJson?.message ?? caktoJson?.error ?? "Erro ao criar checkout Cakto",
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const checkout_url =
      caktoJson?.checkout_url ?? caktoJson?.url ?? caktoJson?.data?.checkout_url;

    return new Response(JSON.stringify({ checkout_url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
