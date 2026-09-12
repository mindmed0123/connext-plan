import { supabase } from "@/integrations/supabase/client";
import { PerfilOperacao } from "@/lib/modulos";

const MARCA = "[EXEMPLO]";

export type ResultadoExemplo = { criados: string[]; falhas: string[] };

async function passo(
  res: ResultadoExemplo,
  nome: string,
  fn: () => Promise<void>,
) {
  try {
    await fn();
    res.criados.push(nome);
  } catch (e) {
    res.falhas.push(`${nome}: ${(e as Error).message}`);
  }
}

/**
 * Cria uma obra completa de demonstração no perfil escolhido.
 * Tudo fica marcado como exemplo e pode ser apagado de uma vez.
 * Toda linha é gravada com a empresa do próprio usuário (RLS do banco).
 */
export async function carregarDadosExemplo(
  empresaId: string,
  perfil: PerfilOperacao | null,
): Promise<ResultadoExemplo> {
  const res: ResultadoExemplo = { criados: [], falhas: [] };
  const hoje = new Date().toISOString().slice(0, 10);

  const { data: obra, error: obraErr } = await supabase.rpc("criar_obra_segura", {
    _codigo_chamado: `EX-${Date.now().toString().slice(-6)}`,
    _origem: `${MARCA} Demonstração`,
    _regiao_label: "",
    _engenheiro_responsavel: "Equipe de demonstração",
    _descricao_servico: `${MARCA} Reforma completa de fachada`,
    _endereco: "Av. Exemplo, 1000 — Centro",
    _data_recebimento: hoje,
  });
  if (obraErr || !obra) throw new Error(obraErr?.message ?? "Não foi possível criar a obra de exemplo");
  const obraId = (obra as any).id as string;
  await supabase.from("obras").update({ exemplo: true } as any).eq("id", obraId);
  res.criados.push("Obra de exemplo");

  let clienteId: string | null = null;
  await passo(res, "Cliente", async () => {
    const { data, error } = await supabase
      .from("clientes")
      .insert({ empresa_id: empresaId, nome: `${MARCA} Contratante Modelo Ltda`, cnpj: "00000000000191" })
      .select("id")
      .single();
    if (error) throw error;
    clienteId = data.id;
    await supabase.from("obras").update({ cliente_id: clienteId } as any).eq("id", obraId);
  });

  let orcamentoId: string | null = null;
  await passo(res, "Orçamento com itens", async () => {
    const { data, error } = await supabase
      .from("orcamentos")
      .insert({
        empresa_id: empresaId,
        obra_id: obraId,
        titulo: `${MARCA} Proposta de reforma de fachada`,
        cliente_nome: `${MARCA} Contratante Modelo Ltda`,
        status: "aprovado",
        data_orcamento: hoje,
        valor_orcamento: 120000,
      } as any)
      .select("id")
      .single();
    if (error) throw error;
    orcamentoId = data.id;
    const itens = [
      { descricao: "Andaime fachadeiro", unidade: "m²", quantidade: 400, preco_unitario: 45 },
      { descricao: "Pintura acrílica externa", unidade: "m²", quantidade: 800, preco_unitario: 65 },
      { descricao: "Recuperação estrutural", unidade: "m²", quantidade: 120, preco_unitario: 420 },
    ];
    const { error: itErr } = await supabase.from("orcamento_itens").insert(
      itens.map((i, idx) => ({ ...i, ordem: idx, orcamento_id: orcamentoId!, empresa_id: empresaId })) as any,
    );
    if (itErr) throw itErr;
  });

  let contratoId: string | null = null;
  if (perfil !== "manutencao") {
    await passo(res, "Contrato", async () => {
      const { data, error } = await supabase
        .from("contratos_clientes")
        .insert({
          empresa_id: empresaId,
          obra_id: obraId,
          cliente_id: clienteId,
          objeto: `${MARCA} Reforma completa de fachada`,
          valor_global: 120000,
          data_inicio: hoje,
          prazo_pagamento_dias: 30,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      contratoId = data.id;
    });
  }

  if (perfil === "prestadora_servico") {
    await passo(res, "Medição aprovada", async () => {
      const { error } = await supabase.from("medicoes").insert({
        empresa_id: empresaId,
        obra_id: obraId,
        contrato_id: contratoId,
        numero_medicao: 1,
        data_medicao: hoje,
        valor_medido: 48000,
        status: "aprovada",
      } as any);
      if (error) throw error;
    });
  }

  if (perfil === "obra_propria") {
    await passo(res, "Compras de material", async () => {
      const { error } = await supabase.from("materiais_obra").insert([
        {
          empresa_id: empresaId, obra_id: obraId, descricao: `${MARCA} Argamassa polimérica`,
          quantidade: 120, unidade: "sc", valor_unitario: 78, valor_total: 9360, data_compra: hoje,
        },
        {
          empresa_id: empresaId, obra_id: obraId, descricao: `${MARCA} Tinta acrílica premium`,
          quantidade: 60, unidade: "lt", valor_unitario: 190, valor_total: 11400, data_compra: hoje,
        },
      ] as any);
      if (error) throw error;
    });
  }

  await passo(res, "Nota fiscal", async () => {
    const { error } = await supabase.from("notas_fiscais").insert({
      empresa_id: empresaId,
      obra_id: obraId,
      numero_nf: `EX-${Date.now().toString().slice(-5)}`,
      data_emissao: hoje,
      valor: 48000,
      valor_bruto: 48000,
    } as any);
    if (error) throw error;
  });

  await passo(res, "Conta a pagar", async () => {
    const { error } = await supabase.from("contas_pagar").insert({
      empresa_id: empresaId,
      obra_id: obraId,
      descricao: `${MARCA} Mão de obra terceirizada — fachada`,
      valor_total: 22000,
      data_emissao: hoje,
    } as any);
    if (error) throw error;
  });

  return res;
}

/** Apaga tudo o que foi criado como exemplo, na ordem certa. */
export async function apagarDadosExemplo(empresaId: string): Promise<{ obras: number; falhas: string[] }> {
  const falhas: string[] = [];
  const { data: obras, error } = await supabase
    .from("obras")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("exemplo" as any, true);
  if (error) throw error;
  const ids = (obras ?? []).map((o: any) => o.id as string);
  if (ids.length === 0) return { obras: 0, falhas };

  const filhosPorObra = [
    "recebimento_pagamentos",
    "recebimentos",
    "notas_fiscais",
    "medicoes",
    "contratos_clientes",
    "materiais_obra",
    "contas_pagar",
    "orcamento_itens",
    "orcamentos",
    "lancamentos_financeiros",
    "obra_timeline",
  ];

  for (const id of ids) {
    for (const tabela of filhosPorObra) {
      if (tabela === "recebimento_pagamentos") {
        const { data: recs } = await supabase.from("recebimentos").select("id").eq("obra_id", id);
        const recIds = (recs ?? []).map((r: any) => r.id);
        if (recIds.length) {
          const { error: e } = await supabase
            .from("recebimento_pagamentos")
            .delete()
            .in("recebimento_id", recIds)
            .eq("empresa_id", empresaId);
          if (e) falhas.push(`${tabela}: ${e.message}`);
        }
        continue;
      }
      if (tabela === "orcamento_itens") {
        const { data: orcs } = await supabase.from("orcamentos").select("id").eq("obra_id", id);
        const orcIds = (orcs ?? []).map((o: any) => o.id);
        if (orcIds.length) {
          const { error: e } = await supabase
            .from("orcamento_itens")
            .delete()
            .in("orcamento_id", orcIds)
            .eq("empresa_id", empresaId);
          if (e) falhas.push(`${tabela}: ${e.message}`);
        }
        continue;
      }
      const { error: e } = await supabase
        .from(tabela as any)
        .delete()
        .eq("obra_id", id)
        .eq("empresa_id", empresaId);
      if (e) falhas.push(`${tabela}: ${e.message}`);
    }
    const { error: eo } = await supabase.from("obras").delete().eq("id", id).eq("empresa_id", empresaId);
    if (eo) falhas.push(`obra: ${eo.message}`);
  }

  const { data: clientesEx } = await supabase
    .from("clientes")
    .select("id, nome")
    .eq("empresa_id", empresaId)
    .like("nome", `${MARCA}%`);
  for (const c of clientesEx ?? []) {
    await supabase.from("clientes").delete().eq("id", (c as any).id).eq("empresa_id", empresaId);
  }

  return { obras: ids.length, falhas };
}
