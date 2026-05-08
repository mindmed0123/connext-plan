import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { email, role, nome } = body as { email: string; role: string; nome?: string };
    if (!email || !role) {
      return new Response(JSON.stringify({ error: "email e role são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verificar role do caller (apenas admin/super_admin pode convidar)
    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role, empresa_id")
      .eq("user_id", userRes.user.id);

    const callerRow = callerRoles?.find((r: any) =>
      ["super_admin", "admin", "gestor"].includes(r.role)
    );
    if (!callerRow) {
      return new Response(JSON.stringify({ error: "Sem permissão para convidar" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const empresaId = callerRow.empresa_id;
    if (!empresaId) {
      return new Response(JSON.stringify({ error: "Você precisa pertencer a uma empresa" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Convite
    const redirectTo = req.headers.get("origin") ?? undefined;
    const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { nome: nome ?? email },
    });
    if (invErr) {
      return new Response(JSON.stringify({ error: invErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const newUserId = inv.user?.id;
    if (newUserId) {
      // Cria role já vinculada à empresa
      await admin.from("user_roles").upsert(
        { user_id: newUserId, role, empresa_id: empresaId },
        { onConflict: "user_id,role" } as any
      );
      // Cria pessoa stub se ainda não existir com este email/empresa
      const { data: existing } = await admin
        .from("pessoas")
        .select("id")
        .eq("empresa_id", empresaId)
        .ilike("email", email)
        .maybeSingle();
      if (!existing) {
        await admin.from("pessoas").insert({
          nome: nome ?? email,
          email,
          tipo: "administrativo",
          user_id: newUserId,
          empresa_id: empresaId,
          status: "ativo",
        });
      } else {
        await admin.from("pessoas").update({ user_id: newUserId }).eq("id", existing.id);
      }
    }

    return new Response(JSON.stringify({ ok: true, user_id: newUserId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
