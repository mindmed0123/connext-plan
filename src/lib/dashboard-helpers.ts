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


/** Converte string em Date; datas puras 'YYYY-MM-DD' viram meio-dia local (evita cair no dia anterior). */
function toLocalDate(value: string | Date): Date {
  if (typeof value !== "string") return value;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  return new Date(value);
}

export function diffDays(from: string | Date, to: Date = new Date()) {
  const d1 = toLocalDate(from);
  return Math.floor((to.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDateBR(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = toLocalDate(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

export function shortMonthYear(d: Date) {
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}
