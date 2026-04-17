import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { diffDays } from "@/lib/dashboard-helpers";
import type { DashboardData } from "@/hooks/useDashboardData";

interface Alert {
  id: string;
  titulo: string;
  detalhe: string;
  obraId?: string;
  severity: "high" | "medium" | "low";
}

export function AlertsList({ data }: { data: DashboardData }) {
  const alerts: Alert[] = [];

  // Heurística: obras com responsável vazio
  for (const o of data.obras) {
    const ids = data.responsibleByObra.get(o.id) ?? [];
    if (ids.length === 0) {
      alerts.push({
        id: `noresp-${o.id}`,
        titulo: `${o.codigo_chamado} sem responsável`,
        detalhe: o.endereco,
        obraId: o.id,
        severity: "high",
      });
    }
  }

  // Obras aprovadas há mais de 7 dias sem evolução para execução
  for (const o of data.obras) {
    if (o.status === "aprovado" && diffDays(o.updated_at) > 7) {
      alerts.push({
        id: `aprov-${o.id}`,
        titulo: `${o.codigo_chamado} aprovada sem início`,
        detalhe: `Parada há ${diffDays(o.updated_at)} dias`,
        obraId: o.id,
        severity: "medium",
      });
    }
  }

  // Em execução sem foto recente
  const fotosByObra = new Map<string, Date>();
  for (const f of data.fotos) {
    const cur = fotosByObra.get(f.obra_id);
    const d = new Date(f.data_upload);
    if (!cur || d > cur) fotosByObra.set(f.obra_id, d);
  }
  for (const o of data.obras) {
    if (o.status === "em_execucao") {
      const ult = fotosByObra.get(o.id);
      if (!ult || diffDays(ult) > 7) {
        alerts.push({
          id: `fotos-${o.id}`,
          titulo: `${o.codigo_chamado} sem fotos recentes`,
          detalhe: ult ? `Última foto há ${diffDays(ult)} dias` : "Nenhuma foto registrada",
          obraId: o.id,
          severity: "medium",
        });
      }
    }
  }

  // Aguardando RC / PC / NF
  for (const o of data.obras) {
    if (["aguardando_rc", "aguardando_pedido_compra", "aguardando_nf"].includes(o.status)) {
      const dias = diffDays(o.updated_at);
      if (dias > 5) {
        alerts.push({
          id: `etapa-${o.id}`,
          titulo: `${o.codigo_chamado} travada em ${o.status.replace(/_/g, " ")}`,
          detalhe: `Há ${dias} dias`,
          obraId: o.id,
          severity: "high",
        });
      }
    }
  }

  // NF emitida sem recebimento previsto
  const obraComRec = new Set(data.recebimentos.map((r) => r.obra_id));
  const obraComNF = new Set(data.nfs.map((n) => n.obra_id));
  for (const obraId of obraComNF) {
    if (!obraComRec.has(obraId)) {
      const o = data.obras.find((x) => x.id === obraId);
      if (o) {
        alerts.push({
          id: `nfsemrec-${obraId}`,
          titulo: `${o.codigo_chamado}: NF sem previsão de recebimento`,
          detalhe: "Cadastrar recebimento previsto",
          obraId,
          severity: "medium",
        });
      }
    }
  }

  // Pagamento de terceirizado atrasado
  const hoje = new Date();
  for (const p of data.parcelas) {
    if (p.status === "pendente" && p.data_prevista && new Date(p.data_prevista) < hoje) {
      const c = data.contratacoes.find((x) => x.id === p.contratacao_id);
      const o = c ? data.obras.find((x) => x.id === c.obra_id) : null;
      alerts.push({
        id: `parc-${p.id}`,
        titulo: `Pagamento atrasado${o ? ` — ${o.codigo_chamado}` : ""}`,
        detalhe: `Parcela vencida há ${diffDays(p.data_prevista)} dias`,
        obraId: o?.id,
        severity: "high",
      });
    }
  }

  alerts.sort((a, b) => (a.severity === "high" ? -1 : 1));
  const top = alerts.slice(0, 12);

  const sevColor = (s: Alert["severity"]) =>
    s === "high" ? "destructive" : s === "medium" ? "warning" : "muted-foreground";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Atenção imediata
        </CardTitle>
        <Badge variant="secondary">{alerts.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {top.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum alerta no momento ✨</p>
        )}
        {top.map((a) => (
          <Link
            key={a.id}
            to={a.obraId ? `/obras` : "/obras"}
            className="flex items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2 transition-colors hover:border-border hover:bg-muted/40"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: `hsl(var(--${sevColor(a.severity)}))` }}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{a.titulo}</p>
                <p className="truncate text-xs text-muted-foreground">{a.detalhe}</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
