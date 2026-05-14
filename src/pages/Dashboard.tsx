import { useState } from "react";
import { Link } from "react-router-dom";
import {
  HardHat, FileText, Hammer, CheckCircle2, Wallet, TrendingUp, Receipt, Clock, AlertCircle,
} from "lucide-react";
import { useDashboardData, type DashboardFilters as TFilters } from "@/hooks/useDashboardData";
import { useUserRole } from "@/hooks/useUserRole";
import { formatCurrency } from "@/lib/obra-helpers";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { EtapasOverview } from "@/components/dashboard/EtapasOverview";
import { AlertsList } from "@/components/dashboard/AlertsList";
import { ObrasRecentes } from "@/components/dashboard/ObrasRecentes";
import { PipelineFinanceiro } from "@/components/dashboard/PipelineFinanceiro";
import { AgendaRecebimentos } from "@/components/dashboard/AgendaRecebimentos";
import { AgendaPagamentos } from "@/components/dashboard/AgendaPagamentos";
import { RankingTerceirizados, RankingResponsaveis } from "@/components/dashboard/Rankings";
import { ChartsBlock } from "@/components/dashboard/ChartsBlock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</h2>;
}

export default function Dashboard() {
  const { isOperacional, isSuperAdmin, isAdmin } = useUserRole();
  const [filters, setFilters] = useState<TFilters>({
    regiao: "todas", engenheiro: "todos", status: "todas", responsavelId: "todos", terceirizadoId: "todos",
  });
  const { data, isLoading } = useDashboardData(filters);

  // Visão simplificada para operacional/terceirizado
  if (isOperacional && !isAdmin && !isSuperAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Minhas obras</h1>
          <p className="text-sm text-muted-foreground">Acompanhe as obras atribuídas a você</p>
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">Acesso simplificado</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>Vá em <Link className="text-primary hover:underline" to="/obras">Obras</Link> para ver as obras em que você está envolvido.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const showRankings = isSuperAdmin || isAdmin;

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Carregando painel…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Painel executivo</h1>
          <p className="text-sm text-muted-foreground">Visão completa da operação e do financeiro</p>
        </div>
        <Link to="/obras" className="text-sm font-medium text-primary hover:underline">Ver todas as obras →</Link>
      </div>

      <DashboardFilters
        filters={filters}
        setFilters={setFilters}
        engenheiros={data?.engenheiros ?? []}
        pessoas={data?.pessoas ?? []}
      />

      {/* BLOCO 1 — Resumo executivo */}
      <section>
        <SectionTitle>Resumo executivo</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard title="Obras ativas" value={String(data?.totalAtivas ?? "—")} icon={HardHat} accent="primary" to="/obras" />
          <KpiCard title="Em orçamento" value={formatCurrency(data?.valorEmOrcamento)} hint="Aguardando aprovação" icon={FileText} accent="status-orcamento" to="/orcamentos" />
          <KpiCard title="Em execução" value={formatCurrency(data?.valorEmExecucao)} icon={Hammer} accent="status-execucao" to="/execucoes" />
          <KpiCard title="Finalizadas aguardando" value={formatCurrency(data?.valorFinalizadasAguard)} hint={`${data?.qtdFinalizadasAguard ?? 0} obras travadas`} icon={CheckCircle2} accent="status-finalizado" />
          <KpiCard title="Total a receber" value={formatCurrency(data?.valorAReceber)} icon={Wallet} accent="success" to="/recebimentos" />
          <KpiCard title="Recebimentos 15 dias" value={formatCurrency(data?.valorReceber15d)} icon={Clock} accent="info" to="/recebimentos" />
          <KpiCard title="Pago a terceirizados" value={formatCurrency(data?.valorPagoTerc)} icon={TrendingUp} accent="status-pago" to="/financeiro" />
          <KpiCard title="Pendente terceirizados" value={formatCurrency(data?.valorPendenteTerc)} icon={AlertCircle} accent="warning" to="/financeiro" />
        </div>
      </section>

      {/* BLOCO 2 — Operação */}
      <section>
        <SectionTitle>Operação</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2"><EtapasOverview porEtapa={data?.porEtapa ?? new Map()} /></div>
          <div><AlertsList data={data!} /></div>
        </div>
        <div className="mt-4"><ObrasRecentes data={data!} /></div>
      </section>

      {/* BLOCO 3 — Financeiro */}
      <section>
        <SectionTitle>Financeiro</SectionTitle>
        <div className="space-y-4">
          <PipelineFinanceiro data={data!} />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard title="Total orçado" value={formatCurrency(data?.valorTotalOrcado)} icon={FileText} accent="status-orcamento" />
            <KpiCard title="Total aprovado" value={formatCurrency(data?.valorTotalAprovado)} icon={CheckCircle2} accent="status-aprovado" />
            <KpiCard title="Total faturado (NF)" value={formatCurrency(data?.valorTotalFaturado)} icon={Receipt} accent="status-nf" />
            <KpiCard title="Total recebido" value={formatCurrency(data?.valorRecebido)} icon={Wallet} accent="status-pago" />
            <KpiCard title="Em aberto (faturado − recebido)" value={formatCurrency(data?.valorEmAberto)} icon={Clock} accent="warning" />
            <KpiCard title="Materiais (custo)" value={formatCurrency(data?.valorMateriais)} icon={Hammer} accent="status-pc" />
            <KpiCard title="Contratado terceirizados" value={formatCurrency(data?.valorContratadoTerc)} icon={HardHat} accent="primary" />
            <KpiCard title="Pago terceirizados" value={formatCurrency(data?.valorPagoTerc)} icon={TrendingUp} accent="success" />
            <KpiCard title="Pendente terceirizados" value={formatCurrency(data?.valorPendenteTerc)} icon={AlertCircle} accent="warning" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {data && <AgendaRecebimentos data={data} />}
            {data && <AgendaPagamentos data={data} />}
          </div>
        </div>
      </section>

      {/* BLOCO 4 — Performance */}
      {showRankings && (
        <section>
          <SectionTitle>Performance</SectionTitle>
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {data && <RankingTerceirizados data={data} />}
              {data && <RankingResponsaveis data={data} />}
            </div>
            {data && <ChartsBlock data={data} />}
          </div>
        </section>
      )}

      {isLoading && <p className="text-center text-xs text-muted-foreground">Carregando…</p>}
    </div>
  );
}
