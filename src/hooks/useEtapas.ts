import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ObraEtapa = { id: string; obra_id: string; nome: string; ordem: number };
export type OrcItem = { id: string; descricao: string; etapa_id: string | null; subtotal: number; quantidade: number };

/** Etapas de uma obra (sempre da empresa do usuário — RLS + queryKey por empresa). */
export function useEtapas(obraId?: string | null) {
  const { empresaId } = useAuth();
  return useQuery({
    queryKey: [empresaId, "obra-etapas", obraId],
    enabled: !!empresaId && !!obraId,
    queryFn: async (): Promise<ObraEtapa[]> => {
      const { data, error } = await supabase
        .from("obra_etapas")
        .select("id, obra_id, nome, ordem")
        .eq("obra_id", obraId!)
        .order("ordem")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Itens do orçamento aprovado da obra. */
export function useItensOrcamento(obraId?: string | null) {
  const { empresaId } = useAuth();
  return useQuery({
    queryKey: [empresaId, "obra-orcamento-itens", obraId],
    enabled: !!empresaId && !!obraId,
    queryFn: async (): Promise<OrcItem[]> => {
      const { data: orcs } = await supabase
        .from("orcamentos")
        .select("id")
        .eq("obra_id", obraId!)
        .eq("status", "aprovado");
      const ids = (orcs ?? []).map((o) => o.id);
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from("orcamento_itens")
        .select("id, descricao, etapa_id, subtotal, quantidade")
        .in("orcamento_id", ids)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as OrcItem[];
    },
  });
}

const chaveUltimaEtapa = (empresaId: string | null | undefined, obraId: string) =>
  `ultima-etapa:${empresaId ?? "x"}:${obraId}`;

export function lerUltimaEtapa(empresaId: string | null | undefined, obraId?: string | null) {
  if (!obraId) return null;
  try {
    return localStorage.getItem(chaveUltimaEtapa(empresaId, obraId));
  } catch {
    return null;
  }
}

export function salvarUltimaEtapa(empresaId: string | null | undefined, obraId?: string | null, etapaId?: string | null) {
  if (!obraId) return;
  try {
    if (etapaId) localStorage.setItem(chaveUltimaEtapa(empresaId, obraId), etapaId);
    else localStorage.removeItem(chaveUltimaEtapa(empresaId, obraId));
  } catch {
    /* ignore */
  }
}
