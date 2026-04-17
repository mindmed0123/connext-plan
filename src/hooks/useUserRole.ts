import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "super_admin" | "admin" | "gestor" | "engenheiro" | "financeiro" | "operacional";

export function useUserRole() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["user-role", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      const roles = (data ?? []).map((r) => r.role as AppRole);
      // Highest precedence first
      const order: AppRole[] = ["super_admin", "admin", "gestor", "financeiro", "engenheiro", "operacional"];
      const top = order.find((r) => roles.includes(r)) ?? "operacional";
      return { roles, role: top };
    },
  });

  const role = data?.role;
  const isSuperAdmin = role === "super_admin";
  const isAdmin = isSuperAdmin || role === "admin" || role === "gestor";
  const isOperacional = role === "operacional" || role === "engenheiro" || role === "financeiro";
  // "Terceirizado" não é um app_role — é um tipo na tabela pessoas. UI o trata como operacional.

  return { role, roles: data?.roles ?? [], isSuperAdmin, isAdmin, isOperacional, isLoading };
}
