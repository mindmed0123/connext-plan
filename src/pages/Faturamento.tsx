import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Pencil } from "lucide-react";
import { formatCurrency } from "@/lib/obra-helpers";
import { FaturamentoFormDialog } from "@/components/financeiro/FaturamentoFormDialog";
import { PedidoCompraEditDialog } from "@/components/financeiro/PedidoCompraEditDialog";
import { formatDateBR, getTodayDateInputValue } from "@/lib/date";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Faturamento() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"rcs" | "pcs" | "nfs">("rcs");
  const [openTipo, setOpenTipo] = useState<"rc" | "pc" | "nf" | null>(null);
  const [editPc, setEditPc] = useState<any | null>(null);
  const [editRc, setEditRc] = useState<any | null>(null);
  const [editNf, setEditNf] = useState<any | null>(null);

  const rcs = useQuery({
    queryKey: ["faturamento-rcs"],
    queryFn: async () => (await supabase.from("rcs").select("*, obras(codigo_chamado)").order("created_at", { ascending: false })).data,
  });
  const pcs = useQuery({
    queryKey: ["faturamento-pcs"],
    queryFn: async () => (await supabase.from("pedidos_compra").select("*, obras(codigo_chamado), notas_fiscais(id, numero_nf)").order("created_at", { ascending: false })).data,
  });
  const nfs = useQuery({
    queryKey: ["faturamento-nfs"],
    queryFn: async () => (await supabase.from("notas_fiscais").select("*, obras(codigo_chamado)").order("created_at", { ascending: false })).data,
  });

  const chamado = (row: any) => row.obras?.codigo_chamado ?? row.codigo_chamado_avulso ?? "—";

  const delRc = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("rcs").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("RC excluída"); qc.invalidateQueries({ queryKey: ["faturamento-rcs"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const delPc = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("pedidos_compra").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Pedido excluído"); qc.invalidateQueries({ queryKey: ["faturamento-pcs"] }); qc.invalidateQueries({ queryKey: ["all-recebimentos"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const delNf = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("notas_fiscais").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("NF excluída"); qc.invalidateQueries({ queryKey: ["faturamento-nfs"] }); qc.invalidateQueries({ queryKey: ["faturamento-pcs"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveRc = useMutation({
    mutationFn: async () => {
      const { id, obras, ...payload } = editRc;
      const { error } = await supabase.from("rcs").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("RC atualizada"); qc.invalidateQueries({ queryKey: ["faturamento-rcs"] }); setEditRc(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const saveNf = useMutation({
    mutationFn: async () => {
      const { id, obras, ...payload } = editNf;
      payload.valor = Number(payload.valor) || 0;
      const { error } = await supabase.from("notas_fiscais").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("NF atualizada"); qc.invalidateQueries({ queryKey: ["faturamento-nfs"] }); setEditNf(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const novoBtn = () => {
    const tipo = tab === "rcs" ? "rc" : tab === "pcs" ? "pc" : "nf";
    const label = tab === "rcs" ? "Nova RC" : tab === "pcs" ? "Novo pedido" : "Nova NF";
    return (
      <Button size="sm" onClick={() => setOpenTipo(tipo)}>
        <Plus className="h-4 w-4 mr-1" /> {label}
      </Button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Faturamento</h1>
          <p className="text-sm text-muted-foreground">RCs, pedidos de compra e notas fiscais</p>
        </div>
        {novoBtn()}
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="rcs">RCs</TabsTrigger>
          <TabsTrigger value="pcs">Pedidos de compra</TabsTrigger>
          <TabsTrigger value="nfs">Notas fiscais</TabsTrigger>
        </TabsList>
        <TabsContent value="rcs">
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>Chamado</TableHead><TableHead>Nº RC</TableHead><TableHead>Data</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {rcs.data?.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{chamado(r)}{!r.obras && r.codigo_chamado_avulso && <span className="ml-2 text-[10px] text-muted-foreground">(avulso)</span>}</TableCell>
                    <TableCell>{r.numero_rc}</TableCell>
                    <TableCell>{formatDateBR(r.data_rc)}</TableCell>
                    <TableCell className="text-xs">{r.status}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setEditRc({ ...r })}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => confirm("Excluir RC?") && delRc.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="pcs">
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>Chamado</TableHead><TableHead>Nº pedido</TableHead><TableHead>Recebimento</TableHead><TableHead>Valor</TableHead><TableHead>NF</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {pcs.data?.map((p: any) => {
                  const nfsLinked: any[] = p.notas_fiscais ?? [];
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{chamado(p)}{!p.obras && p.codigo_chamado_avulso && <span className="ml-2 text-[10px] text-muted-foreground">(avulso)</span>}</TableCell>
                      <TableCell>{p.numero_pedido}</TableCell>
                      <TableCell>{p.data_recebimento ? formatDateBR(p.data_recebimento) : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>{formatCurrency(p.valor)}</TableCell>
                      <TableCell className="text-xs">
                        {nfsLinked.length > 0
                          ? <span className="text-success font-medium">✓ {nfsLinked.map((n) => n.numero_nf).join(", ")}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs capitalize">{p.status}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setEditPc(p)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => confirm("Excluir pedido?") && delPc.mutate(p.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="nfs">
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>Chamado</TableHead><TableHead>Nº NF</TableHead><TableHead>Emissão</TableHead><TableHead>Valor</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {nfs.data?.map((n: any) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium">{chamado(n)}{!n.obras && n.codigo_chamado_avulso && <span className="ml-2 text-[10px] text-muted-foreground">(avulso)</span>}</TableCell>
                    <TableCell>{n.numero_nf}</TableCell>
                    <TableCell>{formatDateBR(n.data_emissao)}</TableCell>
                    <TableCell>{formatCurrency(n.valor)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setEditNf({ ...n })}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => confirm("Excluir NF?") && delNf.mutate(n.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {openTipo && (
        <FaturamentoFormDialog tipo={openTipo} open={!!openTipo} onOpenChange={(v) => !v && setOpenTipo(null)} />
      )}

      <PedidoCompraEditDialog
        pedido={editPc}
        open={!!editPc}
        onOpenChange={(v) => !v && setEditPc(null)}
      />

      {/* Edit RC */}
      <Dialog open={!!editRc} onOpenChange={(v) => !v && setEditRc(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar RC</DialogTitle></DialogHeader>
          {editRc && (
            <div className="grid gap-3">
              <div><Label>Nº RC</Label><Input value={editRc.numero_rc ?? ""} onChange={(e) => setEditRc({ ...editRc, numero_rc: e.target.value })} /></div>
              <div><Label>Data</Label><Input type="date" value={editRc.data_rc ?? getTodayDateInputValue()} onChange={(e) => setEditRc({ ...editRc, data_rc: e.target.value })} /></div>
              <div><Label>Status</Label><Input value={editRc.status ?? ""} onChange={(e) => setEditRc({ ...editRc, status: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRc(null)}>Cancelar</Button>
            <Button onClick={() => saveRc.mutate()} disabled={saveRc.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit NF */}
      <Dialog open={!!editNf} onOpenChange={(v) => !v && setEditNf(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar NF</DialogTitle></DialogHeader>
          {editNf && (
            <div className="grid gap-3">
              <div><Label>Nº NF</Label><Input value={editNf.numero_nf ?? ""} onChange={(e) => setEditNf({ ...editNf, numero_nf: e.target.value })} /></div>
              <div><Label>Emissão</Label><Input type="date" value={editNf.data_emissao ?? getTodayDateInputValue()} onChange={(e) => setEditNf({ ...editNf, data_emissao: e.target.value })} /></div>
              <div><Label>Valor</Label><Input type="number" step="0.01" value={editNf.valor ?? 0} onChange={(e) => setEditNf({ ...editNf, valor: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditNf(null)}>Cancelar</Button>
            <Button onClick={() => saveNf.mutate()} disabled={saveNf.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
