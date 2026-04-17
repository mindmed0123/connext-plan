import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet, TrendingUp, AlertCircle, Clock, Search, ExternalLink, Hammer, CheckCircle2, FileText } from "lucide-react";
import { format, addDays, isBefore } from "date-fns";
import { formatCurrency } from "@/lib/obra-helpers";
import {
  CONTRATACAO_STATUS_COLOR,
  CONTRATACAO_STATUS_LABEL,
  FORMA_PAGAMENTO_LABEL,
} from "@/lib/financeiro-helpers";
import { cn } from "@/lib/utils";
import { ObraDetailSheet } from "@/components/obras/ObraDetailSheet";

export default function Financeiro() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [terceirizadoFilter, setTerceirizadoFilter] = useState<string>("all");
  const [obraId, setObraId] = useState<string | null>(null);

  const { data: contratacoes } = useQuery({
    queryKey: ["financeiro-contratacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratacoes_terceirizado")
        .select("*, pessoas:terceirizado_id(id, nome), obras(id, codigo_chamado, descricao_servico), parcelas_pagamento(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: terceirizados } = useQuery({
    queryKey: ["pessoas-terceirizados-list"],
    queryFn: async () => {
      const { data } = await supabase.from("pessoas").select("id, nome").eq("tipo", "terceirizado").order("nome");
      return data ?? [];
    },
  });

  const { data: obrasStats } = useQuery({
    queryKey: ["financeiro-obras-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("obras").select("id, status");
      return data ?? [];
    },
  });

  const { data: orcamentosStats } = useQuery({
    queryKey: ["financeiro-orcamentos-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("orcamentos").select("id, status");
      return data ?? [];
    },
  });

  const operacaoStats = useMemo(() => {
    const obras = obrasStats ?? [];
    const orcamentos = orcamentosStats ?? [];
    const emExecucao = obras.filter((o: any) => o.status === "em_execucao").length;
    const finalizadas = obras.filter((o: any) => o.status === "finalizado" || o.status === "pago").length;
    const orcamentosPendentes = orcamentos.filter((o: any) =>
      ["em_elaboracao", "enviado", "em_negociacao"].includes(o.status)
    ).length;
    return { emExecucao, finalizadas, orcamentosPendentes };
  }, [obrasStats, orcamentosStats]);

  const stats = useMemo(() => {
    const list = contratacoes ?? [];
    const totalContratado = list.reduce((s, c: any) => s + Number(c.valor_total), 0);
    const allParcelas = list.flatMap((c: any) => c.parcelas_pagamento ?? []);
    const totalPago = allParcelas.filter((p: any) => p.status === "pago").reduce((s, p: any) => s + Number(p.valor), 0);
    const totalPendente = totalContratado - totalPago;
    const limite = addDays(new Date(), 7);
    const proximas = allParcelas.filter((p: any) => p.status === "pendente" && p.data_prevista && isBefore(new Date(p.data_prevista), limite));
    const proximasValor = proximas.reduce((s, p: any) => s + Number(p.valor), 0);
    const parcial = list.filter((c: any) => c.status_financeiro === "parcialmente_pago").length;
    const pendentes = list.filter((c: any) => c.status_financeiro === "pendente").length;
    return { totalContratado, totalPago, totalPendente, proximas: proximas.length, proximasValor, parcial, pendentes };
  }, [contratacoes]);

  const filtered = useMemo(() => {
    return (contratacoes ?? []).filter((c: any) => {
      if (statusFilter !== "all" && c.status_financeiro !== statusFilter) return false;
      if (terceirizadoFilter !== "all" && c.terceirizado_id !== terceirizadoFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const match =
          c.obras?.codigo_chamado?.toLowerCase().includes(s) ||
          c.obras?.descricao_servico?.toLowerCase().includes(s) ||
          c.pessoas?.nome?.toLowerCase().includes(s);
        if (!match) return false;
      }
      return true;
    });
  }, [contratacoes, statusFilter, terceirizadoFilter, search]);

  const proximasParcelas = useMemo(() => {
    const limite = addDays(new Date(), 14);
    return (contratacoes ?? [])
      .flatMap((c: any) => (c.parcelas_pagamento ?? []).map((p: any) => ({ ...p, contratacao: c })))
      .filter((p: any) => p.status === "pendente" && p.data_prevista && isBefore(new Date(p.data_prevista), limite))
      .sort((a: any, b: any) => new Date(a.data_prevista).getTime() - new Date(b.data_prevista).getTime());
  }, [contratacoes]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Financeiro</h1>
        <p className="text-sm text-muted-foreground">Pagamentos a terceirizados, parcelas e pendências por obra</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total contratado" value={formatCurrency(stats.totalContratado)} icon={Wallet} tone="muted" />
        <StatCard label="Total pago" value={formatCurrency(stats.totalPago)} icon={TrendingUp} tone="emerald" />
        <StatCard label="Total pendente" value={formatCurrency(stats.totalPendente)} icon={AlertCircle} tone="amber" />
        <StatCard
          label="Próximos 7 dias"
          value={formatCurrency(stats.proximasValor)}
          sub={`${stats.proximas} parcela${stats.proximas !== 1 ? "s" : ""}`}
          icon={Clock}
          tone="blue"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          label="Obras em execução"
          value={String(operacaoStats.emExecucao)}
          sub={`${operacaoStats.emExecucao === 1 ? "obra ativa" : "obras ativas"}`}
          icon={Hammer}
          tone="blue"
        />
        <StatCard
          label="Obras finalizadas"
          value={String(operacaoStats.finalizadas)}
          sub="concluídas ou pagas"
          icon={CheckCircle2}
          tone="emerald"
        />
        <StatCard
          label="Orçamentos pendentes"
          value={String(operacaoStats.orcamentosPendentes)}
          sub="aguardando aprovação"
          icon={FileText}
          tone="amber"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-8 h-9" placeholder="Buscar por obra ou terceirizado" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="parcialmente_pago">Parcialmente pago</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={terceirizadoFilter} onValueChange={setTerceirizadoFilter}>
              <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos terceirizados</SelectItem>
                {terceirizados?.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Obra</TableHead>
                  <TableHead>Terceirizado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Pago</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Nenhuma contratação encontrada</TableCell></TableRow>
                )}
                {filtered.map((c: any) => {
                  const pago = (c.parcelas_pagamento ?? []).filter((p: any) => p.status === "pago").reduce((s: number, p: any) => s + Number(p.valor), 0);
                  const saldo = Number(c.valor_total) - pago;
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{c.obras?.codigo_chamado}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{c.obras?.descricao_servico}</div>
                      </TableCell>
                      <TableCell className="text-sm">{c.pessoas?.nome}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatCurrency(c.valor_total)}</TableCell>
                      <TableCell className="text-right text-sm text-emerald-700 dark:text-emerald-300">{formatCurrency(pago)}</TableCell>
                      <TableCell className="text-right text-sm text-amber-700 dark:text-amber-300">{formatCurrency(saldo)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[10px]", CONTRATACAO_STATUS_COLOR[c.status_financeiro as keyof typeof CONTRATACAO_STATUS_COLOR])}>
                          {CONTRATACAO_STATUS_LABEL[c.status_financeiro as keyof typeof CONTRATACAO_STATUS_LABEL]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setObraId(c.obra_id)} title="Abrir obra">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Próximas parcelas (14 dias)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {proximasParcelas.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma parcela vencendo nos próximos 14 dias.</p>
            )}
            {proximasParcelas.slice(0, 12).map((p: any) => (
              <button
                key={p.id}
                onClick={() => setObraId(p.contratacao.obra_id)}
                className="w-full text-left rounded-md border p-2 hover:bg-muted/50 transition"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{p.contratacao.obras?.codigo_chamado}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{p.contratacao.pessoas?.nome}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold">{formatCurrency(p.valor)}</p>
                    <p className="text-[10px] text-muted-foreground">{format(new Date(p.data_prevista), "dd/MM")}</p>
                  </div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <ObraDetailSheet obraId={obraId} onClose={() => setObraId(null)} />
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, tone }: { label: string; value: string; sub?: string; icon: any; tone: "muted" | "emerald" | "amber" | "blue" }) {
  const toneCls = {
    muted: "bg-muted/50 text-muted-foreground",
    emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    blue: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-semibold mt-1">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={cn("h-8 w-8 rounded-md flex items-center justify-center", toneCls)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
