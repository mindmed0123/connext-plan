/**
 * Preço de composição a partir dos coeficientes — espelha a função
 * calc_preco_composicao do banco. Usado na árvore da tela.
 */

export interface InsumoBase {
  id: string;
  preco_unitario: number;
  /** histórico de preço por data de referência (yyyy-mm-dd) */
  precos?: { data_referencia: string; preco_unitario: number }[];
}

export interface ComposicaoBase {
  id: string;
  itens: {
    tipo: "insumo" | "composicao";
    insumo_id?: string | null;
    composicao_filha_id?: string | null;
    coeficiente: number;
  }[];
}

export const NIVEL_MAXIMO = 5;

export function precoInsumoNaData(insumo: InsumoBase, data?: string | null): number {
  if (!data) return Number(insumo.preco_unitario) || 0;
  const historico = (insumo.precos ?? [])
    .filter((p) => p.data_referencia <= data)
    .sort((a, b) => b.data_referencia.localeCompare(a.data_referencia));
  return historico.length ? Number(historico[0].preco_unitario) : Number(insumo.preco_unitario) || 0;
}

export function calcularPrecoComposicao(
  composicaoId: string,
  composicoes: Map<string, ComposicaoBase>,
  insumos: Map<string, InsumoBase>,
  data?: string | null,
  nivel = 1,
  visitados: string[] = [],
): number {
  const comp = composicoes.get(composicaoId);
  if (!comp) return 0;
  if (nivel > NIVEL_MAXIMO) {
    throw new Error("Composição com mais de 5 níveis de subcomposição");
  }
  if (visitados.includes(composicaoId)) {
    throw new Error("Referência circular na composição");
  }

  let total = 0;
  for (const item of comp.itens) {
    const coef = Number(item.coeficiente) || 0;
    if (item.tipo === "insumo") {
      const insumo = item.insumo_id ? insumos.get(item.insumo_id) : undefined;
      total += (insumo ? precoInsumoNaData(insumo, data) : 0) * coef;
    } else if (item.composicao_filha_id) {
      total +=
        calcularPrecoComposicao(item.composicao_filha_id, composicoes, insumos, data, nivel + 1, [
          ...visitados,
          composicaoId,
        ]) * coef;
    }
  }
  return Math.round(total * 10000) / 10000;
}
