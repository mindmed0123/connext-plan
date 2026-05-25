import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "./useUserRole";


export const APP_MODULOS = [
  "dashboard",
  "obras",
  "financeiro",
  "faturamento",
  "cartoes",
  "compradores",
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
  cartoes: "Cartões de crédito",
  compradores: "Compradores",
  equipes: "Equipes",
  vistorias: "Vistorias",
  orcamentos: "Orçamentos",
  servicos: "Serviços",
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
 * Permissões do usuário logado. Admin / gestor têm tudo liberado na própria empresa.
 * Super admin acessa somente o painel administrativo do sistema.
 * Para administrativo "comum" (sem role admin), aplica granularidade da tabela pessoa_permissoes.
 */
export function usePermissions() {
  const { user } = useAuth();
  const { isSuperAdmin, isAdmin, isLoading: roleLoading } = useUserRole();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-permissions", user?.id],
    enabled: !!user && !isAdmin && !roleLoading,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    queryFn: async () => {
      // Buscar a pessoa vinculada ao usuário (pode haver mais de uma — pegamos a mais recente ativa)
      const { data: pessoas } = await supabase
        .from("pessoas")
        .select("id, status, created_at")
        .eq("user_id", user!.id)
        .order("status", { ascending: true }) // 'ativo' antes de 'inativo'
        .order("created_at", { ascending: false })
        .limit(1);
      const pessoa = pessoas?.[0];
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
    if (isSuperAdmin) return false;
    if (isAdmin) return true;
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
