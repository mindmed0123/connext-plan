// Retorna a URL de checkout fixo da Cakto correspondente ao plano/período
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      .select("empresa_id")
      .eq("user_id", user.id)
      .not("empresa_id", "is", null)
      .maybeSingle();
    const empresa_id = (roleRow?.empresa_id as string) ?? null;
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

    const baseUrl = periodo === "anual"
      ? plano.cakto_checkout_url_anual
      : plano.cakto_checkout_url_mensal;

    if (!baseUrl) {
      return new Response(JSON.stringify({ error: "Link de checkout não configurado para este plano" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Anexa email + metadata para rastrear no webhook da Cakto
    const url = new URL(baseUrl);
    if (user.email) url.searchParams.set("email", user.email);
    url.searchParams.set("ref", `${empresa_id}|${plano.id}|${periodo}|${user.id}`);

    return new Response(JSON.stringify({ checkout_url: url.toString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
