import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface EmpresaConfig {
  empresa_id: string;
  regime_tributario: string | null;
  cprb: boolean;
  aliquota_inss_padrao: number;
  aliquota_inss_cprb: number;
  aliquota_iss_padrao: number;
  aliquota_irrf_padrao: number;
  aliquota_pcc_padrao: number;
  prazo_pagamento_padrao: number;
  bdi_ac: number;
  bdi_s: number;
  bdi_r: number;
  bdi_df: number;
  bdi_l: number;
  bdi_i: number;
  mascara_orcamento: string;
  mascara_medicao: string;
  mascara_contrato: string;
  mascara_nf: string;
  validade_orcamento_dias: number;
  texto_condicoes: string | null;
  texto_observacoes: string | null;
  texto_rodape: string | null;
  cor_primaria: string;
  email_remetente_nome: string | null;
  email_remetente_endereco: string | null;
  usa_estoque: boolean;
}

export const CONFIG_PADRAO: Omit<EmpresaConfig, "empresa_id"> = {
  regime_tributario: null,
  cprb: false,
  aliquota_inss_padrao: 11,
  aliquota_inss_cprb: 3.5,
  aliquota_iss_padrao: 0,
  aliquota_irrf_padrao: 1.5,
  aliquota_pcc_padrao: 4.65,
  prazo_pagamento_padrao: 30,
  bdi_ac: 0,
  bdi_s: 0,
  bdi_r: 0,
  bdi_df: 0,
  bdi_l: 0,
  bdi_i: 0,
  mascara_orcamento: "ORC-{ano}-{seq}",
  mascara_medicao: "MED-{ano}-{seq}",
  mascara_contrato: "CTR-{ano}-{seq}",
  mascara_nf: "NF-{ano}-{seq}",
  validade_orcamento_dias: 30,
  texto_condicoes: null,
  texto_observacoes: null,
  texto_rodape: null,
  cor_primaria: "#52C4B8",
  email_remetente_nome: null,
  email_remetente_endereco: null,
  usa_estoque: false,
};

export function useEmpresaConfig() {
  const { empresaId } = useAuth();

  const query = useQuery({
    queryKey: [empresaId, "empresa-config"],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("empresa_config").select("*").maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as EmpresaConfig | null;
    },
  });

  const config = useMemo(
    () => ({ ...CONFIG_PADRAO, empresa_id: empresaId ?? "", ...(query.data ?? {}) }) as EmpresaConfig,
    [query.data, empresaId],
  );

  return { config, raw: query.data ?? null, isLoading: query.isLoading, empresaId };
}

export { hexToRgb, lighten } from "@/lib/color";
