import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OBRA_STATUS_LABEL, OBRA_STATUS_LIST, OBRA_STATUS_COLOR, formatCurrency, type ObraStatus } from "@/lib/obra-helpers";

interface Props {
  porEtapa: Map<ObraStatus, { qtd: number; valor: number }>;
}

export function EtapasOverview({ porEtapa }: Props) {
  const max = Math.max(1, ...OBRA_STATUS_LIST.map((s) => porEtapa.get(s)?.qtd ?? 0));
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Obras por etapa</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {OBRA_STATUS_LIST.map((s) => {
            const v = porEtapa.get(s) ?? { qtd: 0, valor: 0 };
            const pct = (v.qtd / max) * 100;
            const color = OBRA_STATUS_COLOR[s];
            return (
              <div key={s} className="grid grid-cols-12 items-center gap-3 text-sm">
                <div className="col-span-4 flex items-center gap-2 truncate">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: `hsl(var(--${color}))` }} />
                  <span className="truncate text-foreground">{OBRA_STATUS_LABEL[s]}</span>
                </div>
                <div className="col-span-5">
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: `hsl(var(--${color}))` }} />
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
