import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Briefcase } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { OBRA_STATUS_LABEL } from "@/lib/obra-helpers";

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const STATUS_COLOR: Record<string, string> = {
  pendente: "bg-warning/15 text-warning",
  parcialmente_pago: "bg-info/15 text-info",
  pago: "bg-success/15 text-success",
  cancelado: "bg-muted text-muted-foreground",
};

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  parcialmente_pago: "Parcial",
  pago: "Pago",
  cancelado: "Cancelado",
};

export function TerceirizadoObrasTab({ pessoaId }: { pessoaId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["terceirizado-obras", pessoaId],
    queryFn: async () => {
      const { data: contratacoes, error } = await supabase
        .from("contratacoes_terceirizado")
        .select(`
          id,
          valor_total,
          status_financeiro,
          quantidade_parcelas,
          observacoes,
          created_at,
          obra:obras!inner(id, codigo_chamado, descricao_servico, status, endereco),
          parcelas:parcelas_pagamento(valor, status, data_pagamento, data_prevista)
        `)
        .eq("terceirizado_id", pessoaId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return contratacoes ?? [];
    },
  });

  const totais = (data ?? []).reduce(
    (acc, c: any) => {
      const pago = (c.parcelas ?? [])
        .filter((p: any) => p.status === "pago")
        .reduce((s: number, p: any) => s + Number(p.valor || 0), 0);
      const total = Number(c.valor_total || 0);
      acc.contratado += total;
      acc.pago += pago;
      acc.pendente += Math.max(0, total - pago);
      return acc;
    },
    { contratado: 0, pago: 0, pendente: 0 },
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border bg-card p-8 text-muted-foreground">
        <Briefcase className="h-6 w-6" />
        <p className="text-xs">Nenhuma obra contratada para este terceirizado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Contratado</p>
          <p className="text-sm font-semibold">{formatBRL(totais.contratado)}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pago</p>
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            {formatBRL(totais.pago)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">A pagar</p>
          <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
            {formatBRL(totais.pendente)}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {data.map((c: any) => {
          const parcelas = c.parcelas ?? [];
          const pago = parcelas
            .filter((p: any) => p.status === "pago")
            .reduce((s: number, p: any) => s + Number(p.valor || 0), 0);
          const total = Number(c.valor_total || 0);
          const pendente = Math.max(0, total - pago);
          const proxima = parcelas
            .filter((p: any) => p.status !== "pago" && p.data_prevista)
            .sort((a: any, b: any) => a.data_prevista.localeCompare(b.data_prevista))[0];

          return (
            <div key={c.id} className="rounded-lg border bg-card p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{c.obra?.codigo_chamado}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {c.obra?.descricao_servico}
                  </p>
                  {c.obra?.endereco && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                      📍 {c.obra.endereco}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className={STATUS_COLOR[c.status_financeiro]}>
                  {STATUS_LABEL[c.status_financeiro]}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Mão de obra</p>
                  <p className="font-semibold">{formatBRL(total)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Pago</p>
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatBRL(pago)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">A pagar</p>
                  <p className="font-semibold text-amber-600 dark:text-amber-400">
                    {formatBRL(pendente)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[11px] text-muted-foreground border-t">
                <span>
                  {parcelas.filter((p: any) => p.status === "pago").length}/{parcelas.length} parcelas pagas
                </span>
                {proxima && (
                  <span>
                    Próx. vencimento:{" "}
                    <strong className="text-foreground">
                      {format(new Date(proxima.data_prevista), "dd/MM/yyyy")}
                    </strong>
                  </span>
                )}
                {c.obra?.status && (
                  <span>
                    Status obra:{" "}
                    <strong className="text-foreground">
                      {OBRA_STATUS_LABEL[c.obra.status as keyof typeof OBRA_STATUS_LABEL]}
                    </strong>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
