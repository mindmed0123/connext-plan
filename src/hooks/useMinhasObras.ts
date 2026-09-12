import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ObraSimples = {
  id: string;
  codigo_chamado: string;
  descricao_servico: string | null;
  endereco: string | null;
  status: string;
};

/**
 * Obras visíveis para o usuário. A própria política de acesso do banco
 * já limita o operacional às obras em que ele está vinculado.
 */
export function useMinhasObras() {
  const { empresaId } = useAuth();
  return useQuery({
    queryKey: [empresaId, "minhas-obras"],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras")
        .select("id, codigo_chamado, descricao_servico, endereco, status")
        .eq("arquivada", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ObraSimples[];
    },
  });
}
