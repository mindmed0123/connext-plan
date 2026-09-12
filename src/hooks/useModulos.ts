import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ModuloChave, PerfilOperacao, PRESETS, SEMPRE_ATIVOS } from "@/lib/modulos";

export function useModulos() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();

  const perfilQuery = useQuery({
    queryKey: [empresaId, "empresa-perfil-operacao"],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresa_config")
        .select("perfil_operacao")
        .maybeSingle();
      if (error) throw error;
      return ((data as any)?.perfil_operacao ?? null) as PerfilOperacao | null;
    },
  });

  const modulosQuery = useQuery({
    queryKey: [empresaId, "empresa-modulos"],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("empresa_modulos").select("modulo, ativo");
      if (error) throw error;
      return (data ?? []) as { modulo: string; ativo: boolean }[];
    },
  });

  const perfil = perfilQuery.data ?? null;
  const linhas = modulosQuery.data ?? [];
  const mapa = new Map(linhas.map((l) => [l.modulo, l.ativo]));

  const moduloAtivo = (chave: ModuloChave) => {
    if (SEMPRE_ATIVOS.includes(chave)) return true;
    if (mapa.has(chave)) return mapa.get(chave) as boolean;
    // Sem perfil escolhido ainda: tudo visível, para não esconder nada de quem já usa.
    if (!perfil) return true;
    return PRESETS[perfil].includes(chave);
  };

  const setModulo = async (chave: ModuloChave, ativo: boolean) => {
    if (!empresaId) return;
    const { error } = await supabase
      .from("empresa_modulos")
      .upsert({ empresa_id: empresaId, modulo: chave, ativo }, { onConflict: "empresa_id,modulo" });
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: [empresaId, "empresa-modulos"] });
  };

  const aplicarPerfil = async (novo: PerfilOperacao) => {
    const { error } = await supabase.rpc("aplicar_preset_perfil" as any, { _perfil: novo } as any);
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: [empresaId, "empresa-modulos"] });
    await qc.invalidateQueries({ queryKey: [empresaId, "empresa-perfil-operacao"] });
    await qc.invalidateQueries({ queryKey: [empresaId, "empresa-rotulos"] });
    await qc.invalidateQueries({ queryKey: [empresaId, "empresa-config"] });
  };

  return {
    perfil,
    moduloAtivo,
    setModulo,
    aplicarPerfil,
    isLoading: perfilQuery.isLoading || modulosQuery.isLoading,
  };
}
