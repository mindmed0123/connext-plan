import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateBR } from "@/lib/date";

export default function Vistorias() {
  const { data } = useQuery({
    queryKey: ["all-vistorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vistorias")
        .select("*, obras(codigo_chamado, regiao)")
        .order("data_vistoria", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Vistorias</h1>
        <p className="text-sm text-muted-foreground">Todas as vistorias registradas</p>
      </div>
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chamado</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Observações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.length ?? 0) === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Sem vistorias registradas</TableCell></TableRow>
            )}
            {data?.map((v: any) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">{v.obras?.codigo_chamado}</TableCell>
                <TableCell>{formatDateBR(v.data_vistoria)}</TableCell>
                <TableCell>{v.responsavel_vistoria}</TableCell>
                <TableCell><span className="text-xs">{v.status}</span></TableCell>
                <TableCell className="max-w-md truncate text-xs text-muted-foreground">{v.observacoes}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
