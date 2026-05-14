import type { Database } from "@/integrations/supabase/types";

export type ObraStatus = Database["public"]["Enums"]["obra_status"];
export type ObraOrigem = string;
export type ObraRegiao = Database["public"]["Enums"]["obra_regiao"];

export const OBRA_STATUS_LIST: ObraStatus[] = [
  "recebido",
  "em_vistoria",
  "aguardando_orcamento",
  "em_aprovacao",
  "aprovado",
  "em_execucao",
  "finalizado",
  "aguardando_rc",
  "aguardando_pedido_compra",
  "aguardando_nf",
  "aguardando_pagamento",
  "pago",
];

export const OBRA_STATUS_LABEL: Record<ObraStatus, string> = {
  recebido: "Recebido",
  em_vistoria: "Em vistoria",
  aguardando_orcamento: "Aguardando orçamento",
  em_aprovacao: "Em aprovação",
  aprovado: "Aprovado",
  em_execucao: "Em execução",
  finalizado: "Finalizado",
  aguardando_rc: "Aguardando RC",
  aguardando_pedido_compra: "Aguardando PC",
  aguardando_nf: "Aguardando NF",
  aguardando_pagamento: "Aguardando pagamento",
  pago: "Pago",
};

// Map status to a semantic color token defined in tailwind.config.ts
export const OBRA_STATUS_COLOR: Record<ObraStatus, string> = {
  recebido: "status-recebido",
  em_vistoria: "status-vistoria",
  aguardando_orcamento: "status-orcamento",
  em_aprovacao: "status-aprovacao",
  aprovado: "status-aprovado",
  em_execucao: "status-execucao",
  finalizado: "status-finalizado",
  aguardando_rc: "status-rc",
  aguardando_pedido_compra: "status-pc",
  aguardando_nf: "status-nf",
  aguardando_pagamento: "status-pagamento",
  pago: "status-pago",
};

export const REGIAO_LABEL: Record<ObraRegiao, string> = {
  leste: "Leste",
  oeste: "Oeste",
  norte: "Norte",
  sul: "Sul",
  interior: "Interior",
};

// Origens agora são dinâmicas por empresa (tabela origens_obra).
// Esse mapa é mantido apenas como fallback de exibição.
const ORIGEM_LABEL_FALLBACK: Record<string, string> = {
  veman: "Veman",
  sabesp: "Sabesp",
};
export const ORIGEM_LABEL: Record<string, string> = new Proxy(ORIGEM_LABEL_FALLBACK, {
  get: (target, key: string) => target[key] ?? key,
});

export function formatCurrency(value: number | string | null | undefined) {
  const n = typeof value === "string" ? parseFloat(value) : value ?? 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n || 0);
}

// Retorna o label de região de uma obra. Prefere regiao_label (texto livre);
// cai no enum legado para obras antigas.
export function getRegiaoLabel(obra: { regiao?: string | null; regiao_label?: string | null }): string {
  if (obra?.regiao_label) return obra.regiao_label;
  if (!obra?.regiao) return "—";
  return (REGIAO_LABEL as Record<string, string>)[obra.regiao] ?? obra.regiao;
}
