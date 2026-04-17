import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/obra-helpers";
import type { DashboardData } from "@/hooks/useDashboardData";

interface RowT {
  id: string;
  nome: string;
  obras: number;
  contratado: number;
  pago: number;
  pendentes: number;
}

export function RankingTerceirizados({ data }: { data: DashboardData }) {
  const map = new Map<string, RowT>();
  const pessoaMap = new Map(data.pessoas.map((p) => [p.id, p]));

  for (const c of data.contratacoes) {
    const p = pessoaMap.get(c.terceirizado_id);
    if (!p) continue;
    const cur = map.get(p.id) ?? { id: p.id, nome: p.nome, obras: 0, contratado: 0, pago: 0, pendentes: 0 };
    cur.obras += 1;
    cur.contratado += Number(c.valor_total);
    map.set(p.id, cur);
  }

  const contratacaoToTerc = new Map(data.contratacoes.map((c) => [c.id, c.terceirizado_id]));
  for (const par of data.parcelas) {
    const tid = contratacaoToTerc.get(par.contratacao_id);
    if (!tid) continue;
    const cur = map.get(tid);
    if (!cur) continue;
    if (par.status === "pago") cur.pago += Number(par.valor);
    else cur.pendentes += Number(par.valor);
  }

  const rows = Array.from(map.values()).sort((a, b) => b.contratado - a.contratado).slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Ranking de terceirizados</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sem contratações registradas</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 text-left font-medium">Terceirizado</th>
                  <th className="py-2 text-right font-medium">Obras</th>
                  <th className="py-2 text-right font-medium">Contratado</th>
                  <th className="py-2 text-right font-medium">Pago</th>
                  <th className="py-2 text-right font-medium">Pendente</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2 font-medium">{r.nome}</td>
                    <td className="py-2 text-right tabular-nums">{r.obras}</td>
                    <td className="py-2 text-right tabular-nums">{formatCurrency(r.contratado)}</td>
                    <td className="py-2 text-right tabular-nums text-success">{formatCurrency(r.pago)}</td>
                    <td className="py-2 text-right tabular-nums text-warning">{formatCurrency(r.pendentes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RankingResponsaveis({ data }: { data: DashboardData }) {
  const map = new Map<string, { id: string; nome: string; obras: number; finalizadas: number; valor: number }>();
  const pessoaMap = new Map(data.pessoas.map((p) => [p.id, p]));

  for (const o of data.obras) {
    const ids = data.responsibleByObra.get(o.id) ?? [];
    for (const pid of ids) {
      const p = pessoaMap.get(pid);
      if (!p || p.tipo === "terceirizado") continue;
      const cur = map.get(p.id) ?? { id: p.id, nome: p.nome, obras: 0, finalizadas: 0, valor: 0 };
      cur.obras += 1;
      if (["finalizado", "pago"].includes(o.status)) cur.finalizadas += 1;
      cur.valor += data.valorPorObra.get(o.id) ?? 0;
      map.set(p.id, cur);
    }
  }
  const rows = Array.from(map.values()).sort((a, b) => b.valor - a.valor).slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Ranking de responsáveis</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sem responsáveis vinculados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 text-left font-medium">Responsável</th>
                  <th className="py-2 text-right font-medium">Obras</th>
                  <th className="py-2 text-right font-medium">Finalizadas</th>
                  <th className="py-2 text-right font-medium">Valor gerido</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2 font-medium">{r.nome}</td>
                    <td className="py-2 text-right tabular-nums">{r.obras}</td>
                    <td className="py-2 text-right tabular-nums">{r.finalizadas}</td>
                    <td className="py-2 text-right tabular-nums">{formatCurrency(r.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
