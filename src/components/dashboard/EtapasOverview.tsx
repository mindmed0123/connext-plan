import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/obra-helpers";
import { useObraConfig } from "@/hooks/useObraConfig";

interface Props {
  porEtapa: Map<string, { qtd: number; valor: number }>;
}

export function EtapasOverview({ porEtapa }: Props) {
  const { statuses, rotulos } = useObraConfig();
  const max = Math.max(1, ...statuses.map((s) => porEtapa.get(s.chave)?.qtd ?? 0));
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{rotulos.obra_plural} por etapa</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {statuses.map((s) => {
            const v = porEtapa.get(s.chave) ?? { qtd: 0, valor: 0 };
            const pct = (v.qtd / max) * 100;
            return (
              <div key={s.chave} className="grid grid-cols-12 items-center gap-3 text-sm">
                <div className="col-span-4 flex items-center gap-2 truncate">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.cor }} />
                  <span className="truncate text-foreground">{s.nome}</span>
                </div>
                <div className="col-span-5">
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: s.cor }} />
                  </div>
                </div>
                <div className="col-span-1 text-right text-sm font-semibold tabular-nums">{v.qtd}</div>
                <div className="col-span-2 text-right text-xs text-muted-foreground tabular-nums">{formatCurrency(v.valor)}</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
