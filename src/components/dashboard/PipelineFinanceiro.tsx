import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, OBRA_STATUS_COLOR, type ObraStatus } from "@/lib/obra-helpers";
import { ETAPA_FINANCEIRA_LABEL, type EtapaFinanceira } from "@/lib/dashboard-helpers";
import type { DashboardData } from "@/hooks/useDashboardData";
import { ArrowRight } from "lucide-react";

const ETAPA_TO_STATUS: Record<EtapaFinanceira, ObraStatus[]> = {
  em_orcamento: ["aguardando_orcamento", "em_aprovacao"],
  aprovado: ["aprovado"],
  em_execucao: ["em_execucao"],
  finalizado: ["finalizado"],
  rc: ["aguardando_rc"],
  pedido_compra: ["aguardando_pedido_compra"],
  nf_emitida: ["aguardando_nf"],
  aguardando_pagamento: ["aguardando_pagamento"],
  recebido: ["pago"],
};

const ETAPA_COLOR: Record<EtapaFinanceira, ObraStatus> = {
  em_orcamento: "aguardando_orcamento",
  aprovado: "aprovado",
  em_execucao: "em_execucao",
  finalizado: "finalizado",
  rc: "aguardando_rc",
  pedido_compra: "aguardando_pedido_compra",
  nf_emitida: "aguardando_nf",
  aguardando_pagamento: "aguardando_pagamento",
  recebido: "pago",
};

export function PipelineFinanceiro({ data }: { data: DashboardData }) {
  const etapas = (Object.keys(ETAPA_FINANCEIRA_LABEL) as EtapaFinanceira[]).map((etapa) => {
    const statuses = ETAPA_TO_STATUS[etapa];
    let qtd = 0;
    let valor = 0;
    for (const s of statuses) {
      const v = data.porEtapa.get(s);
      if (v) {
        qtd += v.qtd;
        valor += v.valor;
      }
    }
    return { etapa, qtd, valor, color: OBRA_STATUS_COLOR[ETAPA_COLOR[etapa]] };
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Pipeline financeiro</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-9">
          {etapas.map((e, i) => (
            <div key={e.etapa} className="relative">
              <div
                className="h-full rounded-lg border bg-card p-3 transition-all hover:shadow-md"
                style={{ borderTopWidth: 3, borderTopColor: `hsl(var(--${e.color}))` }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {ETAPA_FINANCEIRA_LABEL[e.etapa]}
                </p>
                <p className="mt-2 text-lg font-semibold tabular-nums">{e.qtd}</p>
                <p className="text-[11px] text-muted-foreground tabular-nums">{formatCurrency(e.valor)}</p>
              </div>
              {i < etapas.length - 1 && (
                <ArrowRight className="absolute -right-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground/40 xl:block" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
