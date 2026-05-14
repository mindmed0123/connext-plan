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
        .select("role, empresa_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      const rows = data ?? [];
      const roles = rows.map((r) => r.role as AppRole);
      const order: AppRole[] = ["super_admin", "admin", "gestor", "financeiro", "engenheiro", "operacional"];
      const top = order.find((r) => roles.includes(r)) ?? "operacional";
      const empresaId = rows.find((r) => r.empresa_id)?.empresa_id ?? null;
      return { roles, role: top, empresaId };
    },
  });

  const role = data?.role;
  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "admin" || role === "gestor";
  const isOperacional = role === "operacional" || role === "engenheiro" || role === "financeiro";

  return { role, roles: data?.roles ?? [], empresaId: data?.empresaId ?? null, isSuperAdmin, isAdmin, isOperacional, isLoading };
}
