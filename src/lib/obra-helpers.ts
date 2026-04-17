import type { Database } from "@/integrations/supabase/types";

export type ObraStatus = Database["public"]["Enums"]["obra_status"];
export type ObraOrigem = Database["public"]["Enums"]["obra_origem"];
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

export const ORIGEM_LABEL: Record<ObraOrigem, string> = {
  veman: "Veman",
  sabesp: "Sabesp",
};

export function formatCurrency(value: number | string | null | undefined) {
  const n = typeof value === "string" ? parseFloat(value) : value ?? 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n || 0);
}
