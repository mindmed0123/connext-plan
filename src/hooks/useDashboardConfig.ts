import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const TODOS_OS_CARDS = [
  { id: "obras_ativas", label: "Obras ativas" },
  { id: "em_orcamento", label: "Em orçamento (valor)" },
  { id: "em_execucao", label: "Em execução (valor)" },
  { id: "finalizadas", label: "Finalizadas aguardando" },
  { id: "total_a_receber", label: "Total a receber" },
  { id: "recebimentos_15d", label: "Recebimentos em 15 dias" },
  { id: "pago_terceirizados", label: "Pago a terceirizados" },
  { id: "pendente_terceirizados", label: "Pendente terceirizados" },
] as const;

const DEFAULT_IDS = TODOS_OS_CARDS.map((c) => c.id);

export function useDashboardConfig() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();

  const { data: config } = useQuery({
    queryKey: ["dashboard-config", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("empresa_dashboard_config")
        .select("cards_visiveis")
        .eq("empresa_id", empresaId!)
        .maybeSingle();
      return (data?.cards_visiveis as string[]) ?? DEFAULT_IDS;
    },
  });

  const saveConfig = useMutation({
    mutationFn: async (cards: string[]) => {
      const { error } = await supabase.from("empresa_dashboard_config").upsert({
        empresa_id: empresaId!,
        cards_visiveis: cards,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard-config"] }),
  });

  return { config: (config as string[]) ?? DEFAULT_IDS, saveConfig, TODOS_OS_CARDS };
}
