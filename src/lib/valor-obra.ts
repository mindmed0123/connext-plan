/**
 * Regra ÚNICA do valor de uma obra — usada no Painel, na lista de Obras e em
 * qualquer tela que mostre "quanto vale a obra".
 *
 * 1. Contrato com o cliente (não encerrado) + aditivos assinados.
 * 2. Sem contrato: orçamento aprovado (ou o mais recente) + aditivos assinados.
 */
export const ADENDO_ATIVO = ["assinado", "em_execucao", "concluido"];

export type FonteValor = "contrato" | "orcamento_aprovado" | "orcamento" | "aditivo" | null;

export interface OrcamentoValor {
  obra_id: string;
  status: string;
  valor_total?: number | null;
  valor_orcamento?: number | null;
  created_at?: string | null;
}
export interface AdendoValor { obra_id: string; status: string; valor_total?: number | null }
export interface ContratoValor { obra_id: string | null; status: string; valor_global?: number | null }

export interface ValorObra { valor: number; fonte: FonteValor }

const num = (v: unknown) => Number(v ?? 0) || 0;

export function calcularValoresObras(
  orcamentos: OrcamentoValor[],
  adendos: AdendoValor[],
  contratos: ContratoValor[],
): Map<string, ValorObra> {
  const contratoPorObra = new Map<string, number>();
  for (const c of contratos) {
    if (!c.obra_id || c.status === "encerrado") continue;
    contratoPorObra.set(c.obra_id, (contratoPorObra.get(c.obra_id) ?? 0) + num(c.valor_global));
  }

  const orcPorObra = new Map<string, { valor: number; aprovado: boolean; created: string }>();
  for (const o of orcamentos) {
    // valor_total pode vir zerado em orçamentos lançados só com valor: usa o que estiver preenchido
    const valor = num(o.valor_total) > 0 ? num(o.valor_total) : num(o.valor_orcamento);
    const aprovado = o.status === "aprovado";
    const created = o.created_at ?? "";
    const atual = orcPorObra.get(o.obra_id);
    if (!atual || (aprovado && !atual.aprovado) || (aprovado === atual.aprovado && created > atual.created)) {
      orcPorObra.set(o.obra_id, { valor, aprovado, created });
    }
  }

  const adendoPorObra = new Map<string, number>();
  for (const a of adendos) {
    if (!ADENDO_ATIVO.includes(a.status)) continue;
    adendoPorObra.set(a.obra_id, (adendoPorObra.get(a.obra_id) ?? 0) + num(a.valor_total));
  }

  const ids = new Set([...contratoPorObra.keys(), ...orcPorObra.keys(), ...adendoPorObra.keys()]);
  const out = new Map<string, ValorObra>();
  for (const id of ids) {
    const ad = adendoPorObra.get(id) ?? 0;
    if (contratoPorObra.has(id)) {
      out.set(id, { valor: contratoPorObra.get(id)! + ad, fonte: "contrato" });
    } else if (orcPorObra.has(id)) {
      const o = orcPorObra.get(id)!;
      out.set(id, { valor: o.valor + ad, fonte: o.aprovado ? "orcamento_aprovado" : "orcamento" });
    } else {
      out.set(id, { valor: ad, fonte: "aditivo" });
    }
  }
  return out;
}

/** Valor "fechado" (vendido): contrato ou orçamento aprovado — não conta orçamento em negociação. */
export function valorFechado(v: ValorObra | undefined): number {
  if (!v) return 0;
  return v.fonte === "orcamento" ? 0 : v.valor;
}
