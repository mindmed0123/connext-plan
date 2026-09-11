/**
 * Lançamentos gerados automaticamente por outra tela só podem ser alterados
 * na tela de origem. Aqui fica o caminho de cada origem.
 */
export function abrirOrigemPath(origem?: string | null, obraId?: string | null): string | null {
  if (!origem) return null;
  switch (origem) {
    case "recebimento":
    case "recebimento_saldo":
    case "recebimento_pagamento":
      return "/recebimentos";
    case "cartao":
      return "/cartoes";
    case "material":
      return obraId ? `/obras/${obraId}?tab=materiais` : null;
    case "parcela_pagamento":
      return obraId ? `/obras/${obraId}?tab=contratacoes` : null;
    case "nota_fiscal":
    case "retencao_nf":
      return obraId ? `/obras/${obraId}?tab=faturamento` : "/faturamento";
    default:
      return obraId ? `/obras/${obraId}` : null;
  }
}

export const ORIGEM_LABEL: Record<string, string> = {
  recebimento: "Recebimento",
  recebimento_saldo: "Recebimento (saldo)",
  recebimento_pagamento: "Pagamento recebido",
  cartao: "Cartão",
  material: "Material",
  parcela_pagamento: "Parcela",
  nota_fiscal: "Nota fiscal",
  retencao_nf: "Retenções da NF",
};
