import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/obra-helpers";
import { format, addDays, parseISO } from "date-fns";
import { Plus, Eye, Pencil, FileDown, Trash2 } from "lucide-react";
import { OrcamentoFormDialog } from "@/components/orcamentos/OrcamentoFormDialog";
import { OrcamentoDetailSheet } from "@/components/orcamentos/OrcamentoDetailSheet";
import { ORC_STATUS_BADGE, ORC_STATUS_OPTIONS } from "@/components/orcamentos/orc-helpers";
import { gerarOrcamentoPDF } from "@/lib/orcamento-pdf";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Orcamentos() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["all-orcamentos", statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("orcamentos")
        .select("*, obras(codigo_chamado)")
        .order("created_at", { ascending: false });
      if (statusFilter !== "todos") q = q.eq("status", statusFilter as never);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("orcamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-orcamentos"] });
      toast.success("Orçamento excluído");
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handlePDF = async (orcId: string) => {
    if (!empresaId) return;
    const [{ data: orc }, { data: itens }, { data: empresa }] = await Promise.all([
      supabase.from("orcamentos").select("*, obras(codigo_chamado)").eq("id", orcId).single(),
      supabase.from("orcamento_itens").select("*").eq("orcamento_id", orcId).order("ordem"),
      supabase.from("empresas").select("nome").eq("id", empresaId).single(),
    ]);
    if (!orc) return;
    gerarOrcamentoPDF(orc, itens ?? [], { nome: empresa?.nome ?? "Empresa", cnpj: null });
    toast.success("PDF gerado!");
  };

  const openDetail = (id: string) => { setDetailId(id); setDetailOpen(true); };
  const openEdit = (id: string | null) => { setEditingId(id); setFormOpen(true); setDetailOpen(false); };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Orçamentos</h1>
          <p className="text-sm text-muted-foreground">Propostas comerciais geradas pela empresa</p>
        </div>
        <Button onClick={() => openEdit(null)}>
          <Plus className="h-4 w-4" /> Novo orçamento
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Status:</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ORC_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-sm text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : (data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-sm text-muted-foreground">Nenhum orçamento</TableCell></TableRow>
            ) : data?.map((o) => {
              const validUntil = o.data_orcamento
                ? format(addDays(parseISO(o.data_orcamento), o.validade_dias ?? 30), "dd/MM/yyyy")
                : "—";
              const editable = o.status === "em_elaboracao" || o.status === "em_negociacao";
              const deletable = o.status === "em_elaboracao";
              return (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.numero_orcamento || "—"}</TableCell>
                  <TableCell className="max-w-xs truncate">{o.titulo || "—"}</TableCell>
                  <TableCell className="font-medium">{o.obras?.codigo_chamado}</TableCell>
                  <TableCell className="text-sm">{o.data_orcamento ? format(parseISO(o.data_orcamento), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{validUntil}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(Number(o.valor_orcamento))}</TableCell>
                  <TableCell>
                    <Badge className={ORC_STATUS_BADGE[o.status]?.className}>{ORC_STATUS_BADGE[o.status]?.label || o.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openDetail(o.id)} title="Visualizar">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {editable && (
                        <Button size="icon" variant="ghost" onClick={() => openEdit(o.id)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => handlePDF(o.id)} title="Gerar PDF">
                        <FileDown className="h-4 w-4" />
                      </Button>
                      {deletable && (
                        <Button size="icon" variant="ghost" onClick={() => setDeleteId(o.id)} title="Excluir">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <OrcamentoFormDialog open={formOpen} onOpenChange={setFormOpen} orcamentoId={editingId} />
      <OrcamentoDetailSheet
        orcamentoId={detailId} open={detailOpen} onOpenChange={setDetailOpen}
        onEdit={(id) => openEdit(id)}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir orçamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os itens serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && del.mutate(deleteId)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
