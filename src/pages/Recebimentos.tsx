import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/obra-helpers";
import { format } from "date-fns";
import { toast } from "sonner";

export default function Recebimentos() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["all-recebimentos"],
    queryFn: async () => (await supabase.from("recebimentos").select("*, obras(codigo_chamado)").order("data_prevista", { ascending: true })).data,
  });

  const marcarRecebido = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recebimentos").update({
        status: "recebido", data_recebido: new Date().toISOString().slice(0, 10),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recebimento confirmado");
      qc.invalidateQueries({ queryKey: ["all-recebimentos"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Recebimentos</h1>
        <p className="text-sm text-muted-foreground">Fluxo de caixa previsto e realizado</p>
      </div>
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chamado</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Previsto</TableHead>
              <TableHead>Recebido</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.length ?? 0) === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Sem recebimentos</TableCell></TableRow>
            )}
            {data?.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.obras?.codigo_chamado}</TableCell>
                <TableCell>{formatCurrency(r.valor)}</TableCell>
                <TableCell>{r.data_prevista ? format(new Date(r.data_prevista), "dd/MM/yyyy") : "—"}</TableCell>
                <TableCell>{r.data_recebido ? format(new Date(r.data_recebido), "dd/MM/yyyy") : "—"}</TableCell>
                <TableCell className="text-xs">{r.status === "recebido" ? "✓ Recebido" : "A receber"}</TableCell>
                <TableCell>
                  {r.status === "a_receber" && (
                    <Button size="sm" variant="outline" onClick={() => marcarRecebido.mutate(r.id)}>
                      Marcar recebido
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
