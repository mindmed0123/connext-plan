import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Wrench, Power } from "lucide-react";
import { ServicoFormDialog, type ServicoEdit } from "@/components/servicos/ServicoFormDialog";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/obra-helpers";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Servicos() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServicoEdit | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: servicos, isLoading } = useQuery({
    queryKey: ["servicos", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("servicos")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const toggleAtivo = useMutation({
    mutationFn: async (s: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("servicos").update({ ativo: !s.ativo }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["servicos", empresaId] });
      toast.success("Status atualizado");
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("servicos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["servicos", empresaId] });
      toast.success("Serviço excluído");
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Serviços</h1>
          <p className="text-sm text-muted-foreground">Catálogo de serviços da empresa</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4" /> Novo serviço
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-right">Preço unit.</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : (servicos?.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <Wrench className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum serviço cadastrado. Adicione seu primeiro serviço.
                  </p>
                </TableCell>
              </TableRow>
            ) : servicos?.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.codigo || "—"}</TableCell>
                <TableCell className="font-medium">{s.nome}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{s.descricao || "—"}</TableCell>
                <TableCell>{s.unidade}</TableCell>
                <TableCell className="text-right">{formatCurrency(Number(s.preco_unitario))}</TableCell>
                <TableCell>
                  {s.ativo
                    ? <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 border-emerald-500/30">Ativo</Badge>
                    : <Badge variant="secondary">Inativo</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost"
                      onClick={() => { setEditing({ id: s.id, codigo: s.codigo, nome: s.nome, descricao: s.descricao, unidade: s.unidade, preco_unitario: Number(s.preco_unitario) }); setDialogOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => toggleAtivo.mutate({ id: s.id, ativo: s.ativo })}>
                      <Power className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteId(s.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ServicoFormDialog open={dialogOpen} onOpenChange={setDialogOpen} servico={editing} />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O serviço será removido permanentemente do catálogo.
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
