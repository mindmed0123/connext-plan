import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

const STATUS_LABEL: Record<string, string> = {
  nao_iniciada: "Não iniciada", em_execucao: "Em execução", pausada: "Pausada", finalizada: "Finalizada",
};

export default function Execucoes() {
  const { data } = useQuery({
    queryKey: ["all-execucoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("execucoes")
        .select("*, obras(codigo_chamado)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Execuções</h1>
        <p className="text-sm text-muted-foreground">Equipes em campo e prazos</p>
      </div>
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chamado</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.length ?? 0) === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Sem execuções</TableCell></TableRow>
            )}
            {data?.map((x: any) => (
              <TableRow key={x.id}>
                <TableCell className="font-medium">{x.obras?.codigo_chamado}</TableCell>
                <TableCell className="text-xs">{x.tipo_execucao === "terceirizado" ? `Terc.: ${x.nome_terceirizado}` : "Equipe própria"}</TableCell>
                <TableCell>{x.responsavel_obra}</TableCell>
                <TableCell>{x.data_inicio ? format(new Date(x.data_inicio), "dd/MM/yyyy") : "—"}</TableCell>
                <TableCell>{x.prazo_estimado ? `${x.prazo_estimado} d` : "—"}</TableCell>
                <TableCell className="text-xs">{STATUS_LABEL[x.status] || x.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
