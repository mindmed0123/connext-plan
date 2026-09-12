import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ListaNome =
  | "unidade"
  | "condicao_pagamento"
  | "tipo_obra"
  | "tipo_comprador"
  | "forma_pagamento";

export interface OpcaoLista {
  id: string;
  lista: string;
  valor: string;
  rotulo: string;
  ordem: number;
  ativo: boolean;
}

export const LISTAS_LABEL: Record<ListaNome, string> = {
  unidade: "Unidades de medida",
  condicao_pagamento: "Condições de pagamento",
  tipo_obra: "Tipos de obra",
  tipo_comprador: "Tipos de comprador",
  forma_pagamento: "Formas de pagamento (rótulos)",
};

/** Opções cadastradas pela empresa para uma lista. Sempre filtradas pelo tenant via RLS. */
export function useListaOpcoes(lista: ListaNome, incluirInativos = false) {
  const { empresaId } = useAuth();
  const query = useQuery({
    queryKey: [empresaId, "listas-opcoes", lista],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listas_opcoes")
        .select("id, lista, valor, rotulo, ordem, ativo")
        .eq("lista", lista)
        .order("ordem", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      return (data ?? []) as OpcaoLista[];
    },
  });

  const todas = query.data ?? [];
  return {
    opcoes: incluirInativos ? todas : todas.filter((o) => o.ativo),
    todas,
    isLoading: query.isLoading,
  };
}

export function useTodasListas() {
  const { empresaId } = useAuth();
  return useQuery({
    queryKey: [empresaId, "listas-opcoes", "todas"],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listas_opcoes")
        .select("id, lista, valor, rotulo, ordem, ativo")
        .order("lista", { ascending: true })
        .order("ordem", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      return (data ?? []) as OpcaoLista[];
    },
  });
}
