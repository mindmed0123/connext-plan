import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Linha = {
  empresa_id: string;
  empresa_nome: string;
  plano: string | null;
  obras_ativas: number;
  limite_obras: number | null;
  usuarios_ativos: number;
  limite_usuarios: number | null;
};

function Uso({ usado, limite }: { usado: number; limite: number | null }) {
  if (!limite || limite <= 0) return <span className="text-sm">{usado} / ilimitado</span>;
  const cheio = usado >= limite;
  const quase = !cheio && usado >= limite * 0.8;
  return (
    <Badge variant={cheio ? "destructive" : quase ? "secondary" : "outline"}>
      {usado} / {limite}
    </Badge>
  );
}

export function ConsumoEmpresas() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-consumo-empresas"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_consumo_empresas");
      if (error) throw error;
      return (data ?? []) as Linha[];
    },
  });

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">Consumo por empresa</h2>
        <p className="text-sm text-muted-foreground">Obras ativas e pessoas com acesso × limite do plano.</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empresa</TableHead>
            <TableHead>Plano</TableHead>
            <TableHead>Obras</TableHead>
            <TableHead>Usuários</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">Carregando...</TableCell></TableRow>
          )}
          {data?.map((l) => (
            <TableRow key={l.empresa_id}>
              <TableCell className="font-medium">{l.empresa_nome}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{l.plano ?? "sem plano ativo"}</TableCell>
              <TableCell><Uso usado={Number(l.obras_ativas)} limite={l.limite_obras} /></TableCell>
              <TableCell><Uso usado={Number(l.usuarios_ativos)} limite={l.limite_usuarios} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
