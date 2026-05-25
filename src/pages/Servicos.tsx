import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Wrench, Power, Search } from "lucide-react";
import { ServicoFormDialog, type ServicoEdit } from "@/components/servicos/ServicoFormDialog";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/obra-helpers";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type CategoriaRow = { id: string; nome: string; cor: string };
type ServicoRow = {
  id: string; codigo: string | null; nome: string; descricao: string | null;
  unidade: string; preco_unitario: number; ativo: boolean;
  categoria_id: string | null; aliquota_iss: number | null;
  descricao_detalhada: string | null; categoria_id_label?: string | null;
  codigo_lc116: string | null; codigo_servico_municipio: string | null;
  codigo_nbs: string | null; iss_retido: boolean; tipo_tributacao: string;
  desconto_padrao_pct: number;
  categoria?: CategoriaRow | null;
};

export default function Servicos() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServicoEdit | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [catFilter, setCatFilter] = useState<string>("todas");
  const [statusFilter, setStatusFilter] = useState<string>("ativo");

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias-servico", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("categorias_servico")
        .select("id,nome,cor")
        .eq("ativo", true)
        .order("nome");
      return (data ?? []) as CategoriaRow[];
    },
  });

  const { data: servicos, isLoading } = useQuery({
    queryKey: ["servicos", empresaId, busca, catFilter, statusFilter],
    enabled: !!empresaId,
    queryFn: async () => {
      let q = supabase
        .from("servicos")
        .select("*, categoria:categorias_servico(id,nome,cor)")
        .order("codigo", { ascending: true });
      if (busca) q = q.or(`nome.ilike.%${busca}%,codigo.ilike.%${busca}%`);
      if (catFilter !== "todas") q = q.eq("categoria_id", catFilter);
      if (statusFilter !== "todos") q = q.eq("ativo", statusFilter === "ativo");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ServicoRow[];
    },
  });

  const toggleAtivo = useMutation({
    mutationFn: async (s: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("servicos").update({ ativo: !s.ativo }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["servicos"] });
      toast.success("Status atualizado");
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("servicos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["servicos"] });
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

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-56 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por código ou nome…" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas categorias</SelectItem>
            {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="w-24">Unidade</TableHead>
              <TableHead className="w-20 text-right">ISS%</TableHead>
              <TableHead className="text-right">Preço unit.</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-sm text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : (servicos?.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <Wrench className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum serviço encontrado.</p>
                </TableCell>
              </TableRow>
            ) : servicos?.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.codigo || "—"}</TableCell>
                <TableCell className="font-medium">{s.nome}</TableCell>
                <TableCell>
                  {s.categoria ? (
                    <Badge variant="outline" style={{ borderColor: s.categoria.cor, color: s.categoria.cor }}>
                      {s.categoria.nome}
                    </Badge>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="uppercase text-xs text-muted-foreground">{s.unidade}</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                  {s.aliquota_iss && Number(s.aliquota_iss) > 0 ? `${Number(s.aliquota_iss).toFixed(2)}%` : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(Number(s.preco_unitario))}</TableCell>
                <TableCell>
                  {s.ativo
                    ? <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 border-emerald-500/30">Ativo</Badge>
                    : <Badge variant="secondary">Inativo</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost"
                      onClick={() => { setEditing({ ...s }); setDialogOpen(true); }}>
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
