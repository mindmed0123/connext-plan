import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  status: "a_receber" | "recebido";
};

const emptyRec: RecForm = {
  obra_id: "",
  descricao: "",
  valor: "",
  data_prevista: getTodayDateInputValue(),
  observacoes: "",
  status: "a_receber",
};

export default function Recebimentos() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm, clearDraft] = useDraftState<RecForm>("recebimento-form", emptyRec);

  const { data } = useQuery({
    queryKey: ["all-recebimentos"],
    queryFn: async () =>
      (
        await supabase
          .from("recebimentos")
          .select("*, obras(codigo_chamado), pedidos_compra:pedido_compra_id(numero_pedido, codigo_chamado_avulso)")
          .order("data_prevista", { ascending: true })
      ).data,
  });

  const { data: obras = [] } = useQuery({
    queryKey: ["obras-rec-select"],
    queryFn: async () =>
      (await supabase.from("obras").select("id, codigo_chamado").order("codigo_chamado")).data ?? [],
  });

  const totais = useMemo(() => {
    let aReceber = 0;
    let recebido = 0;
    for (const r of (data ?? []) as any[]) {
      const v = Number(r.valor || 0);
      if (r.status === "recebido") recebido += v;
      else aReceber += v;
    }
    return { aReceber, recebido };
  }, [data]);

  const marcarRecebido = useMutation({
    mutationFn: async (r: any) => {
      const hoje = getTodayDateInputValue();
      const { error } = await supabase
        .from("recebimentos")
        .update({ status: "recebido", data_recebido: hoje })
        .eq("id", r.id);
      if (error) throw error;
      if (r.pedido_compra_id) {
        await supabase.from("pedidos_compra").update({ status: "recebido" }).eq("id", r.pedido_compra_id);
      }
    },
    onSuccess: () => {
      toast.success("Recebimento confirmado");
      qc.invalidateQueries({ queryKey: ["all-recebimentos"] });
      qc.invalidateQueries({ queryKey: ["faturamento-pcs"] });
      qc.invalidateQueries({ queryKey: ["dashboard-data"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao confirmar recebimento"),
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const payload: any = {
        obra_id: form.obra_id || null,
        descricao: form.descricao.trim() || null,
        valor: parseFloat(form.valor) || 0,
        data_prevista: form.data_prevista || null,
        observacoes: form.observacoes || null,
        status: form.status,
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
      qc.invalidateQueries({ queryKey: ["all-recebimentos"] });
      qc.invalidateQueries({ queryKey: ["dashboard-data"] });
      clearDraft();
      setEditId(null);
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recebimentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recebimento excluído");
      qc.invalidateQueries({ queryKey: ["all-recebimentos"] });
      qc.invalidateQueries({ queryKey: ["dashboard-data"] });
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
      status: r.status,
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Recebimentos</h1>
          <p className="text-sm text-muted-foreground">
            Fluxo de caixa previsto e realizado · Inclui pedidos de compra com data de recebimento
          </p>
        </div>
        <Button onClick={openNovo}>
          <Plus className="h-4 w-4 mr-1" /> Nova entrada
        </Button>
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
              <TableHead>Valor</TableHead>
              <TableHead>Previsto</TableHead>
              <TableHead>Recebido</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  Sem recebimentos
                </TableCell>
              </TableRow>
            )}
            {data?.map((r: any) => {
              const pc = r.pedidos_compra;
              const chamado =
                r.obras?.codigo_chamado ?? pc?.codigo_chamado_avulso ?? r.descricao ?? "Manual";
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
                  <TableCell>{formatCurrency(r.valor)}</TableCell>
                  <TableCell>{formatDateBR(r.data_prevista)}</TableCell>
                  <TableCell>{formatDateBR(r.data_recebido)}</TableCell>
                  <TableCell className="text-xs">{r.status === "recebido" ? "✓ Recebido" : "A receber"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {r.status === "a_receber" && (
                        <Button size="sm" variant="outline" onClick={() => marcarRecebido.mutate(r)}>
                          Marcar recebido
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => openEditar(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
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
                  {(obras as any[]).map((o) => (
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
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v: "a_receber" | "recebido") => setForm({ ...form, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_receber">A receber</SelectItem>
                  <SelectItem value="recebido">Recebido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              <Input
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              />
            </div>
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
