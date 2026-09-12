import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const MODELO = "google/gemini-3.8-flash";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const BodySchema = z.object({
  uso: z.enum(["orcamento", "cotacao", "diario"]),
  // orcamento
  tipo_obra: z.string().max(120).nullable().optional(),
  padrao: z.string().max(60).nullable().optional(),
  area_m2: z.number().positive().max(1_000_000).nullable().optional(),
  descricao: z.string().max(4000).nullable().optional(),
  // cotacao
  arquivo_base64: z.string().max(12_000_000).nullable().optional(),
  mime: z.string().max(120).nullable().optional(),
  // diario
  obra_id: z.string().uuid().nullable().optional(),
  inicio: z.string().max(10).nullable().optional(),
  fim: z.string().max(10).nullable().optional(),
});

const FLAG: Record<string, string> = {
  orcamento: "ia_orcamento",
  cotacao: "ia_cotacao",
  diario: "ia_diario",
};

function erro(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return erro(405, "Método não permitido.");

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return erro(500, "A inteligência artificial não está configurada nesta instalação.");

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return erro(401, "Sessão não encontrada.");

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Cliente com o JWT do usuário: toda leitura passa pelas políticas da empresa dele.
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return erro(401, "Sessão inválida.");
  const userId = userData.user.id;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return erro(400, "Pedido inválido.");
  const body = parsed.data;

  // Empresa e permissão do próprio usuário — nunca vem do corpo do pedido.
  const { data: empresaId, error: empErr } = await userClient.rpc("get_user_empresa_id");
  if (empErr || !empresaId) return erro(403, "Usuário sem empresa.");

  const { data: config } = await userClient
    .from("empresa_config")
    .select("ia_orcamento, ia_cotacao, ia_diario")
    .maybeSingle();
  if (!config || !(config as Record<string, boolean>)[FLAG[body.uso]]) {
    return erro(403, "Este uso da inteligência artificial está desligado nas configurações da empresa.");
  }

  let system = "";
  let content: unknown;

  if (body.uso === "orcamento") {
    const { data: refs } = await userClient
      .from("custos_referencia_m2")
      .select("tipo_obra, padrao, valor_m2, fonte, data_referencia, cidade")
      .eq("ativo", true)
      .limit(50);
    system =
      "Você ajuda a montar uma estimativa inicial de orçamento de obra no Brasil. " +
      "Use apenas os custos de referência fornecidos. Responda em português do Brasil, em JSON com as chaves " +
      '"estimativa_total", "faixa_min", "faixa_max", "premissas" (lista) e "etapas" (lista de {nome, percentual, valor}). ' +
      "Deixe claro que é estimativa preliminar e não substitui o orçamento detalhado.";
    content = JSON.stringify({
      tipo_obra: body.tipo_obra,
      padrao: body.padrao,
      area_m2: body.area_m2,
      descricao: body.descricao,
      custos_referencia: refs ?? [],
    });
  } else if (body.uso === "cotacao") {
    if (!body.arquivo_base64 || !body.mime) return erro(400, "Envie o arquivo da cotação.");
    system =
      "Você lê uma cotação de fornecedor (PDF ou foto) e extrai os itens. Responda em português do Brasil, em JSON " +
      'com as chaves "fornecedor", "data", "condicao_pagamento" e "itens" (lista de {descricao, unidade, quantidade, ' +
      'preco_unitario, total}). Nunca invente item que não esteja no documento; use null quando não houver o dado.';
    content = [
      { type: "text", text: "Extraia os itens desta cotação." },
      { type: "image_url", image_url: { url: `data:${body.mime};base64,${body.arquivo_base64}` } },
    ];
  } else {
    if (!body.obra_id || !body.inicio || !body.fim) return erro(400, "Informe a obra e o período.");
    const { data: diarios, error: dErr } = await userClient
      .from("diario_obra")
      .select("data, clima, efetivo, atividades, ocorrencias, observacoes")
      .eq("obra_id", body.obra_id)
      .gte("data", body.inicio)
      .lte("data", body.fim)
      .order("data");
    if (dErr) return erro(400, "Não consegui ler o diário desse período.");
    if (!diarios || diarios.length === 0) return erro(400, "Não há diário registrado nesse período.");
    system =
      "Você redige o relatório do período a partir dos diários de obra fornecidos. Responda em português do Brasil, " +
      "em texto corrido com subtítulos: resumo do período, serviços executados, efetivo, ocorrências e pendências. " +
      "Use somente o que está nos diários; não invente fatos.";
    content = JSON.stringify({ periodo: { inicio: body.inicio, fim: body.fim }, diarios });
  }

  const t0 = Date.now();
  let resposta = "";
  let tokens = 0;
  let sucesso = false;
  let status = 200;

  try {
    const r = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: MODELO,
        messages: [
          { role: "system", content: system },
          { role: "user", content },
        ],
      }),
    });

    if (!r.ok) {
      status = r.status;
      const txt = await r.text();
      const msg = status === 402
        ? "Os créditos de inteligência artificial acabaram. Peça ao responsável pela conta para adicionar créditos."
        : status === 429
          ? "Muitos pedidos ao mesmo tempo. Tente de novo em alguns segundos."
          : `A inteligência artificial recusou o pedido (${status}). ${txt.slice(0, 300)}`;
      throw new Error(msg);
    }

    const json = await r.json();
    resposta = json?.choices?.[0]?.message?.content ?? "";
    tokens = Number(json?.usage?.total_tokens ?? 0);
    sucesso = true;
  } catch (e) {
    const admin = createClient(url, service);
    await admin.from("ia_usos").insert({
      empresa_id: empresaId,
      uso: body.uso,
      tokens: 0,
      custo_estimado: 0,
      modelo: MODELO,
      sucesso: false,
      usuario_id: userId,
    });
    return erro(status === 200 ? 502 : status, e instanceof Error ? e.message : "Falha na inteligência artificial.");
  }

  // Registro de consumo e auditoria com a empresa validada do usuário.
  const admin = createClient(url, service);
  const custo = Math.round((tokens / 1_000_000) * 0.6 * 10000) / 10000;
  await admin.from("ia_usos").insert({
    empresa_id: empresaId,
    uso: body.uso,
    tokens,
    custo_estimado: custo,
    modelo: MODELO,
    sucesso,
    usuario_id: userId,
  });
  await admin.from("audit_log").insert({
    empresa_id: empresaId,
    tabela: "ia_usos",
    operacao: "INSERT",
    usuario_id: userId,
    dados_novos: { uso: body.uso, tokens, modelo: MODELO, duracao_ms: Date.now() - t0 },
  });

  return new Response(
    JSON.stringify({ resultado: resposta, tokens, modelo: MODELO, rascunho: true, gerado_por_ia: true }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
