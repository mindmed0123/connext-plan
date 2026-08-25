import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const InviteSchema = z.object({
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  nome: z.string().trim().max(150).optional(),
  role: z.enum(["admin", "gestor", "financeiro", "engenheiro", "operacional"]),
});

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ANON = Deno.env.get("SUPABASE_ANON_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY || !ANON) return json({ error: "Configuração do servidor incompleta" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) {
      return json({ error: "Sua sessão expirou. Entre novamente e repita o convite." }, 401);
    }

    const parsed = InviteSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: "Confira o e-mail e a função informados." }, 400);
    const { email, role, nome } = parsed.data;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verificar role do caller (apenas admin/super_admin pode convidar)
    const { data: callerRoles, error: callerRoleError } = await admin
      .from("user_roles")
      .select("role, empresa_id")
      .eq("user_id", userRes.user.id);
    if (callerRoleError) return json({ error: "Não foi possível validar sua permissão." }, 500);

    const callerRow = callerRoles?.find((r: any) =>
      ["super_admin", "admin", "gestor"].includes(r.role)
    );
    if (!callerRow) {
      return json({ error: "Sem permissão para convidar" }, 403);
    }
    const empresaId = callerRow.empresa_id;
    if (!empresaId) {
      return json({ error: "Você precisa pertencer a uma empresa" }, 400);
    }

    // Convite
    const requestOrigin = req.headers.get("origin");
    const redirectTo = requestOrigin?.startsWith("https://")
      ? `${requestOrigin}/auth`
      : "https://gestaodeobra.online/auth";
    const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { nome: nome ?? email },
    });
    if (invErr) {
      const alreadyExists = /already|registered|exists/i.test(invErr.message);
      return json({
        error: alreadyExists
          ? "Este e-mail já possui cadastro ou convite. Use a recuperação de senha para acessar."
          : `Não foi possível enviar o convite: ${invErr.message}`,
      }, 400);
    }

    const newUserId = inv.user?.id;
    if (!newUserId) return json({ error: "O convite não retornou um usuário válido." }, 500);

    const { error: roleError } = await admin.from("user_roles").upsert(
      { user_id: newUserId, role, empresa_id: empresaId },
      { onConflict: "user_id,role" },
    );
    if (roleError) return json({ error: "Convite enviado, mas não foi possível atribuir a função ao usuário." }, 500);

    const { data: existing, error: lookupError } = await admin
      .from("pessoas")
      .select("id")
      .eq("empresa_id", empresaId)
      .ilike("email", email)
      .maybeSingle();
    if (lookupError) return json({ error: "Convite enviado, mas o cadastro do funcionário não pôde ser consultado." }, 500);

    const personResult = existing
      ? await admin.from("pessoas").update({ user_id: newUserId }).eq("id", existing.id)
      : await admin.from("pessoas").insert({
          nome: nome || email,
          email,
          tipo: "administrativo",
          user_id: newUserId,
          empresa_id: empresaId,
          status: "ativo",
        });
    if (personResult.error) return json({ error: "Convite enviado, mas o cadastro do funcionário não pôde ser vinculado." }, 500);

    return json({ ok: true, user_id: newUserId });
  } catch (error) {
    console.error("invite-user failed", error);
    return json({ error: "Erro interno ao enviar o convite. Tente novamente." }, 500);
  }
});
