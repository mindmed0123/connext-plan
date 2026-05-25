import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { formatCurrency } from "@/lib/obra-helpers";
import { format } from "date-fns";
import { FaturamentoFormDialog } from "@/components/financeiro/FaturamentoFormDialog";
import { PedidoCompraEditDialog } from "@/components/financeiro/PedidoCompraEditDialog";

export default function Faturamento() {
  const [tab, setTab] = useState<"rcs" | "pcs" | "nfs">("rcs");
  const [openTipo, setOpenTipo] = useState<"rc" | "pc" | "nf" | null>(null);
  const [editPc, setEditPc] = useState<any | null>(null);

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
              <TableHeader><TableRow><TableHead>Chamado</TableHead><TableHead>Nº RC</TableHead><TableHead>Data</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {rcs.data?.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{chamado(r)}{!r.obras && r.codigo_chamado_avulso && <span className="ml-2 text-[10px] text-muted-foreground">(avulso)</span>}</TableCell>
                    <TableCell>{r.numero_rc}</TableCell>
                    <TableCell>{r.data_rc && format(new Date(r.data_rc), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="text-xs">{r.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="pcs">
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>Chamado</TableHead><TableHead>Nº pedido</TableHead><TableHead>Recebimento</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead className="w-20 text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {pcs.data?.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{chamado(p)}{!p.obras && p.codigo_chamado_avulso && <span className="ml-2 text-[10px] text-muted-foreground">(avulso)</span>}</TableCell>
                    <TableCell>{p.numero_pedido}</TableCell>
                    <TableCell>{p.data_recebimento ? format(new Date(p.data_recebimento), "dd/MM/yyyy") : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{formatCurrency(p.valor)}</TableCell>
                    <TableCell className="text-xs capitalize">{p.status}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEditPc(p)}>Editar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="nfs">
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>Chamado</TableHead><TableHead>Nº NF</TableHead><TableHead>Emissão</TableHead><TableHead>Valor</TableHead></TableRow></TableHeader>
              <TableBody>
                {nfs.data?.map((n: any) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium">{chamado(n)}{!n.obras && n.codigo_chamado_avulso && <span className="ml-2 text-[10px] text-muted-foreground">(avulso)</span>}</TableCell>
                    <TableCell>{n.numero_nf}</TableCell>
                    <TableCell>{format(new Date(n.data_emissao), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{formatCurrency(n.valor)}</TableCell>
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
    </div>
  );
}
