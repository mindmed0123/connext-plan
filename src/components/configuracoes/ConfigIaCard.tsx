import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpresaConfig } from "@/hooks/useEmpresaConfig";
import { useSalvarConfig } from "@/components/configuracoes/ConfigFiscalCards";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const USOS = [
  {
    campo: "ia_orcamento" as const,
    titulo: "Assistente de orçamento",
    texto: "Sugere uma estimativa inicial a partir da área, do tipo de obra e dos seus custos por m² cadastrados.",
  },
  {
    campo: "ia_cotacao" as const,
    titulo: "Leitura de cotação",
    texto: "Lê o PDF ou a foto da cotação do fornecedor e devolve os itens já separados para conferência.",
  },
  {
    campo: "ia_diario" as const,
    titulo: "Relatório do período",
    texto: "Monta o texto do relatório a partir dos diários de obra do período escolhido.",
  },
];

export function ConfigIaCard() {
  const { empresaId } = useAuth();
  const { config } = useEmpresaConfig();
  const { salvar } = useSalvarConfig();

  const { data: consumo } = useQuery({
    queryKey: [empresaId, "ia-consumo-mes"],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ia_consumo_mes" as never);
      if (error) throw error;
      return (data ?? []) as { uso: string; execucoes: number; tokens: number; custo_estimado: number }[];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inteligência artificial</CardTitle>
        <CardDescription>
          Cada uso é ligado separadamente. Só o conteúdo do documento ou do período escolhido é enviado — nunca dados
          de outra empresa. Todo resultado nasce como rascunho, marcado como gerado por IA, e precisa da sua revisão.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {USOS.map((u) => (
          <div key={u.campo} className="flex items-start justify-between gap-4 rounded-md border p-3">
            <div>
              <Label className="text-sm font-medium">{u.titulo}</Label>
              <p className="text-sm text-muted-foreground">{u.texto}</p>
            </div>
            <Switch
              checked={Boolean((config as unknown as Record<string, boolean>)[u.campo])}
              onCheckedChange={(v) => void salvar({ [u.campo]: v } as never)}
            />
          </div>
        ))}

        {consumo && consumo.length > 0 && (
          <div className="rounded-md border p-3 text-sm">
            <p className="mb-1 font-medium">Uso neste mês</p>
            <ul className="space-y-0.5 text-muted-foreground">
              {consumo.map((c) => (
                <li key={c.uso}>
                  {c.uso}: {c.execucoes} pedido(s)
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
