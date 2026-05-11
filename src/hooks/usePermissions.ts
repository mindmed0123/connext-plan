import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "./useUserRole";

export const APP_MODULOS = [
  "dashboard",
  "obras",
  "financeiro",
  "faturamento",
  "equipes",
  "vistorias",
  "orcamentos",
  "servicos",
  "execucoes",
  "etapas",
] as const;
export type AppModulo = (typeof APP_MODULOS)[number];

export const MODULO_LABEL: Record<AppModulo, string> = {
  dashboard: "Dashboard",
  obras: "Obras",
  financeiro: "Financeiro",
  faturamento: "Faturamento",
  equipes: "Equipes",
  vistorias: "Vistorias",
  orcamentos: "Orçamentos",
  execucoes: "Execuções",
  etapas: "Etapas",
};

export type AppAcao = "view" | "create" | "edit" | "delete";

export type PermissaoLinha = {
  modulo: AppModulo;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

/**
 * Permissões do usuário logado. Super admin / admin / gestor têm tudo liberado.
 * Para administrativo "comum" (sem role admin), aplica granularidade da tabela pessoa_permissoes.
 */
export function usePermissions() {
  const { user } = useAuth();
  const { isSuperAdmin, isAdmin, isLoading: roleLoading } = useUserRole();

  const { data, isLoading } = useQuery({
    queryKey: ["my-permissions", user?.id],
    enabled: !!user && !isAdmin && !roleLoading,
    queryFn: async () => {
      // Buscar a pessoa vinculada ao usuário
      const { data: pessoa } = await supabase
        .from("pessoas")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!pessoa) return [] as PermissaoLinha[];
      const { data, error } = await supabase
        .from("pessoa_permissoes")
        .select("modulo, can_view, can_create, can_edit, can_delete")
        .eq("pessoa_id", pessoa.id);
      if (error) throw error;
      return (data ?? []) as PermissaoLinha[];
    },
  });

  const can = (modulo: AppModulo, acao: AppAcao = "view"): boolean => {
    if (isSuperAdmin || isAdmin) return true;
    const row = data?.find((r) => r.modulo === modulo);
    if (!row) return false;
    if (acao === "view") return row.can_view;
    if (acao === "create") return row.can_create;
    if (acao === "edit") return row.can_edit;
    return row.can_delete;
  };

  return {
    can,
    permissoes: data ?? [],
    isLoading: isLoading || roleLoading,
    isSuperAdmin,
    isAdmin,
  };
}
