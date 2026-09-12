import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, Download, FileText, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/obra-helpers";
import { formatDateBR } from "@/lib/date";
import { BUCKET_MEDICOES, MEDICAO_STATUS, MedicaoFormDialog } from "@/components/medicoes/MedicaoFormDialog";
import { FaturamentoFormDialog } from "@/components/financeiro/FaturamentoFormDialog";
import { arredondar2 } from "@/lib/money";

export function MedicoesPanel({ obraId }: { obraId?: string }) {
  const qc = useQueryClient();
  const { empresaId } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [nfPrefill, setNfPrefill] = useState<{ obraId: string; valor: number; medicaoId: string } | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: [empresaId, "medicoes", obraId ?? "todas"],
    queryFn: async () => {
      let q = supabase
        .from("medicoes")
        .select("*, obras(codigo_chamado), contratos_clientes(numero_contrato, valor_global, retencao_contratual_pct, retencao_devolucao_prevista)")
        .order("data_medicao", { ascending: false })
        .order("id");
      if (obraId) q = q.eq("obra_id", obraId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const ids = data.map((m: any) => m.id);
  const { data: nfs = [] } = useQuery({
    queryKey: [empresaId, "medicoes-nfs", obraId ?? "todas", ids.length],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("notas_fiscais")
        .select("id, numero_nf, valor_bruto, valor, medicao_id, recebimentos(status, valor_recebido)")
        .in("medicao_id", ids);
      return data ?? [];
    },
  });

  const nfDaMedicao = (id: string) => (nfs as any[]).find((n) => n.medicao_id === id);

  const mudarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase.from("medicoes").update({ status: status as any }).eq("id", id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Você não tem permissão para alterar esta medição.");
    },
    onSuccess: () => { toast.success("Medição atualizada"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar medição"),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from("medicoes").delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Você não tem permissão para excluir esta medição.");
    },
    onSuccess: () => { toast.success("Medição excluída"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir medição"),
  });

  const baixar = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET_MEDICOES).createSignedUrl(path, 60);
    if (error || !data) return toast.error("Não foi possível abrir o arquivo");
    window.open(data.signedUrl, "_blank");
  };

  const situacao = (m: any) => {
    const nf = nfDaMedicao(m.id);
    const recebido = (nf?.recebimentos ?? []).some((r: any) => r.status === "recebido");
    if (recebido) return { label: "Recebido", variant: "default" as const };
    if (nf) return { label: "Faturado", variant: "secondary" as const };
    if (m.status === "aprovada") return { label: "Medido", variant: "outline" as const };
    return { label: "—", variant: "outline" as const };
  };

  const gerarNf = (m: any) => {
    const pct = Number(m.contratos_clientes?.retencao_contratual_pct ?? 0);
    const bruto = Number(m.valor_medido ?? 0);
    const liquido = arredondar2(bruto - (bruto * pct) / 100);
    if (!m.obra_id) return toast.error("Vincule a medição a uma obra antes de gerar a NF.");
    setNfPrefill({ obraId: m.obra_id, valor: liquido, medicaoId: m.id });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Medições</h3>
          <p className="text-xs text-muted-foreground">Contrato → medição → nota fiscal → recebimento</p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" /> Nova medição
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              {!obraId && <TableHead>Obra</TableHead>}
              <TableHead>Contrato</TableHead>
              <TableHead>Referência</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Valor medido</TableHead>
              <TableHead className="text-right">Acumulado</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={10} className="text-sm text-muted-foreground">Carregando...</TableCell></TableRow>}
            {!isLoading && data.length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-sm text-muted-foreground">Nenhuma medição registrada.</TableCell></TableRow>
            )}
            {data.map((m: any) => {
              const s = situacao(m);
              const nf = nfDaMedicao(m.id);
              return (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.numero_medicao}</TableCell>
                  {!obraId && <TableCell>{m.obras?.codigo_chamado ?? "—"}</TableCell>}
                  <TableCell className="text-xs">{m.contratos_clientes?.numero_contrato ?? "s/nº"}</TableCell>
                  <TableCell className="text-xs">{m.referencia ?? "—"}</TableCell>
                  <TableCell className="text-xs">{formatDateBR(m.data_medicao)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(Number(m.valor_medido ?? 0))}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatCurrency(Number(m.valor_acumulado ?? 0))}
                    {m.percentual != null && <div className="text-[11px]">{Number(m.percentual).toFixed(1)}%</div>}
                  </TableCell>
                  <TableCell><Badge variant="secondary">{MEDICAO_STATUS[m.status] ?? m.status}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={s.variant}>{s.label}</Badge>
                    {nf && <div className="text-[11px] text-muted-foreground">NF {nf.numero_nf}</div>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {m.status === "rascunho" && (
                        <Button size="icon" variant="ghost" title="Enviar" onClick={() => mudarStatus.mutate({ id: m.id, status: "enviada" })}>
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                      {m.status !== "aprovada" && (
                        <Button size="icon" variant="ghost" title="Aprovar" onClick={() => mudarStatus.mutate({ id: m.id, status: "aprovada" })}>
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                      )}
                      {m.status !== "rejeitada" && (
                        <Button size="icon" variant="ghost" title="Rejeitar" onClick={() => mudarStatus.mutate({ id: m.id, status: "rejeitada" })}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                      {m.status === "aprovada" && !nf && (
                        <Button size="sm" variant="outline" onClick={() => gerarNf(m)}>
                          <FileText className="mr-1 h-4 w-4" /> Gerar NF
                        </Button>
                      )}
                      {m.arquivo_path && (
                        <Button size="icon" variant="ghost" title="Baixar boletim" onClick={() => baixar(m.arquivo_path)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(m); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => confirm("Excluir medição?") && excluir.mutate(m.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <MedicaoFormDialog open={open} onOpenChange={setOpen} obraId={obraId} medicao={editing} />
      <FaturamentoFormDialog
        tipo="nf"
        open={!!nfPrefill}
        onOpenChange={(v) => { if (!v) setNfPrefill(null); }}
        prefill={nfPrefill ?? undefined}
      />
    </div>
  );
}
