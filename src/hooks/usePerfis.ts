import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { AppModulo } from "@/hooks/usePermissions";

export interface Perfil {
  id: string;
  empresa_id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

export interface PerfilItem {
  id: string;
  perfil_id: string;
  modulo: AppModulo;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export function usePerfis() {
  const { empresaId } = useAuth();
  const query = useQuery({
    queryKey: [empresaId, "perfis-permissao"],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfis_permissao")
        .select("id, empresa_id, nome, descricao, ativo")
        .order("nome", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Perfil[];
    },
  });
  return { perfis: (query.data ?? []).filter((p) => p.ativo), todos: query.data ?? [], isLoading: query.isLoading };
}

export function usePerfilItens(perfilId?: string | null) {
  const { empresaId } = useAuth();
  return useQuery({
    queryKey: [empresaId, "perfil-itens", perfilId],
    enabled: !!empresaId && !!perfilId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfil_permissao_itens")
        .select("id, perfil_id, modulo, can_view, can_create, can_edit, can_delete")
        .eq("perfil_id", perfilId!);
      if (error) throw error;
      return (data ?? []) as PerfilItem[];
    },
  });
}
