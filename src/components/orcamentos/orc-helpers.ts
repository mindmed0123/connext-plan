export const ORC_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  em_elaboracao: { label: "Em elaboração", className: "bg-muted text-foreground hover:bg-muted/80" },
  enviado: { label: "Enviado", className: "bg-blue-500/15 text-blue-700 border-blue-500/30 hover:bg-blue-500/20" },
  em_negociacao: { label: "Em negociação", className: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30 hover:bg-yellow-500/20" },
  aprovado: { label: "Aprovado", className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/20" },
  reprovado: { label: "Reprovado", className: "bg-red-500/15 text-red-700 border-red-500/30 hover:bg-red-500/20" },
};

export const ORC_STATUS_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "em_elaboracao", label: "Em elaboração" },
  { value: "enviado", label: "Enviado" },
  { value: "em_negociacao", label: "Em negociação" },
  { value: "aprovado", label: "Aprovado" },
  { value: "reprovado", label: "Reprovado" },
] as const;
