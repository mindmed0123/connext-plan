import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/obra-helpers";
import { formatDateBR } from "@/lib/dashboard-helpers";
import type { DashboardData } from "@/hooks/useDashboardData";
import { Calendar } from "lucide-react";
import { parseDateString } from "@/lib/date";

export function AgendaRecebimentos({ data }: { data: DashboardData }) {
  const proximos = data.recebimentos
    .filter((r) => r.status === "a_receber" && r.data_prevista)
    .sort((a, b) => (parseDateString(a.data_prevista)?.getTime() ?? 0) - (parseDateString(b.data_prevista)?.getTime() ?? 0))
    .slice(0, 10);

  const obraMap = new Map(data.obras.map((o) => [o.id, o]));
  const nfsByObra = new Map<string, string[]>();
  for (const n of data.nfs) {
    const arr = nfsByObra.get(n.obra_id) ?? [];
    arr.push(n.numero_nf);
    nfsByObra.set(n.obra_id, arr);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4 text-success" />
          Agenda de recebimentos
        </CardTitle>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-muted/50 p-2">
            <p className="text-muted-foreground">Próximo dia 1 ({data.proximoDia1.toLocaleDateString("pt-BR")})</p>
            <p className="text-base font-semibold tabular-nums">{formatCurrency(data.totalDia1)}</p>
          </div>
          <div className="rounded-md bg-muted/50 p-2">
            <p className="text-muted-foreground">Próximo dia 15 ({data.proximoDia15.toLocaleDateString("pt-BR")})</p>
            <p className="text-base font-semibold tabular-nums">{formatCurrency(data.totalDia15)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {proximos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sem recebimentos previstos</p>
        ) : (
          <div className="space-y-1">
            {proximos.map((r) => {
              const o = obraMap.get(r.obra_id);
              const nf = (nfsByObra.get(r.obra_id) ?? []).slice(-1)[0];
              return (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted/40">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{o?.codigo_chamado ?? "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDateBR(r.data_prevista)} {nf && <>· NF {nf}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[11px]">A receber</Badge>
                    <span className="text-sm font-semibold tabular-nums">{formatCurrency(r.valor)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
