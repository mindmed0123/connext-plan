import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const InviteSchema = z.object({
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  nome: z.string().trim().max(150).optional(),
  role: z.enum(["admin", "gestor", "financeiro", "engenheiro", "operacional"]),
  empresa_id: z.string().uuid().optional(),
  perfil_id: z.string().uuid().nullable().optional(),
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
    const { email, role, nome, perfil_id } = parsed.data;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Papel do autor do convite, sempre derivado do JWT e escopado por empresa
    const { data: callerRoles, error: callerRoleError } = await admin
      .from("user_roles")
      .select("role, empresa_id")
      .eq("user_id", userRes.user.id);
    if (callerRoleError) return json({ error: "Não foi possível validar sua permissão." }, 500);

    const tenantRoles = (callerRoles ?? []).filter((r: any) => r.empresa_id);
    const empresasDoCaller = [...new Set(tenantRoles.map((r: any) => r.empresa_id as string))];

    let empresaId = parsed.data.empresa_id ?? null;
    if (!empresaId) {
      if (empresasDoCaller.length === 1) empresaId = empresasDoCaller[0];
      else if (empresasDoCaller.length === 0) {
        return json({ error: "Você precisa pertencer a uma empresa" }, 400);
      } else {
        return json({ error: "Informe a empresa do convite." }, 400);
      }
    }
    if (!empresasDoCaller.includes(empresaId)) {
      return json({ error: "Sem permissão para convidar nesta empresa" }, 403);
    }

    const rolesNaEmpresa = tenantRoles
      .filter((r: any) => r.empresa_id === empresaId)
      .map((r: any) => r.role as string);
    if (!rolesNaEmpresa.some((r) => ["admin", "gestor"].includes(r))) {
      return json({ error: "Sem permissão para convidar" }, 403);
    }
    if (role === "admin" && !rolesNaEmpresa.includes("admin")) {
      return json({ error: "Somente administradores podem convidar outro administrador." }, 403);
    }

    // Convite
    const requestOrigin = req.headers.get("origin");
    const redirectTo = requestOrigin?.startsWith("https://")
      ? `${requestOrigin}/auth`
      : "https://gestaodeobra.online/auth";

    // Se já existe conta com este e-mail, não falhamos: vinculamos e mandamos link de senha.
    const { data: existingUserId } = await admin.rpc("auth_user_id_by_email", { _email: email });

    let newUserId: string | null = (existingUserId as string | null) ?? null;
    let mensagem = `Convite enviado para ${email}. O convidado vai receber um e-mail para definir a senha.`;

    if (!newUserId) {
      const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { nome: nome ?? email },
      });
      if (invErr) {
        console.error("inviteUserByEmail falhou", invErr);
        return json({ error: `Não foi possível enviar o convite: ${invErr.message}` }, 400);
      }
      newUserId = inv.user?.id ?? null;
      if (!newUserId) return json({ error: "O convite não retornou um usuário válido." }, 500);
    } else {
      mensagem = `${email} já tinha cadastro. Acesso liberado nesta empresa e e-mail enviado para definir a senha.`;
    }


    // Nunca sobrescrever o vínculo de outra empresa
    const { data: rolesExistentes, error: rolesExistentesErr } = await admin
      .from("user_roles")
      .select("role, empresa_id")
      .eq("user_id", newUserId);
    if (rolesExistentesErr) {
      return json({ error: "Convite enviado, mas não foi possível validar o vínculo do usuário." }, 500);
    }
    const outraEmpresa = (rolesExistentes ?? []).some(
      (r: any) => r.empresa_id && r.empresa_id !== empresaId,
    );
    if (outraEmpresa) {
      return json({
        error: "Este e-mail já está vinculado a outra empresa. Peça para o administrador dela liberar o acesso antes de convidar.",
      }, 409);
    }
    const jaTemRole = (rolesExistentes ?? []).some(
      (r: any) => r.empresa_id === empresaId && r.role === role,
    );
    if (!jaTemRole) {
      const { error: roleError } = await admin
        .from("user_roles")
        .insert({ user_id: newUserId, role, empresa_id: empresaId });
      if (roleError) {
        console.error("insert user_roles falhou", roleError);
        return json({ error: `Convite enviado, mas não foi possível atribuir a função: ${roleError.message}` }, 500);
      }

    }

    const { data: existing, error: lookupError } = await admin
      .from("pessoas")
      .select("id")
      .eq("empresa_id", empresaId)
      .ilike("email", email)
      .maybeSingle();
    if (lookupError) return json({ error: "Convite enviado, mas o cadastro do funcionário não pôde ser consultado." }, 500);

    // perfil sempre revalidado contra a empresa derivada do JWT
    let perfilValido: string | null = null;
    if (perfil_id) {
      const { data: perfil } = await admin
        .from("perfis_permissao")
        .select("id")
        .eq("id", perfil_id)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (!perfil) return json({ error: "Perfil de permissão inválido para esta empresa." }, 400);
      perfilValido = perfil.id;
    }

    const personResult = existing
      ? await admin.from("pessoas").update({ user_id: newUserId, perfil_id: perfilValido }).eq("id", existing.id).select("id").maybeSingle()
      : await admin.from("pessoas").insert({
          nome: nome || email,
          email,
          tipo: "administrativo",
          user_id: newUserId,
          empresa_id: empresaId,
          status: "ativo",
          perfil_id: perfilValido,
        }).select("id").maybeSingle();
    if (personResult.error) {
      console.error("vínculo pessoas falhou", personResult.error);
      return json({ error: `Convite enviado, mas o cadastro do funcionário não pôde ser vinculado: ${personResult.error.message}` }, 500);
    }

    const pessoaId = personResult.data?.id ?? existing?.id ?? null;
    if (perfilValido && pessoaId) {
      const { data: itens } = await admin
        .from("perfil_permissao_itens")
        .select("modulo, can_view, can_create, can_edit, can_delete")
        .eq("perfil_id", perfilValido)
        .eq("empresa_id", empresaId);
      if (itens?.length) {
        await admin.from("pessoa_permissoes").upsert(
          itens.map((i) => ({ ...i, pessoa_id: pessoaId, empresa_id: empresaId })),
          { onConflict: "pessoa_id,modulo" },
        );
      }
    }

    // Usuário que já existia: manda e-mail de definição de senha (fluxo de recuperação)
    if (existingUserId) {
      const { error: resetErr } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
      if (resetErr) {
        console.error("resetPasswordForEmail falhou", resetErr);
        mensagem = `${email} já tinha cadastro e agora tem acesso a esta empresa. Peça para entrar com a senha atual ou usar "Esqueci minha senha".`;
      }
    }

    return json({ ok: true, user_id: newUserId, message: mensagem });

  } catch (error) {
    console.error("invite-user failed", error);
    return json({ error: "Erro interno ao enviar o convite. Tente novamente." }, 500);
  }
});
