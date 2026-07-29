import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, FolderOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TIPO_INSTITUICAO_LABEL, TIPO_INSTITUICAO_LIST } from "@/lib/comprador-helpers";

type Comprador = {
  id: string; nome: string; cpf_cnpj: string | null; email: string | null;
  telefone: string | null; cargo: string | null; tipo_instituicao: string | null; ativo: boolean;
};

const empty = { nome: "", tipo_instituicao: "construtora", cpf_cnpj: "", email: "", telefone: "" };

export default function Compradores() {
  const { empresaId } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState(empty);
  const [busca, setBusca] = useState("");

  const { data: compradores = [] } = useQuery({
    queryKey: ["compradores-full", empresaId], enabled: !!empresaId,
    queryFn: async () => ((await (supabase.from("compradores" as any) as any).select("*").order("nome")).data as Comprador[]) ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.from("compradores" as any) as any).insert([{
        nome: form.nome.trim(),
        tipo_instituicao: form.tipo_instituicao,
        cpf_cnpj: form.cpf_cnpj || null,
        email: form.email || null,
        telefone: form.telefone || null,
      }]).select("id").single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data) => {
      toast.success("Comprador criado");
      qc.invalidateQueries({ queryKey: ["compradores"] });
      qc.invalidateQueries({ queryKey: ["compradores-full"] });
      setDialog(false); setForm(empty);
      if (data?.id) navigate(`/compradores/${data.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("compradores" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comprador removido");
      qc.invalidateQueries({ queryKey: ["compradores-full"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lista = compradores.filter((c) =>
    !busca.trim() || `${c.nome} ${c.cpf_cnpj ?? ""} ${c.email ?? ""}`.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Compradores</h1>
          <p className="text-sm text-muted-foreground">Cadastro completo, contratos e histórico de obras</p>
        </div>
        <Button onClick={() => { setForm(empty); setDialog(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Novo comprador
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome, CNPJ ou e-mail..." value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>CPF/CNPJ</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  <button className="text-left hover:underline" onClick={() => navigate(`/compradores/${c.id}`)}>{c.nome}</button>
                </TableCell>
                <TableCell><Badge variant="outline">{TIPO_INSTITUICAO_LABEL[c.tipo_instituicao ?? "outro"] ?? "Outro"}</Badge></TableCell>
                <TableCell>{c.cpf_cnpj ?? "—"}</TableCell>
                <TableCell>{c.email ?? "—"}</TableCell>
                <TableCell>{c.telefone ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" title="Abrir ficha" onClick={() => navigate(`/compradores/${c.id}`)}>
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => confirm("Excluir comprador?") && del.mutate(c.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {lista.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum comprador cadastrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo comprador</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label className="text-xs">Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><Label className="text-xs">Tipo de instituição</Label>
              <Select value={form.tipo_instituicao} onValueChange={(v) => setForm({ ...form, tipo_instituicao: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPO_INSTITUICAO_LIST.map((t) => <SelectItem key={t} value={t}>{TIPO_INSTITUICAO_LABEL[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">CPF/CNPJ</Label>
              <Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} /></div>
            <div><Label className="text-xs">Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label className="text-xs">Telefone</Label>
              <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={!form.nome || save.isPending}>Criar e abrir ficha</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
