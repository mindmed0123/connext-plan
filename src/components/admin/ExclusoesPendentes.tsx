import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

const diasRestantes = (iso: string) =>
  Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

/** Alerta do administrador do sistema: contas que pediram exclusão e ainda não foram apagadas. */
export function ExclusoesPendentes() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "exclusoes-pendentes"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_exclusoes_pendentes");
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading || !data || data.length === 0) return null;

  return (
    <div className="space-y-3">
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          {data.length === 1
            ? "1 empresa pediu a exclusão da conta e ainda não foi apagada."
            : `${data.length} empresas pediram a exclusão da conta e ainda não foram apagadas.`}{" "}
          A exclusão é feita manualmente pela equipe dentro do prazo.
        </AlertDescription>
      </Alert>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Quem pediu</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Pedido em</TableHead>
              <TableHead>Prazo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((p) => {
              const restam = diasRestantes(p.prazo_em);
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.empresa_nome}</TableCell>
                  <TableCell className="text-muted-foreground">{p.solicitado_por_email ?? "—"}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">{p.motivo ?? "—"}</TableCell>
                  <TableCell>{dia(p.created_at)}</TableCell>
                  <TableCell>
                    <Badge variant={restam <= 7 ? "destructive" : "secondary"}>
                      {dia(p.prazo_em)}
                      {restam >= 0 ? ` · faltam ${restam}d` : ` · vencido há ${-restam}d`}
                    </Badge>
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
