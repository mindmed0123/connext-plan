import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/obra-helpers";
import { formatDateBR } from "@/lib/dashboard-helpers";
import type { DashboardData } from "@/hooks/useDashboardData";
import { Wallet } from "lucide-react";

export function AgendaPagamentos({ data }: { data: DashboardData }) {
  const obraMap = new Map(data.obras.map((o) => [o.id, o]));
  const pessoaMap = new Map(data.pessoas.map((p) => [p.id, p]));
  const contratacaoMap = new Map(data.contratacoes.map((c) => [c.id, c]));

  const saldoByContratacao = new Map<string, number>();
  for (const c of data.contratacoes) saldoByContratacao.set(c.id, Number(c.valor_total));
  for (const p of data.parcelas) {
    if (p.status === "pago") {
      saldoByContratacao.set(
        p.contratacao_id,
        (saldoByContratacao.get(p.contratacao_id) ?? 0) - Number(p.valor),
      );
    }
  }

  const proximos = data.parcelas
    .filter((p) => p.status === "pendente" && p.data_prevista)
    .sort((a, b) => new Date(a.data_prevista!).getTime() - new Date(b.data_prevista!).getTime())
    .slice(0, 10);

  const hoje = new Date();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4 text-warning" />
          Pagamentos a terceirizados
        </CardTitle>
      </CardHeader>
      <CardContent>
        {proximos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sem parcelas pendentes</p>
        ) : (
          <div className="space-y-1">
            {proximos.map((p) => {
              const c = contratacaoMap.get(p.contratacao_id);
              const o = c ? obraMap.get(c.obra_id) : null;
              const t = c ? pessoaMap.get(c.terceirizado_id) : null;
              const atrasado = p.data_prevista && new Date(p.data_prevista) < hoje;
              const saldo = saldoByContratacao.get(p.contratacao_id) ?? 0;
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted/40">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t?.nome ?? "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {o?.codigo_chamado ?? "—"} · Parcela {p.numero_parcela} · {formatDateBR(p.data_prevista)}
                      <span className="ml-2 text-[10px]">Saldo: {formatCurrency(saldo)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {atrasado ? (
                      <Badge variant="destructive" className="text-[11px]">Atrasado</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[11px]">Pendente</Badge>
                    )}
                    <span className="text-sm font-semibold tabular-nums">{formatCurrency(p.valor)}</span>
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
