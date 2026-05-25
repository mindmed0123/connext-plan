import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Pencil, Trash2, History } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/obra-helpers";
import { format } from "date-fns";

type Comprador = {
  id: string; nome: string; cpf_cnpj: string | null; email: string | null;
  telefone: string | null; cargo: string | null; observacoes: string | null; ativo: boolean;
};

const empty = { nome: "", cpf_cnpj: "", email: "", telefone: "", cargo: "", observacoes: "" };

export default function Compradores() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<Comprador | null>(null);
  const [form, setForm] = useState(empty);
  const [historicoId, setHistoricoId] = useState<string | null>(null);

  const { data: compradores = [] } = useQuery({
    queryKey: ["compradores-full", empresaId], enabled: !!empresaId,
    queryFn: async () => (await supabase.from("compradores" as any).select("*").order("nome")).data as Comprador[] | null ?? [],
  });

  const { data: historico } = useQuery({
    queryKey: ["comprador-historico", historicoId], enabled: !!historicoId,
    queryFn: async () => {
      const [pcs, mats, cards] = await Promise.all([
        supabase.from("pedidos_compra").select("id, numero_pedido, valor, created_at, obras(codigo_chamado)").eq("comprador_id" as any, historicoId!).order("created_at", { ascending: false }),
        supabase.from("materiais_obra").select("id, descricao, valor_total, data_compra, obras(codigo_chamado)").eq("comprador_id" as any, historicoId!).order("data_compra", { ascending: false }),
        supabase.from("cartao_despesas" as any).select("id, descricao, valor, data_compra, obras(codigo_chamado), cartoes_credito(apelido)").eq("comprador_id", historicoId!).order("data_compra", { ascending: false }),
      ]);
      return { pcs: pcs.data ?? [], mats: mats.data ?? [], cards: cards.data ?? [] };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: form.nome.trim(),
        cpf_cnpj: form.cpf_cnpj || null,
        email: form.email || null,
        telefone: form.telefone || null,
        cargo: form.cargo || null,
        observacoes: form.observacoes || null,
      };
      if (editing) {
        const { error } = await supabase.from("compradores" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("compradores" as any).insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Comprador atualizado" : "Comprador criado");
      qc.invalidateQueries({ queryKey: ["compradores"] });
      qc.invalidateQueries({ queryKey: ["compradores-full"] });
      setDialog(false); setEditing(null); setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("compradores" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comprador removido");
      qc.invalidateQueries({ queryKey: ["compradores-full"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalHistorico = (historico?.pcs ?? []).reduce((s, p: any) => s + Number(p.valor || 0), 0)
    + (historico?.mats ?? []).reduce((s, m: any) => s + Number(m.valor_total || 0), 0)
    + (historico?.cards ?? []).reduce((s, c: any) => s + Number(c.valor || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Compradores</h1>
          <p className="text-sm text-muted-foreground">Cadastro de compradores e histórico de obras</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(empty); setDialog(true); }}>
          <Plus className="h-4 w-4" /> Novo comprador
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>CPF/CNPJ</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {compradores.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell>{c.cpf_cnpj ?? "—"}</TableCell>
                <TableCell>{c.email ?? "—"}</TableCell>
                <TableCell>{c.telefone ?? "—"}</TableCell>
                <TableCell>{c.cargo ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => setHistoricoId(c.id)}><History className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => {
                    setEditing(c);
                    setForm({ nome: c.nome, cpf_cnpj: c.cpf_cnpj ?? "", email: c.email ?? "", telefone: c.telefone ?? "", cargo: c.cargo ?? "", observacoes: c.observacoes ?? "" });
                    setDialog(true);
                  }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => confirm("Excluir comprador?") && del.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {compradores.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum comprador cadastrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar comprador" : "Novo comprador"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Nome*</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><Label>CPF/CNPJ</Label><Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} /></div>
            <div><Label>Cargo</Label><Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
            <div className="col-span-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={!form.nome || save.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!historicoId} onOpenChange={(o) => !o && setHistoricoId(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Histórico do comprador</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">Total movimentado</p>
              <p className="text-2xl font-semibold">{formatCurrency(totalHistorico)}</p>
            </div>

            <section>
              <h3 className="text-sm font-semibold mb-2">Pedidos de compra ({historico?.pcs.length ?? 0})</h3>
              {(historico?.pcs ?? []).map((p: any) => (
                <div key={p.id} className="flex justify-between text-sm py-1 border-b">
                  <span>PC {p.numero_pedido} • {p.obras?.codigo_chamado ?? "—"}</span>
                  <span className="font-medium">{formatCurrency(p.valor)}</span>
                </div>
              ))}
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-2">Materiais ({historico?.mats.length ?? 0})</h3>
              {(historico?.mats ?? []).map((m: any) => (
                <div key={m.id} className="flex justify-between text-sm py-1 border-b">
                  <span>{m.descricao} • {m.obras?.codigo_chamado ?? "—"} • {format(new Date(m.data_compra), "dd/MM/yyyy")}</span>
                  <span className="font-medium">{formatCurrency(m.valor_total)}</span>
                </div>
              ))}
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-2">Cartão de crédito ({historico?.cards.length ?? 0})</h3>
              {(historico?.cards ?? []).map((c: any) => (
                <div key={c.id} className="flex justify-between text-sm py-1 border-b">
                  <span>{c.descricao} • {c.cartoes_credito?.apelido} • {c.obras?.codigo_chamado ?? "—"}</span>
                  <span className="font-medium">{formatCurrency(c.valor)}</span>
                </div>
              ))}
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
