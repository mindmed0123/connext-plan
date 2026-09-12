import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/obra-helpers";

/** Card por obra: % físico previsto (cronograma) × % financeiro realizado (razão). */
export function AvancoObras() {
  const { empresaId } = useAuth();

  const { data = [] } = useQuery({
    queryKey: [empresaId, "obras-avanco"],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_obras_avanco");
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!data.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Avanço das obras (previsto × realizado)</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.map((o) => (
          <Link
            key={o.obra_id}
            to={`/obras/${o.obra_id}?tab=orcado-realizado`}
            className="rounded-lg border p-3 transition-colors hover:bg-muted/50"
          >
            <div className="truncate text-sm font-medium">{o.codigo_chamado || o.descricao}</div>
            <div className="mt-2 space-y-2">
              <div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Físico previsto</span>
                  <span>{Number(o.pct_fisico_previsto || 0).toFixed(1)}%</span>
                </div>
                <Progress value={Math.min(100, Number(o.pct_fisico_previsto || 0))} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Financeiro realizado</span>
                  <span>{Number(o.pct_financeiro_realizado || 0).toFixed(1)}%</span>
                </div>
                <Progress value={Math.min(100, Number(o.pct_financeiro_realizado || 0))} className="h-2" />
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Realizado {formatCurrency(Number(o.realizado || 0))} de {formatCurrency(Number(o.previsto_total || 0))}
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
