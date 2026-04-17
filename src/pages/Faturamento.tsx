import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/obra-helpers";
import { format } from "date-fns";

export default function Faturamento() {
  const rcs = useQuery({
    queryKey: ["faturamento-rcs"],
    queryFn: async () => (await supabase.from("rcs").select("*, obras(codigo_chamado)").order("created_at", { ascending: false })).data,
  });
  const pcs = useQuery({
    queryKey: ["faturamento-pcs"],
    queryFn: async () => (await supabase.from("pedidos_compra").select("*, obras(codigo_chamado)").order("created_at", { ascending: false })).data,
  });
  const nfs = useQuery({
    queryKey: ["faturamento-nfs"],
    queryFn: async () => (await supabase.from("notas_fiscais").select("*, obras(codigo_chamado)").order("created_at", { ascending: false })).data,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Faturamento</h1>
        <p className="text-sm text-muted-foreground">RCs, pedidos de compra e notas fiscais</p>
      </div>
      <Tabs defaultValue="rcs">
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
                    <TableCell className="font-medium">{r.obras?.codigo_chamado}</TableCell>
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
              <TableHeader><TableRow><TableHead>Chamado</TableHead><TableHead>Nº pedido</TableHead><TableHead>Data</TableHead><TableHead>Valor</TableHead></TableRow></TableHeader>
              <TableBody>
                {pcs.data?.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.obras?.codigo_chamado}</TableCell>
                    <TableCell>{p.numero_pedido}</TableCell>
                    <TableCell>{p.data_recebimento && format(new Date(p.data_recebimento), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{formatCurrency(p.valor)}</TableCell>
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
                    <TableCell className="font-medium">{n.obras?.codigo_chamado}</TableCell>
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
    </div>
  );
}
