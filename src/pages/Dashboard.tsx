import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  HardHat, FileText, Hammer, CheckCircle2, Receipt, Wallet, AlertCircle, TrendingUp,
} from "lucide-react";
import { formatCurrency } from "@/lib/obra-helpers";
import { Link } from "react-router-dom";

function StatCard({
  title, value, hint, icon: Icon, accent = "primary",
}: { title: string; value: string; hint?: string; icon: any; accent?: string }) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{
            backgroundColor: `hsl(var(--${accent}) / 0.10)`,
            color: `hsl(var(--${accent}))`,
          }}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [obras, orcamentos, pcs, nfs, recebimentos] = await Promise.all([
        supabase.from("obras").select("id,status"),
        supabase.from("orcamentos").select("valor_orcamento,status"),
        supabase.from("pedidos_compra").select("valor,status"),
        supabase.from("notas_fiscais").select("valor"),
        supabase.from("recebimentos").select("valor,status,data_prevista"),
      ]);

      const obrasData = obras.data || [];
      const orcs = orcamentos.data || [];
      const pcsData = pcs.data || [];
      const nfsData = nfs.data || [];
      const recs = recebimentos.data || [];

      const inEx = obrasData.filter((o) => o.status === "em_execucao").length;
      const finalizadas = obrasData.filter((o) => o.status === "finalizado").length;
      const aguardandoOrc = obrasData.filter((o) => o.status === "aguardando_orcamento").length;
      const aguardandoAprov = obrasData.filter((o) => o.status === "em_aprovacao").length;

      const totalOrcPendente = orcs
        .filter((o) => ["enviado", "em_negociacao"].includes(o.status as string))
        .reduce((s, o) => s + Number(o.valor_orcamento || 0), 0);

      const totalPC = pcsData.reduce((s, o) => s + Number(o.valor || 0), 0);
      const totalNF = nfsData.reduce((s, o) => s + Number(o.valor || 0), 0);

      const hoje = new Date();
      const em15 = new Date();
      em15.setDate(hoje.getDate() + 15);
      const aReceber = recs
        .filter((r) => r.status === "a_receber" && r.data_prevista && new Date(r.data_prevista) <= em15)
        .reduce((s, r) => s + Number(r.valor || 0), 0);

      return {
        totalObras: obrasData.length,
        inEx,
        finalizadas,
        aguardandoOrc,
        aguardandoAprov,
        totalOrcPendente,
        totalPC,
        totalNF,
        aReceber,
      };
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Visão geral</h1>
          <p className="text-sm text-muted-foreground">Resumo operacional e financeiro das obras</p>
        </div>
        <Link to="/obras" className="text-sm font-medium text-primary hover:underline">
          Ver todas as obras →
        </Link>
      </div>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Operacional</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total de obras" value={String(data?.totalObras ?? "—")} icon={HardHat} accent="primary" />
          <StatCard title="Em execução" value={String(data?.inEx ?? "—")} icon={Hammer} accent="status-execucao" />
          <StatCard title="Aguardando orçamento" value={String(data?.aguardandoOrc ?? "—")} icon={FileText} accent="status-orcamento" />
          <StatCard title="Em aprovação" value={String(data?.aguardandoAprov ?? "—")} icon={AlertCircle} accent="status-aprovacao" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Financeiro</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Orçamentos pendentes" value={formatCurrency(data?.totalOrcPendente)} icon={FileText} accent="status-orcamento" />
          <StatCard title="Pedidos de compra" value={formatCurrency(data?.totalPC)} icon={Receipt} accent="status-pc" />
          <StatCard title="Faturado (NF)" value={formatCurrency(data?.totalNF)} icon={TrendingUp} accent="status-nf" />
          <StatCard title="A receber em 15 dias" value={formatCurrency(data?.aReceber)} icon={Wallet} accent="success" />
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximos passos</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>• Cadastre uma obra em <Link className="text-primary hover:underline" to="/obras">Obras</Link></p>
          <p>• Acompanhe o pipeline visual em <Link className="text-primary hover:underline" to="/kanban">Kanban</Link></p>
          <p>• Registre vistoria, orçamento, execução e fotos diretamente no detalhe da obra</p>
        </CardContent>
      </Card>
    </div>
  );
}
