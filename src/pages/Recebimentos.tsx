import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/obra-helpers";
import { toast } from "sonner";
import { formatDateBR, getTodayDateInputValue } from "@/lib/date";
import { useDraftState } from "@/hooks/useDraftState";

type RecForm = {
  obra_id: string;
  descricao: string;
  valor: string;
  data_prevista: string;
  observacoes: string;
};

const emptyRec: RecForm = {
  obra_id: "",
  descricao: "",
  valor: "",
  data_prevista: getTodayDateInputValue(),
  observacoes: "",
};

type PagForm = { valor: string; data: string; forma_pagamento: string; observacao: string };

export default function Recebimentos() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm, clearDraft] = useDraftState<RecForm>("recebimento-form", emptyRec);
  const [filtro, setFiltro] = useState<"todos" | "pc_recebidos">("todos");
  const [pagRec, setPagRec] = useState<any | null>(null);
  const [pagForm, setPagForm] = useState<PagForm>({
    valor: "",
    data: getTodayDateInputValue(),
    forma_pagamento: "",
    observacao: "",
  });

  const { data } = useQuery({
    queryKey: ["all-recebimentos"],
    queryFn: async () =>
      fetchAllRows<any>((f, t) =>
        supabase
          .from("recebimentos")
          .select("*, obras(codigo_chamado), pedidos_compra:pedido_compra_id(numero_pedido, codigo_chamado_avulso)")
          .order("data_prevista", { ascending: true })
          .order("id")
          .range(f, t),
      ),
  });

  const { data: obras = [] } = useQuery({
    queryKey: ["obras-rec-select"],
    queryFn: async () =>
      (await (supabase.from("obras")).select("id, codigo_chamado").eq("arquivada", false).order("codigo_chamado")).data ?? [],
  });

  // Pagamentos do recebimento aberto no diálogo
  const { data: pagamentos = [] } = useQuery({
    queryKey: ["recebimento-pagamentos", pagRec?.id],
    enabled: !!pagRec?.id,
    queryFn: async () =>
      (
        await supabase
          .from("recebimento_pagamentos")
          .select("*")
          .eq("recebimento_id", pagRec.id)
          .order("data", { ascending: true })
          .order("id")
      ).data ?? [],
  });

  const lista = useMemo(() => {
    const rows = (data ?? []);
    if (filtro === "pc_recebidos") {
      return rows.filter((r) => r.pedido_compra_id && r.status === "recebido");
    }
    return rows;
  }, [data, filtro]);

  const totais = useMemo(() => {
    let aReceber = 0;
    let recebido = 0;
    for (const r of lista) {
      const v = Number(r.valor || 0);
      const pago = Number(r.valor_recebido || 0);
      recebido += pago;
      aReceber += Math.max(0, v - pago);
    }
    return { aReceber, recebido };
  }, [lista]);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["all-recebimentos"] });
    qc.invalidateQueries({ queryKey: ["recebimento-pagamentos"] });
    qc.invalidateQueries({ queryKey: ["faturamento-pcs"] });
    qc.invalidateQueries({ queryKey: ["dashboard-data"] });
    qc.invalidateQueries({ queryKey: ["lancamentos"] });
    qc.invalidateQueries({ queryKey: ["financeiro-kpis"] });
    qc.invalidateQueries({ queryKey: ["fluxo-caixa-mensal"] });
  };

  const registrarPagamento = useMutation({
    mutationFn: async () => {
      const valor = Number(pagForm.valor.replace(",", "."));
      if (!(valor > 0)) throw new Error("Informe um valor maior que zero");
      const { error } = await supabase.from("recebimento_pagamentos").insert([
        {
          recebimento_id: pagRec.id,
          valor,
          data: pagForm.data || getTodayDateInputValue(),
          forma_pagamento: pagForm.forma_pagamento || null,
          observacao: pagForm.observacao || null,
        },
      ]);
      if (error) throw error;
      if (pagRec.pedido_compra_id) {
        await supabase.from("pedidos_compra").update({ status: "recebido" }).eq("id", pagRec.pedido_compra_id);
      }
    },
    onSuccess: () => {
      toast.success("Pagamento registrado");
      setPagForm({ valor: "", data: getTodayDateInputValue(), forma_pagamento: "", observacao: "" });
      invalidar();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao registrar pagamento"),
  });

  const estornarPagamento = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("recebimento_pagamentos").delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Você não tem permissão para estornar este pagamento.");
    },
    onSuccess: () => {
      toast.success("Pagamento estornado");
      invalidar();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao estornar"),
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const payload: any = {
        obra_id: form.obra_id || null,
        descricao: form.descricao.trim() || null,
        valor: parseFloat(form.valor) || 0,
        data_prevista: form.data_prevista || null,
        observacoes: form.observacoes || null,
      };
      if (editId) {
        const { error } = await supabase.from("recebimentos").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("recebimentos").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Recebimento atualizado" : "Recebimento criado");
      invalidar();
      clearDraft();
      setEditId(null);
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from("recebimentos").delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Você não tem permissão para excluir este recebimento.");
    },
    onSuccess: () => {
      toast.success("Recebimento excluído");
      invalidar();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNovo = () => {
    setEditId(null);
    setForm(emptyRec);
    setDialogOpen(true);
  };

  const openEditar = (r: any) => {
    setEditId(r.id);
    setForm({
      obra_id: r.obra_id ?? "",
      descricao: r.descricao ?? "",
      valor: String(r.valor ?? ""),
      data_prevista: r.data_prevista ?? getTodayDateInputValue(),
      observacoes: r.observacoes ?? "",
    });
    setDialogOpen(true);
  };

  const abrirPagamentos = (r: any) => {
    const saldo = Math.max(0, Number(r.valor || 0) - Number(r.valor_recebido || 0));
    setPagRec(r);
    setPagForm({ valor: saldo > 0 ? saldo.toFixed(2) : "", data: getTodayDateInputValue(), forma_pagamento: "", observacao: "" });
  };

  const recAtual = useMemo(
    () => (pagRec ? (lista).find((r) => r.id === pagRec.id) ?? pagRec : null),
    [lista, pagRec],
  );
  const saldoAtual = recAtual ? Math.max(0, Number(recAtual.valor || 0) - Number(recAtual.valor_recebido || 0)) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Recebimentos</h1>
          <p className="text-sm text-muted-foreground">
            {filtro === "pc_recebidos"
              ? "Revise um a um: estes vieram de pedidos de compra antigos e podem não ter sido pagos de fato"
              : "Fluxo de caixa previsto e realizado · Cada pagamento entra na sua própria data"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filtro} onValueChange={(v: "todos" | "pc_recebidos") => setFiltro(v)}>
            <SelectTrigger className="h-9 w-[320px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os recebimentos</SelectItem>
              <SelectItem value="pc_recebidos">Gerados por PC e marcados como recebidos</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openNovo}>
            <Plus className="h-4 w-4 mr-1" /> Nova entrada
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total a receber</p>
            <p className="text-2xl font-semibold tabular-nums">{formatCurrency(totais.aReceber)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total recebido</p>
            <p className="text-2xl font-semibold tabular-nums text-success">{formatCurrency(totais.recebido)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chamado / Descrição</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Em aberto</TableHead>
              <TableHead>Previsto</TableHead>
              <TableHead>Último pagamento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  {filtro === "pc_recebidos"
                    ? "Nenhum recebimento gerado por pedido de compra está marcado como recebido"
                    : "Sem recebimentos"}
                </TableCell>
              </TableRow>
            )}
            {lista.map((r: any) => {
              const pc = r.pedidos_compra;
              const chamado = r.obras?.codigo_chamado ?? pc?.codigo_chamado_avulso ?? r.descricao ?? "Manual";
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{chamado}</TableCell>
                  <TableCell>
                    {pc ? (
                      <Badge variant="secondary" className="text-[10px]">
                        PC{pc.numero_pedido ? ` ${pc.numero_pedido}` : ""}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Manual</span>
                    )}
                  </TableCell>
                  <TableCell>{formatCurrency(Math.max(0, Number(r.valor) - Number(r.valor_recebido || 0)))}</TableCell>
                  <TableCell>{formatDateBR(r.data_prevista)}</TableCell>
                  <TableCell>{formatDateBR(r.data_recebido)}</TableCell>
                  <TableCell className="text-xs">
                    {r.status === "recebido" ? "✓ Recebido" : r.status === "parcial" ? "Parcial" : "A receber"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => abrirPagamentos(r)}>
                        Registrar pagamento
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEditar(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={Number(r.valor_recebido || 0) > 0}
                        title={
                          Number(r.valor_recebido || 0) > 0
                            ? "Estorne os pagamentos antes de excluir"
                            : "Excluir recebimento"
                        }
                        onClick={() => confirm("Excluir recebimento?") && excluir.mutate(r.id)}
                      >
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

      {/* Pagamentos do recebimento */}
      <Dialog open={!!pagRec} onOpenChange={(v) => !v && setPagRec(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Pagamentos do recebimento</DialogTitle>
          </DialogHeader>

          {recAtual && (
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Valor total</p>
                <p className="font-medium tabular-nums">{formatCurrency(Number(recAtual.valor || 0))}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Já recebido</p>
                <p className="font-medium tabular-nums text-success">{formatCurrency(Number(recAtual.valor_recebido || 0))}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Em aberto</p>
                <p className="font-medium tabular-nums">{formatCurrency(saldoAtual)}</p>
              </div>
            </div>
          )}

          <div className="rounded-md border divide-y">
            {(pagamentos).length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">Nenhum pagamento registrado.</p>
            )}
            {(pagamentos).map((p) => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{formatDateBR(p.data)}</span>
                <span className="tabular-nums font-medium">{formatCurrency(Number(p.valor))}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-destructive"
                  onClick={() => confirm("Estornar este pagamento?") && estornarPagamento.mutate(p.id)}
                >
                  Estornar
                </Button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor do pagamento*</Label>
              <Input
                type="number"
                step="0.01"
                value={pagForm.valor}
                onChange={(e) => setPagForm({ ...pagForm, valor: e.target.value })}
              />
            </div>
            <div>
              <Label>Data do pagamento*</Label>
              <Input
                type="date"
                value={pagForm.data}
                onChange={(e) => setPagForm({ ...pagForm, data: e.target.value })}
              />
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <Select
                value={pagForm.forma_pagamento || "none"}
                onValueChange={(v) => setPagForm({ ...pagForm, forma_pagamento: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Não informar —</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observação</Label>
              <Input
                value={pagForm.observacao}
                onChange={(e) => setPagForm({ ...pagForm, observacao: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPagRec(null)}>
              Fechar
            </Button>
            <Button
              onClick={() => registrarPagamento.mutate()}
              disabled={!pagForm.valor || !pagForm.data || registrarPagamento.isPending}
            >
              Registrar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditId(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar recebimento" : "Novo recebimento"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Obra (opcional)</Label>
              <Select
                value={form.obra_id || "none"}
                onValueChange={(v) => setForm({ ...form, obra_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem obra (manual) —</SelectItem>
                  {(obras).map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.codigo_chamado}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Descrição*</Label>
              <Input
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Ex.: Adiantamento cliente XYZ"
              />
            </div>
            <div>
              <Label>Valor*</Label>
              <Input
                type="number"
                step="0.01"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
              />
            </div>
            <div>
              <Label>Data prevista*</Label>
              <Input
                type="date"
                value={form.data_prevista}
                onChange={(e) => setForm({ ...form, data_prevista: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              <Input
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              />
            </div>
            <p className="col-span-2 text-xs text-muted-foreground">
              O que já foi recebido é informado em “Registrar pagamento”, cada valor na sua data.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => salvar.mutate()}
              disabled={!form.descricao || !form.valor || !form.data_prevista || salvar.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
