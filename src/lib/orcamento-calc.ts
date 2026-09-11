import { arredondar2 } from "@/lib/money";

/**
 * Regra ÚNICA de cálculo do orçamento — usada pelo formulário, pelo PDF e
 * espelhada no banco (função salvar_orcamento).
 *
 * 1. subtotal do item  = quantidade × preço unitário × (1 − desconto do item)
 * 2. subtotal geral    = soma dos itens
 * 3. desconto global   = subtotal geral × desconto_global_pct
 * 4. ISS               = por item, sobre o valor já com o desconto global
 * 5. total             = subtotal − desconto global + ISS
 */
export interface ItemCalculo {
  quantidade: number;
  preco_unitario: number;
  desconto_pct?: number | null;
  aliquota_iss?: number | null;
}

export interface TotaisOrcamento {
  subtotal: number;
  descGlobal: number;
  iss: number;
  total: number;
}

export function subtotalItem(i: ItemCalculo): number {
  return (
    (Number(i.quantidade) || 0) *
    (Number(i.preco_unitario) || 0) *
    (1 - (Number(i.desconto_pct) || 0) / 100)
  );
}

export function calcularTotaisOrcamento(
  itens: ItemCalculo[],
  descontoGlobalPct: number | null | undefined,
): TotaisOrcamento {
  const pct = Number(descontoGlobalPct) || 0;
  const subtotal = arredondar2(itens.reduce((s, i) => s + subtotalItem(i), 0));
  const descGlobal = arredondar2(subtotal * (pct / 100));
  const iss = arredondar2(
    itens.reduce(
      (s, i) =>
        s +
        arredondar2(
          subtotalItem(i) * (1 - pct / 100) * ((Number(i.aliquota_iss) || 0) / 100),
        ),
      0,
    ),
  );
  return { subtotal, descGlobal, iss, total: arredondar2(subtotal - descGlobal + iss) };
}
