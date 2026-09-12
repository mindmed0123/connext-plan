import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PapelGrupo = "receita_servico" | "material" | "subcontratado" | null;

export interface CategoriaGrupo {
  id: string;
  empresa_id: string;
  chave: string;
  nome: string;
  tipo: "receita" | "despesa";
  papel: PapelGrupo;
  ordem: number;
  ativo: boolean;
}

export interface CategoriaFinanceira {
  id: string;
  empresa_id: string;
  nome: string;
  cor: string | null;
  ativo: boolean;
  ordem: number;
  tipo: "receita" | "despesa";
  grupo_id: string | null;
}

export interface CentroCusto {
  id: string;
  empresa_id: string;
  nome: string;
  codigo: string | null;
  ativo: boolean;
}

export const PAPEIS_LABEL: Record<string, string> = {
  receita_servico: "Grupo padrão de receita de serviço",
  material: "Grupo padrão de material",
  subcontratado: "Grupo padrão de subcontratado",
};

export function useCategoriaGrupos() {
  const { empresaId } = useAuth();
  return useQuery({
    queryKey: [empresaId, "categoria-grupos"],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categoria_grupos")
        .select("id, empresa_id, chave, nome, tipo, papel, ordem, ativo")
        .order("ordem", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CategoriaGrupo[];
    },
  });
}

export function useCategoriasFinanceiras(apenasAtivas = true) {
  const { empresaId } = useAuth();
  const query = useQuery({
    queryKey: [empresaId, "categorias-financeiras-plano"],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .select("id, empresa_id, nome, cor, ativo, ordem, tipo, grupo_id")
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CategoriaFinanceira[];
    },
  });
  const todas = query.data ?? [];
  return { categorias: apenasAtivas ? todas.filter((c) => c.ativo) : todas, todas, isLoading: query.isLoading };
}

export function useCentrosCusto(apenasAtivos = true) {
  const { empresaId } = useAuth();
  const query = useQuery({
    queryKey: [empresaId, "centros-custo"],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("centros_custo")
        .select("id, empresa_id, nome, codigo, ativo")
        .order("nome", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CentroCusto[];
    },
  });
  const todos = query.data ?? [];
  return { centros: apenasAtivos ? todos.filter((c) => c.ativo) : todos, todos, isLoading: query.isLoading };
}
