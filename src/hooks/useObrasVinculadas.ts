import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Retorna true se o usuário logado tem ao menos um vínculo em obra_responsaveis.
 * Usado para liberar acesso à seção "Minhas obras" mesmo sem permissão geral.
 */
export function useObrasVinculadas() {
  const { user, authReady } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["minhas-obras-vinculadas", user?.id],
    enabled: authReady && !!user,
    queryFn: async () => {
      const { data: pessoa } = await supabase
        .from("pessoas")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!pessoa) return { temVinculo: false, pessoaId: null as string | null };
      const { count } = await supabase
        .from("obra_responsaveis")
        .select("id", { count: "exact", head: true })
        .eq("pessoa_id", pessoa.id);
      return { temVinculo: (count ?? 0) > 0, pessoaId: pessoa.id };
    },
    staleTime: 60_000,
  });

  return {
    temVinculo: data?.temVinculo ?? false,
    pessoaId: data?.pessoaId ?? null,
    isLoading: !authReady || isLoading,
  };
}
