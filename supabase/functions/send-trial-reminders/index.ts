// Envia lembretes de trial a cada 2 dias para empresas com trial ativo.
// Idempotente: usa idempotencyKey por (empresa_id, dia restante).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const formatPrice = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Busca planos com link de checkout mensal
    const { data: planos } = await supabase
      .from("planos")
      .select("nome, slug, preco_mensal, cakto_checkout_url_mensal, destaque, ordem")
      .eq("ativo", true)
      .order("ordem");

    const planosPayload = (planos ?? [])
      .filter((p: any) => !!p.cakto_checkout_url_mensal)
      .map((p: any) => ({
        nome: p.nome,
        preco: formatPrice(p.preco_mensal),
        url: p.cakto_checkout_url_mensal,
        destaque: !!p.destaque,
      }));

    // Busca trials ativos
    const { data: trials, error } = await supabase
      .from("assinaturas")
      .select("empresa_id, trial_ends_at, empresas(nome)")
      .eq("status", "trialing");
    if (error) throw error;

    const now = Date.now();
    const results: any[] = [];

    for (const t of trials ?? []) {
      if (!t.trial_ends_at) continue;
      const daysLeft = Math.max(
        0,
        Math.ceil((new Date(t.trial_ends_at).getTime() - now) / 86400000),
      );

      // Envia em dias pares (cron roda diariamente, mas só dispara se daysLeft for múltiplo de 2)
      // ou nos últimos 3 dias.
      const shouldSend = daysLeft <= 3 || daysLeft % 2 === 0;
      if (!shouldSend) continue;
      if (daysLeft > 14) continue;

      // Pega o admin da empresa
      const { data: roleAdmin } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("empresa_id", t.empresa_id)
        .in("role", ["admin", "super_admin"])
        .limit(1)
        .maybeSingle();
      if (!roleAdmin?.user_id) continue;

      const { data: userInfo } = await supabase.auth.admin.getUserById(roleAdmin.user_id);
      const recipientEmail = userInfo?.user?.email;
      const nome =
        (userInfo?.user?.user_metadata as any)?.nome ||
        (t.empresas as any)?.nome ||
        undefined;
      if (!recipientEmail) continue;

      const idempotencyKey = `trial-reminder-${t.empresa_id}-d${daysLeft}`;

      const { error: sendErr } = await supabase.functions.invoke(
        "send-transactional-email",
        {
          body: {
            templateName: "trial-reminder",
            recipientEmail,
            idempotencyKey,
            templateData: { name: nome, daysLeft, planos: planosPayload },
          },
        },
      );

      results.push({ empresa_id: t.empresa_id, daysLeft, sent: !sendErr, error: sendErr?.message });
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
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
