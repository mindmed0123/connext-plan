import { Link } from "react-router-dom";
import { ChevronRight, FileText, FileSignature, Hammer, Ruler, Receipt, Wallet, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/obra-helpers";
import { useModulos } from "@/hooks/useModulos";
import { useObraConfig } from "@/hooks/useObraConfig";
import type { DashboardData } from "@/hooks/useDashboardData";

interface Etapa {
  n: number;
  titulo: string;
  valor: number;
  detalhe: string;
  to: string;
  icon: LucideIcon;
  accent: string;
  modulo?: string;
}

/**
 * Fluxo da obra, etapa por etapa — cada número vem do mesmo cálculo das telas
 * de origem e leva direto à tela onde ele nasce.
 */
export function FluxoObra({ data }: { data: DashboardData }) {
  const { moduloAtivo } = useModulos();
  const { rotulos } = useObraConfig();
  const plural = (rotulos.obra_plural ?? "obras").toLowerCase();

  const porCategoria = (cat: string) => {
    let qtd = 0;
    let valor = 0;
    for (const o of data.obras) {
      if (data.statusCategoria.get(o.status) !== cat) continue;
      qtd += 1;
      valor += data.valorPorObra.get(o.id) ?? 0;
    }
    return { qtd, valor };
  };
  const naoIniciadas = porCategoria("nao_iniciada");
  const execucao = porCategoria("em_execucao");
  const concluidas = porCategoria("concluida");
  const qtdFechadas = data.obras.filter((o) => {
    const v = data.valoresObra.get(o.id);
    return v && v.fonte !== "orcamento";
  }).length;

  const etapas: Etapa[] = [
    { n: 1, titulo: "Em negociação", valor: naoIniciadas.valor, detalhe: `${naoIniciadas.qtd} ${plural} antes da execução`, to: "/obras?etapa=nao_iniciada", icon: FileText, accent: "status-orcamento" },
    { n: 2, titulo: "Fechado (contrato/aprovado)", valor: data.valorTotalAprovado, detalhe: `${qtdFechadas} ${plural} com valor fechado`, to: "/contratos", icon: FileSignature, accent: "status-aprovado", modulo: "contratos" },
    { n: 3, titulo: "Em execução", valor: execucao.valor, detalhe: `${execucao.qtd} ${plural} em andamento`, to: "/obras?etapa=em_execucao", icon: Hammer, accent: "status-execucao" },
    { n: 4, titulo: "Medido", valor: data.valorMedido, detalhe: "Medições enviadas e aprovadas", to: "/medicoes", icon: Ruler, accent: "info", modulo: "medicoes" },
    { n: 5, titulo: "Faturado (NF)", valor: data.valorTotalFaturado, detalhe: `${concluidas.qtd} ${plural} concluídas`, to: "/faturamento", icon: Receipt, accent: "status-nf", modulo: "faturamento" },
    { n: 6, titulo: "Recebido", valor: data.valorRecebido, detalhe: "Dinheiro que já entrou", to: "/recebimentos", icon: Wallet, accent: "status-pago", modulo: "recebimentos" },
    { n: 7, titulo: "A receber", valor: data.valorAReceber, detalhe: "Ainda falta entrar", to: "/recebimentos", icon: Clock, accent: "warning", modulo: "recebimentos" },
  ];

  const visiveis = etapas.filter((e) => !e.modulo || moduloAtivo(e.modulo as never));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Fluxo da obra — do orçamento ao dinheiro no caixa</CardTitle>
        <p className="text-xs text-muted-foreground">
          Cada etapa usa os mesmos números das telas de origem. Mudou o status, o contrato, a medição ou o recebimento, o painel atualiza na hora.
        </p>
      </CardHeader>
      <CardContent>
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {visiveis.map((e, i) => {
            const Icon = e.icon;
            return (
              <li key={e.n} className="relative">
                <Link
                  to={e.to}
                  className="group flex h-full flex-col rounded-lg border bg-card p-3 transition-all hover:-translate-y-0.5 hover:shadow-md"
                  style={{ borderTopWidth: 3, borderTopColor: `hsl(var(--${e.accent}))` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {i + 1}. {e.titulo}
                    </span>
                    <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: `hsl(var(--${e.accent}))` }} />
                  </div>
                  <p className="mt-2 truncate text-lg font-bold tabular-nums">{formatCurrency(e.valor)}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{e.detalhe}</p>
                  <span className="mt-auto pt-2 text-[11px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Abrir →
                  </span>
                </Link>
                {i < visiveis.length - 1 && (
                  <ChevronRight className="absolute -right-2.5 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground xl:block" />
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
