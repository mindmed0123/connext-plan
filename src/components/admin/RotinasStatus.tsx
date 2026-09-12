import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ROTINAS: { chave: string; nome: string; quando: string }[] = [
  { chave: "process-email-queue", nome: "Fila de e-mails", quando: "Imediato ao enfileirar + conferência a cada hora" },
  { chave: "notificacoes-agenda", nome: "Resumo de prazos", quando: "Todo dia às 7h (Brasília)" },
  { chave: "send-trial-reminders", nome: "Lembrete de fim de teste", quando: "Todo dia às 10h (Brasília)" },
];

const quandoFoi = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";

export function RotinasStatus() {
  const { data } = useQuery({
    queryKey: ["admin-rotinas"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rotina_execucoes")
        .select("rotina, ultima_execucao, ultimo_status, execucoes");
      if (error) throw error;
      return data ?? [];
    },
  });

  const porChave = new Map((data ?? []).map((r) => [r.rotina, r]));

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Clock className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Rotinas automáticas</h2>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rotina</TableHead>
            <TableHead>Agenda</TableHead>
            <TableHead>Última execução</TableHead>
            <TableHead>Situação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROTINAS.map((r) => {
            const reg = porChave.get(r.chave);
            const ok = reg?.ultimo_status === "disparada";
            return (
              <TableRow key={r.chave}>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.quando}</TableCell>
                <TableCell className="text-xs tabular-nums">{quandoFoi(reg?.ultima_execucao)}</TableCell>
                <TableCell>
                  <Badge variant={reg ? (ok ? "default" : "destructive") : "secondary"}>
                    {reg ? (ok ? "Rodando" : "Com erro") : "Sem registro ainda"}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
