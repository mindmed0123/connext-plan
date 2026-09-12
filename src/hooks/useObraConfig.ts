import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type StatusCategoria = "nao_iniciada" | "em_execucao" | "concluida" | "cancelada";

export interface ObraStatusCfg {
  id: string;
  empresa_id: string;
  chave: string;
  nome: string;
  cor: string;
  ordem: number;
  categoria: StatusCategoria;
  ativo: boolean;
  padrao: boolean;
}

export interface EmpresaRotulos {
  obra_singular: string;
  obra_plural: string;
  codigo_obra: string;
  comprador: string;
  cliente: string;
  orcamento: string;
  medicao: string;
  usa_codigo_obra: boolean;
  usa_regiao: boolean;
  usa_engenheiro: boolean;
  usa_comprador: boolean;
}

export const ROTULOS_PADRAO: EmpresaRotulos = {
  obra_singular: "Obra",
  obra_plural: "Obras",
  codigo_obra: "Código da obra",
  comprador: "Comprador",
  cliente: "Cliente",
  orcamento: "Orçamento",
  medicao: "Medição",
  usa_codigo_obra: true,
  usa_regiao: true,
  usa_engenheiro: true,
  usa_comprador: true,
};

export function useObraConfig() {
  const { empresaId } = useAuth();

  const statusQuery = useQuery({
    queryKey: [empresaId, "obra-status-config"],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obra_status_config")
        .select("*")
        .order("ordem", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ObraStatusCfg[];
    },
  });

  const rotulosQuery = useQuery({
    queryKey: [empresaId, "empresa-rotulos"],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("empresa_rotulos").select("*").maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as EmpresaRotulos | null;
    },
  });

  const todos = statusQuery.data ?? [];
  const statuses = todos.filter((s) => s.ativo);
  const byKey = new Map(todos.map((s) => [s.chave, s]));

  const rotulos: EmpresaRotulos = { ...ROTULOS_PADRAO, ...(rotulosQuery.data ?? {}) };

  return {
    statuses,
    todosStatuses: todos,
    isLoading: statusQuery.isLoading || rotulosQuery.isLoading,
    rotulos,
    statusLabel: (chave?: string | null) => (chave ? (byKey.get(chave)?.nome ?? chave) : "—"),
    statusColor: (chave?: string | null) => (chave ? (byKey.get(chave)?.cor ?? "#64748B") : "#64748B"),
    statusCategoria: (chave?: string | null): StatusCategoria | null =>
      chave ? (byKey.get(chave)?.categoria ?? null) : null,
    statusesDaCategoria: (cat: StatusCategoria) => statuses.filter((s) => s.categoria === cat),
  };
}
