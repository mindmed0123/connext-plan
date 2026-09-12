import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ContaBancaria = {
  id: string;
  nome: string;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo: string;
  saldo_inicial: number;
  data_saldo_inicial: string | null;
  ativo: boolean;
};

export function useContasBancarias() {
  const { empresaId } = useAuth();
  const { data = [], isLoading } = useQuery({
    queryKey: [empresaId, "contas-bancarias"],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_bancarias")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as ContaBancaria[];
    },
  });
  return { contas: data, isLoading };
}

export function useSaldosContas() {
  const { empresaId } = useAuth();
  return useQuery({
    queryKey: [empresaId, "saldos-contas"],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_saldos_contas", { _empresa_id: empresaId! });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useFornecedores() {
  const { empresaId } = useAuth();
  const { data = [], isLoading } = useQuery({
    queryKey: [empresaId, "fornecedores"],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.from("fornecedores").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
  return { fornecedores: data, isLoading };
}
