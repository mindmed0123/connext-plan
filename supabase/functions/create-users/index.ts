// Edge function para criar usuários administrativamente
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const usuarios = [
      { nome: "Arlindo Geraldo", email: "silvarlindo075@gmail.com", password: "Maisavi25" },
      { nome: "Reinaldo Bruno", email: "reinaldobruno1042@gmail.com", password: "107868" },
    ];

    const resultados = [];

    for (const u of usuarios) {
      // Cria usuário já confirmado
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { nome: u.nome },
      });

      if (error) {
        // Se já existe, tenta atualizar a senha
        if (error.message?.toLowerCase().includes("already") || error.code === "email_exists") {
          const { data: list } = await admin.auth.admin.listUsers();
          const existente = list.users.find((x) => x.email?.toLowerCase() === u.email.toLowerCase());
          if (existente) {
            await admin.auth.admin.updateUserById(existente.id, {
              password: u.password,
              email_confirm: true,
              user_metadata: { nome: u.nome },
            });
            resultados.push({ email: u.email, status: "atualizado", user_id: existente.id });
            continue;
          }
        }
        resultados.push({ email: u.email, status: "erro", error: error.message });
        continue;
      }

      resultados.push({ email: u.email, status: "criado", user_id: data.user?.id });
    }

    return new Response(JSON.stringify({ ok: true, resultados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
