import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, CreditCard, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/obra-helpers";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

type Cartao = {
  id: string; apelido: string; banco: string | null; bandeira: string | null;
  ultimos_4: string | null; titular: string | null; limite: number;
  dia_fechamento: number | null; dia_vencimento: number | null; ativo: boolean;
};

const emptyCartao = { apelido: "", banco: "", bandeira: "", ultimos_4: "", titular: "", limite: "0", dia_fechamento: "", dia_vencimento: "" };
const emptyDesp = { cartao_id: "", obra_id: "", comprador_id: "", descricao: "", valor: "", data_compra: new Date().toISOString().slice(0, 10), parcelas: "1", observacoes: "", categoria: "" };

const CATEGORIAS_DESPESA = [
  "Almoço", "Café", "Mercado", "Combustível", "Transporte", "Estacionamento",
  "Pedágio", "Material de construção", "Ferramentas", "EPI", "Hospedagem",
  "Manutenção veículo", "Telefonia/Internet", "Escritório", "Outros",
];

export default function Cartoes() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [cartaoDialog, setCartaoDialog] = useState(false);
  const [editingCartao, setEditingCartao] = useState<Cartao | null>(null);
  const [cartaoForm, setCartaoForm] = useState(emptyCartao);
  const [despDialog, setDespDialog] = useState(false);
  const [despForm, setDespForm] = useState(emptyDesp);
  const [filtroCartao, setFiltroCartao] = useState<string>("todos");

  const { data: cartoes = [] } = useQuery({
    queryKey: ["cartoes", empresaId], enabled: !!empresaId,
    queryFn: async () => ((await supabase.from("cartoes_credito" as any).select("*").order("apelido")).data as unknown as Cartao[]) ?? [],
  });
  const { data: obras = [] } = useQuery({
    queryKey: ["obras-min", empresaId], enabled: !!empresaId,
    queryFn: async () => (await supabase.from("obras").select("id, codigo_chamado").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: compradores = [] } = useQuery({
    queryKey: ["compradores", empresaId], enabled: !!empresaId,
    queryFn: async () => (await supabase.from("compradores" as any).select("id, nome").eq("ativo", true).order("nome")).data ?? [],
  });
  const { data: despesas = [] } = useQuery({
    queryKey: ["cartao-despesas", empresaId, filtroCartao], enabled: !!empresaId,
    queryFn: async () => {
      let q = supabase.from("cartao_despesas" as any)
        .select("*, cartoes_credito(apelido), obras(codigo_chamado), compradores(nome)")
        .order("data_compra", { ascending: false }).limit(500);
      if (filtroCartao !== "todos") q = q.eq("cartao_id", filtroCartao);
      const { data } = await q;
      return data ?? [];
    },
  });

  const saveCartao = useMutation({
    mutationFn: async () => {
      const payload = {
        apelido: cartaoForm.apelido.trim(),
        banco: cartaoForm.banco || null,
        bandeira: cartaoForm.bandeira || null,
        ultimos_4: cartaoForm.ultimos_4 || null,
        titular: cartaoForm.titular || null,
        limite: parseFloat(cartaoForm.limite) || 0,
        dia_fechamento: cartaoForm.dia_fechamento ? parseInt(cartaoForm.dia_fechamento) : null,
        dia_vencimento: cartaoForm.dia_vencimento ? parseInt(cartaoForm.dia_vencimento) : null,
      };
      if (editingCartao) {
        const { error } = await supabase.from("cartoes_credito" as any).update(payload).eq("id", editingCartao.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cartoes_credito" as any).insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingCartao ? "Cartão atualizado" : "Cartão criado");
      qc.invalidateQueries({ queryKey: ["cartoes", empresaId] });
      setCartaoDialog(false); setEditingCartao(null); setCartaoForm(emptyCartao);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delCartao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cartoes_credito" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cartão removido"); qc.invalidateQueries({ queryKey: ["cartoes", empresaId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveDesp = useMutation({
    mutationFn: async () => {
      const payload = {
        cartao_id: despForm.cartao_id,
        obra_id: despForm.obra_id || null,
        comprador_id: despForm.comprador_id || null,
        descricao: despForm.descricao.trim(),
        valor: parseFloat(despForm.valor) || 0,
        data_compra: despForm.data_compra,
        parcelas: parseInt(despForm.parcelas) || 1,
        observacoes: despForm.observacoes || null,
        categoria: despForm.categoria || null,
      };
      const { error } = await supabase.from("cartao_despesas" as any).insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Despesa registrada");
      qc.invalidateQueries({ queryKey: ["cartao-despesas"] });
      qc.invalidateQueries({ queryKey: ["obra-financeiro-resumo"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setDespDialog(false); setDespForm(emptyDesp);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delDesp = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cartao_despesas" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cartao-despesas"] });
      qc.invalidateQueries({ queryKey: ["obra-financeiro-resumo"] });
      toast.success("Despesa excluída");
    },
  });

  const totaisPorCartao = useMemo(() => {
    const map = new Map<string, number>();
    (despesas as any[]).forEach((d) => map.set(d.cartao_id, (map.get(d.cartao_id) ?? 0) + Number(d.valor || 0)));
    return map;
  }, [despesas]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cartões de Crédito</h1>
          <p className="text-sm text-muted-foreground">Gerencie cartões e despesas vinculadas a obras</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setEditingCartao(null); setCartaoForm(emptyCartao); setCartaoDialog(true); }}>
            <CreditCard className="h-4 w-4" /> Novo cartão
          </Button>
          <Button onClick={() => { setDespForm(emptyDesp); setDespDialog(true); }} disabled={cartoes.length === 0}>
            <Plus className="h-4 w-4" /> Nova despesa
          </Button>
        </div>
      </div>

      {/* Cartões */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {cartoes.map((c) => (
          <Card key={c.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{c.apelido}</CardTitle>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => {
                    setEditingCartao(c);
                    setCartaoForm({
                      apelido: c.apelido, banco: c.banco ?? "", bandeira: c.bandeira ?? "",
                      ultimos_4: c.ultimos_4 ?? "", titular: c.titular ?? "",
                      limite: String(c.limite), dia_fechamento: c.dia_fechamento?.toString() ?? "",
                      dia_vencimento: c.dia_vencimento?.toString() ?? "",
                    });
                    setCartaoDialog(true);
                  }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => confirm("Excluir cartão?") && delCartao.mutate(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="text-muted-foreground">{c.banco ?? "—"} • {c.bandeira ?? "—"} {c.ultimos_4 ? `• •••• ${c.ultimos_4}` : ""}</p>
              <p>Limite: <span className="font-medium">{formatCurrency(c.limite)}</span></p>
              <p className="text-xs text-muted-foreground">
                Fech. dia {c.dia_fechamento ?? "—"} • Venc. dia {c.dia_vencimento ?? "—"}
              </p>
              <p className="pt-1">Gasto registrado: <Badge variant="secondary">{formatCurrency(totaisPorCartao.get(c.id) ?? 0)}</Badge></p>
            </CardContent>
          </Card>
        ))}
        {cartoes.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum cartão cadastrado.</p>
        )}
      </div>

      {/* Despesas */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">Despesas no cartão</h2>
          <Select value={filtroCartao} onValueChange={setFiltroCartao}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os cartões</SelectItem>
              {cartoes.map((c) => <SelectItem key={c.id} value={c.id}>{c.apelido}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Cartão</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Comprador</TableHead>
              <TableHead>Parc.</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(despesas as any[]).map((d) => (
              <TableRow key={d.id}>
                <TableCell>{format(new Date(d.data_compra), "dd/MM/yyyy")}</TableCell>
                <TableCell>{d.cartoes_credito?.apelido ?? "—"}</TableCell>
                <TableCell>{d.descricao}</TableCell>
                <TableCell>{d.categoria ? <Badge variant="outline">{d.categoria}</Badge> : "—"}</TableCell>
                <TableCell>{d.obras?.codigo_chamado ?? "—"}</TableCell>
                <TableCell>{d.compradores?.nome ?? "—"}</TableCell>
                <TableCell>{d.parcelas}x</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(d.valor)}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => confirm("Excluir despesa?") && delDesp.mutate(d.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(despesas as any[]).length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma despesa.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Cartão dialog */}
      <Dialog open={cartaoDialog} onOpenChange={setCartaoDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingCartao ? "Editar cartão" : "Novo cartão"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Apelido*</Label><Input value={cartaoForm.apelido} onChange={(e) => setCartaoForm({ ...cartaoForm, apelido: e.target.value })} /></div>
            <div><Label>Banco</Label><Input value={cartaoForm.banco} onChange={(e) => setCartaoForm({ ...cartaoForm, banco: e.target.value })} /></div>
            <div><Label>Bandeira</Label><Input value={cartaoForm.bandeira} onChange={(e) => setCartaoForm({ ...cartaoForm, bandeira: e.target.value })} /></div>
            <div><Label>Últimos 4</Label><Input maxLength={4} value={cartaoForm.ultimos_4} onChange={(e) => setCartaoForm({ ...cartaoForm, ultimos_4: e.target.value })} /></div>
            <div><Label>Titular</Label><Input value={cartaoForm.titular} onChange={(e) => setCartaoForm({ ...cartaoForm, titular: e.target.value })} /></div>
            <div><Label>Limite</Label><Input type="number" step="0.01" value={cartaoForm.limite} onChange={(e) => setCartaoForm({ ...cartaoForm, limite: e.target.value })} /></div>
            <div><Label>Dia fechamento</Label><Input type="number" min={1} max={31} value={cartaoForm.dia_fechamento} onChange={(e) => setCartaoForm({ ...cartaoForm, dia_fechamento: e.target.value })} /></div>
            <div><Label>Dia vencimento</Label><Input type="number" min={1} max={31} value={cartaoForm.dia_vencimento} onChange={(e) => setCartaoForm({ ...cartaoForm, dia_vencimento: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCartaoDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveCartao.mutate()} disabled={!cartaoForm.apelido || saveCartao.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Despesa dialog */}
      <Dialog open={despDialog} onOpenChange={setDespDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova despesa de cartão</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Cartão*</Label>
              <Select value={despForm.cartao_id} onValueChange={(v) => setDespForm({ ...despForm, cartao_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{cartoes.map((c) => <SelectItem key={c.id} value={c.id}>{c.apelido}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Descrição</Label><Input value={despForm.descricao} onChange={(e) => setDespForm({ ...despForm, descricao: e.target.value })} /></div>
            <div><Label>Valor*</Label><Input type="number" step="0.01" value={despForm.valor} onChange={(e) => setDespForm({ ...despForm, valor: e.target.value })} /></div>
            <div><Label>Data</Label><Input type="date" value={despForm.data_compra} onChange={(e) => setDespForm({ ...despForm, data_compra: e.target.value })} /></div>
            <div><Label>Parcelas</Label><Input type="number" min={1} value={despForm.parcelas} onChange={(e) => setDespForm({ ...despForm, parcelas: e.target.value })} /></div>
            <div className="col-span-2">
              <Label>Categoria</Label>
              <Select value={despForm.categoria || "none"} onValueChange={(v) => setDespForm({ ...despForm, categoria: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem categoria —</SelectItem>
                  {CATEGORIAS_DESPESA.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Obra (origem)</Label>
              <Select value={despForm.obra_id || "none"} onValueChange={(v) => setDespForm({ ...despForm, obra_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem obra —</SelectItem>
                  {(obras as any[]).map((o) => <SelectItem key={o.id} value={o.id}>{o.codigo_chamado}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Comprador</Label>
              <Select value={despForm.comprador_id || "none"} onValueChange={(v) => setDespForm({ ...despForm, comprador_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {(compradores as any[]).map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Observações</Label><Input value={despForm.observacoes} onChange={(e) => setDespForm({ ...despForm, observacoes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDespDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveDesp.mutate()} disabled={!despForm.cartao_id || !despForm.categoria || !despForm.valor || saveDesp.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
