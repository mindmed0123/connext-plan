import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/obra-helpers";
import { format } from "date-fns";
import { toast } from "sonner";

export default function Recebimentos() {
  const qc = useQueryClient();
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

  const marcarRecebido = useMutation({
    mutationFn: async (r: any) => {
      const hoje = new Date().toISOString().slice(0, 10);
      // Atualiza o recebimento
      const { error } = await supabase.from("recebimentos").update({
        status: "recebido", data_recebido: hoje,
      }).eq("id", r.id);
      if (error) throw error;
      // Se vier de um PC, sincroniza o status do PC também
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Recebimentos</h1>
        <p className="text-sm text-muted-foreground">
          Fluxo de caixa previsto e realizado · Inclui automaticamente todos os pedidos de compra com data de recebimento informada
        </p>
      </div>
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chamado</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Previsto</TableHead>
              <TableHead>Recebido</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
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
              const chamado = r.obras?.codigo_chamado ?? pc?.codigo_chamado_avulso ?? "—";
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
                  <TableCell>{r.data_prevista ? format(new Date(r.data_prevista), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell>{r.data_recebido ? format(new Date(r.data_recebido), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell className="text-xs">{r.status === "recebido" ? "✓ Recebido" : "A receber"}</TableCell>
                  <TableCell>
                    {r.status === "a_receber" && (
                      <Button size="sm" variant="outline" onClick={() => marcarRecebido.mutate(r)}>
                        Marcar recebido
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
