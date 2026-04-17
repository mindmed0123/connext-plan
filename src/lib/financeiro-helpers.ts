import type { Database } from "@/integrations/supabase/types";

export type ContratacaoStatus = Database["public"]["Enums"]["contratacao_status"];
export type ParcelaStatus = Database["public"]["Enums"]["parcela_status"];
export type FormaPagamento = Database["public"]["Enums"]["forma_pagamento"];

export const CONTRATACAO_STATUS_LABEL: Record<ContratacaoStatus, string> = {
  pendente: "Pendente",
  parcialmente_pago: "Parcialmente pago",
  pago: "Pago",
  cancelado: "Cancelado",
};

export const CONTRATACAO_STATUS_COLOR: Record<ContratacaoStatus, string> = {
  pendente: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  parcialmente_pago: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  pago: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  cancelado: "bg-muted text-muted-foreground border-border",
};

export const PARCELA_STATUS_LABEL: Record<ParcelaStatus, string> = {
  pendente: "Pendente",
  pago: "Pago",
};

export const FORMA_PAGAMENTO_LABEL: Record<FormaPagamento, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  boleto: "Boleto",
  outro: "Outro",
};

export const FORMA_PAGAMENTO_LIST: FormaPagamento[] = ["pix", "transferencia", "boleto", "dinheiro", "outro"];
