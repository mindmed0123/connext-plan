import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/obra-helpers";
import { format } from "date-fns";

const LABEL: Record<string, string> = {
  em_elaboracao: "Em elaboração", enviado: "Enviado", em_negociacao: "Em negociação", aprovado: "Aprovado", reprovado: "Reprovado",
};

export default function Orcamentos() {
  const { data } = useQuery({
    queryKey: ["all-orcamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamentos")
        .select("*, obras(codigo_chamado)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Orçamentos</h1>
        <p className="text-sm text-muted-foreground">Orçamentos de todas as obras</p>
      </div>
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chamado</TableHead>
              <TableHead>Nº</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Envio</TableHead>
              <TableHead>Aprovador</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.length ?? 0) === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Sem orçamentos</TableCell></TableRow>
            )}
            {data?.map((o: any) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.obras?.codigo_chamado}</TableCell>
                <TableCell>{o.numero_orcamento || "—"}</TableCell>
                <TableCell>{formatCurrency(o.valor_orcamento)}</TableCell>
                <TableCell>{o.data_envio ? format(new Date(o.data_envio), "dd/MM/yyyy") : "—"}</TableCell>
                <TableCell>{o.engenheiro_aprovador || "—"}</TableCell>
                <TableCell className="text-xs">{LABEL[o.status] || o.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
