import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { OBRA_STATUS_LABEL, OBRA_STATUS_COLOR, formatCurrency, REGIAO_LABEL, type ObraStatus } from "@/lib/obra-helpers";
import { formatDateBR } from "@/lib/dashboard-helpers";
import type { DashboardData } from "@/hooks/useDashboardData";

export function ObrasRecentes({ data }: { data: DashboardData }) {
  const recent = [...data.obras].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 8);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Obras recentes</CardTitle>
        <Link to="/obras" className="text-xs font-medium text-primary hover:underline">Ver todas →</Link>
      </CardHeader>
      <CardContent className="space-y-1">
        {recent.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma obra encontrada</p>}
        {recent.map((o) => {
          const color = OBRA_STATUS_COLOR[o.status as ObraStatus];
          return (
            <div key={o.id} className="grid grid-cols-12 items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted/40">
              <div className="col-span-3 truncate font-medium">{o.codigo_chamado}</div>
              <div className="col-span-2 truncate text-xs text-muted-foreground">{REGIAO_LABEL[o.regiao]}</div>
              <div className="col-span-3 truncate text-xs text-muted-foreground">{o.engenheiro_responsavel}</div>
              <div className="col-span-2">
                <Badge variant="outline" className="gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: `hsl(var(--${color}))` }} />
                  <span className="text-[11px]">{OBRA_STATUS_LABEL[o.status as ObraStatus]}</span>
                </Badge>
              </div>
              <div className="col-span-1 text-right text-xs tabular-nums">{formatCurrency(data.valorPorObra.get(o.id) ?? 0)}</div>
              <div className="col-span-1 text-right text-[11px] text-muted-foreground">{formatDateBR(o.updated_at)}</div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
