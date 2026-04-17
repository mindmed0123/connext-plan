import type { ObraStatus } from "./obra-helpers";

export type EtapaFinanceira =
  | "em_orcamento"
  | "aprovado"
  | "em_execucao"
  | "finalizado"
  | "rc"
  | "pedido_compra"
  | "nf_emitida"
  | "aguardando_pagamento"
  | "recebido";

export const ETAPA_FINANCEIRA_LABEL: Record<EtapaFinanceira, string> = {
  em_orcamento: "Em orçamento",
  aprovado: "Aprovado",
  em_execucao: "Em execução",
  finalizado: "Finalizado",
  rc: "RC",
  pedido_compra: "Pedido de compra",
  nf_emitida: "NF emitida",
  aguardando_pagamento: "Aguardando pagamento",
  recebido: "Recebido",
};

export const STATUS_EM_ORCAMENTO: ObraStatus[] = [
  "aguardando_orcamento",
  "em_aprovacao",
];
export const STATUS_EM_EXECUCAO: ObraStatus[] = ["aprovado", "em_execucao"];
export const STATUS_FINALIZADAS_AGUARD: ObraStatus[] = [
  "finalizado",
  "aguardando_rc",
  "aguardando_pedido_compra",
  "aguardando_nf",
  "aguardando_pagamento",
];

export function diffDays(from: string | Date, to: Date = new Date()) {
  const d1 = typeof from === "string" ? new Date(from) : from;
  return Math.floor((to.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDateBR(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

export function shortMonthYear(d: Date) {
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}
