// Portal do cliente: leitura pública por token, sem login.
// Recebe SOMENTE o token; nunca aceita empresa_id nem obra_id do corpo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let token = "";
  try {
    const body = await req.json();
    token = typeof body?.token === "string" ? body.token.trim() : "";
  } catch {
    return json({ erro: "invalido" }, 400);
  }
  if (!/^[a-f0-9]{32,128}$/i.test(token)) return json({ erro: "invalido" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = req.headers.get("user-agent")?.slice(0, 300) ?? null;

  const { data, error } = await supabase.rpc("get_portal_obra", {
    _token: token,
    _ip: ip,
    _user_agent: ua,
  });
  if (error) {
    console.error("portal-obra", error.message);
    return json({ erro: "invalido" }, 400);
  }
  const payload = data as Record<string, unknown> | null;
  if (!payload || payload.erro) return json({ erro: payload?.erro ?? "invalido" }, 404);

  // Links temporários para fotos e documentos liberados (buckets privados).
  const fotos = (payload.fotos as { storage_path?: string; imagem_url?: string }[]) ?? [];
  const paths = fotos.map((f) => f.storage_path).filter(Boolean) as string[];
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("obras-fotos").createSignedUrls(paths, 3600);
    const map = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    payload.fotos = fotos.map((f) => ({
      ...f,
      url: (f.storage_path && map.get(f.storage_path)) || f.imagem_url || null,
      storage_path: undefined,
    }));
  }

  const docs = (payload.documentos as { arquivo_path?: string }[]) ?? [];
  const docPaths = docs.map((d) => d.arquivo_path).filter(Boolean) as string[];
  if (docPaths.length) {
    const { data: signedDocs } = await supabase.storage
      .from("obra-documentos")
      .createSignedUrls(docPaths, 3600);
    const map = new Map((signedDocs ?? []).map((s) => [s.path, s.signedUrl]));
    payload.documentos = docs.map((d) => ({
      ...d,
      url: (d.arquivo_path && map.get(d.arquivo_path)) || null,
      arquivo_path: undefined,
    }));
  }

  return json(payload);
});
