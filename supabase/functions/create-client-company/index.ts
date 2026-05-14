/**
 * create-client-company
 * Apenas super_admin: cria uma nova empresa cliente isolada e convida o admin dela.
 * Body: { empresa_nome: string, admin_email: string, admin_nome?: string, plano?: string }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Não autenticado" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: superRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin");

    if (!superRoles || superRoles.length === 0) {
      return json({ error: "Apenas super_admin pode criar empresas clientes" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const { empresa_nome, admin_email, admin_nome, plano = "basico" } = body as {
      empresa_nome: string;
      admin_email: string;
      admin_nome?: string;
      plano?: string;
    };
    if (!empresa_nome?.trim()) return json({ error: "empresa_nome é obrigatório" }, 400);
    if (!admin_email?.trim())  return json({ error: "admin_email é obrigatório" }, 400);

    const slug =
      empresa_nome
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
      + "-" + Math.random().toString(36).slice(2, 8);

    const { data: novaEmpresa, error: empErr } = await admin
      .from("empresas")
      .insert({ nome: empresa_nome.trim(), slug, plano })
      .select("id")
      .single();

    if (empErr || !novaEmpresa) {
      return json({ error: empErr?.message ?? "Erro ao criar empresa" }, 500);
    }
    const novaEmpresaId: string = novaEmpresa.id;

    const redirectTo = req.headers.get("origin") ?? undefined;
    const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(
      admin_email.trim(),
      { redirectTo, data: { nome: admin_nome ?? admin_email } }
    );
    if (invErr || !inv.user?.id) {
      await admin.from("empresas").delete().eq("id", novaEmpresaId);
      return json({ error: invErr?.message ?? "Falha ao convidar usuário" }, 400);
    }
    const newUserId = inv.user.id;

    await admin.from("user_roles").upsert(
      { user_id: newUserId, role: "admin", empresa_id: novaEmpresaId },
      { onConflict: "user_id,role" } as any
    );

    const { data: pessoaExistente } = await admin
      .from("pessoas")
      .select("id")
      .eq("empresa_id", novaEmpresaId)
      .ilike("email", admin_email.trim())
      .maybeSingle();

    if (!pessoaExistente) {
      await admin.from("pessoas").insert({
        nome: admin_nome ?? admin_email,
        email: admin_email.trim(),
        tipo: "administrativo",
        user_id: newUserId,
        empresa_id: novaEmpresaId,
        status: "ativo",
      });
    }

    return json({
      ok: true,
      empresa_id: novaEmpresaId,
      user_id: newUserId,
      message: `Empresa "${empresa_nome}" criada. Convite enviado para ${admin_email}.`,
    });
  } catch (e: any) {
    return json({ error: e.message ?? String(e) }, 500);
  }
});
