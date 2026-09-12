// Status de obra agora são configuráveis por empresa (tabela obra_status_config).
// Este arquivo mantém apenas tipos genéricos, formatação e fallbacks de exibição.
export type ObraStatus = string;
export type ObraOrigem = string;
export type ObraRegiao = string;

const REGIAO_LABEL_FALLBACK: Record<string, string> = {
  leste: "Leste",
  oeste: "Oeste",
  norte: "Norte",
  sul: "Sul",
  interior: "Interior",
};

export const ORIGEM_LABEL: Record<string, string> = new Proxy(
  {} as Record<string, string>,
  { get: (target, key: string) => target[key] ?? key },
);

export function formatCurrency(value: number | string | null | undefined) {
  const n = typeof value === "string" ? parseFloat(value) : value ?? 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n || 0);
}

// Retorna o label de região de uma obra. Prefere regiao_label (texto livre);
// cai no valor legado para obras antigas.
export function getRegiaoLabel(obra: { regiao?: string | null; regiao_label?: string | null }): string {
  if (obra?.regiao_label) return obra.regiao_label;
  if (!obra?.regiao) return "—";
  return REGIAO_LABEL_FALLBACK[obra.regiao] ?? obra.regiao;
}
