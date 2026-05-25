import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardData } from "@/hooks/useDashboardData";
import { OBRA_STATUS_LABEL, OBRA_STATUS_LIST, OBRA_STATUS_COLOR, formatCurrency, type ObraStatus } from "@/lib/obra-helpers";
import { shortMonthYear } from "@/lib/dashboard-helpers";
import { parseDateString } from "@/lib/date";

function buildMonthBuckets(months = 6) {
  const arr: { key: string; label: string; date: Date }[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: shortMonthYear(d), date: d });
  }
  return arr;
}

export function ChartsBlock({ data }: { data: DashboardData }) {
  const getMonthKey = (value?: string | null) => {
    const date = parseDateString(value);
    return date ? `${date.getUTCFullYear()}-${date.getUTCMonth()}` : null;
  };

  const porEtapaQtd = OBRA_STATUS_LIST.map((s) => ({
    etapa: OBRA_STATUS_LABEL[s].slice(0, 12),
    qtd: data.porEtapa.get(s)?.qtd ?? 0,
    valor: data.porEtapa.get(s)?.valor ?? 0,
    color: `hsl(var(--${OBRA_STATUS_COLOR[s as ObraStatus]}))`,
  }));

  const buckets = buildMonthBuckets(6);
  const recebidosMes = buckets.map((b) => {
    const total = data.recebimentos
      .filter((r) => getMonthKey(r.data_recebido) === `${b.date.getFullYear()}-${b.date.getMonth()}`)
      .reduce((s, r) => s + Number(r.valor), 0);
    const previsto = data.recebimentos
      .filter((r) => getMonthKey(r.data_prevista) === `${b.date.getFullYear()}-${b.date.getMonth()}`)
      .reduce((s, r) => s + Number(r.valor), 0);
    return { mes: b.label, recebido: total, previsto };
  });

  const pagosMes = buckets.map((b) => {
    const total = data.parcelas
      .filter((p) => p.status === "pago" && getMonthKey(p.data_pagamento) === `${b.date.getFullYear()}-${b.date.getMonth()}`)
      .reduce((s, p) => s + Number(p.valor), 0);
    return { mes: b.label, pago: total };
  });

  const evolucao = buckets.map((b) => {
    const abertas = data.obras.filter((o) => new Date(o.created_at).getFullYear() === b.date.getFullYear() && new Date(o.created_at).getMonth() === b.date.getMonth()).length;
    return { mes: b.label, abertas };
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Obras por etapa</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={porEtapaQtd} margin={{ top: 8, right: 8, bottom: 8, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="etapa" stroke="hsl(var(--muted-foreground))" fontSize={10} angle={-25} textAnchor="end" height={50} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="qtd" radius={[4, 4, 0, 0]}>
                {porEtapaQtd.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Valor por etapa</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={porEtapaQtd} margin={{ top: 8, right: 8, bottom: 8, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="etapa" stroke="hsl(var(--muted-foreground))" fontSize={10} angle={-25} textAnchor="end" height={50} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                {porEtapaQtd.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Recebimentos por mês</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={recebidosMes} margin={{ top: 8, right: 8, bottom: 8, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="previsto" fill="hsl(var(--muted-foreground) / 0.4)" radius={[4, 4, 0, 0]} name="Previsto" />
              <Bar dataKey="recebido" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} name="Recebido" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Pagamentos a terceirizados</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pagosMes} margin={{ top: 8, right: 8, bottom: 8, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="pago" stroke="hsl(var(--warning))" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
