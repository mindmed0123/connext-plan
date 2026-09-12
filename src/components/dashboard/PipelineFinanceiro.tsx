import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/obra-helpers";
import { useObraConfig } from "@/hooks/useObraConfig";
import type { DashboardData } from "@/hooks/useDashboardData";
import { ArrowRight } from "lucide-react";

export function PipelineFinanceiro({ data }: { data: DashboardData }) {
  const { statuses } = useObraConfig();
  const etapas = statuses.map((s) => {
    const v = data.porEtapa.get(s.chave);
    return { chave: s.chave, nome: s.nome, color: s.cor, qtd: v?.qtd ?? 0, valor: v?.valor ?? 0 };
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Pipeline financeiro</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {etapas.map((e, i) => (
            <div key={e.chave} className="relative">
              <div
                className="h-full rounded-lg border bg-card p-3 transition-all hover:shadow-md"
                style={{ borderTopWidth: 3, borderTopColor: e.color }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {e.nome}
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums">{e.qtd}</p>
                <p className="text-[11px] text-muted-foreground tabular-nums">{formatCurrency(e.valor)}</p>
              </div>
              {i < etapas.length - 1 && (
                <ArrowRight className="absolute -right-2 top-1/2 hidden h-3 w-3 -translate-y-1/2 text-muted-foreground xl:block" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
