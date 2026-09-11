import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tabelas que alimentam informações compartilhadas entre as abas do sistema.
 * Qualquer alteração em uma delas atualiza todas as telas abertas.
 */
const TABELAS_COMPARTILHADAS = [
  "obras",
  "obra_adendos",
  "obra_responsaveis",
  "obra_timeline",
  "orcamentos",
  "orcamento_itens",
  "execucoes",
  "vistorias",
  "contratacoes_terceirizado",
  "parcelas_pagamento",
  "materiais_obra",
  "notas_fiscais",
  "pedidos_compra",
  "rcs",
  "recebimentos",
  "lancamentos_financeiros",
  "cartao_despesas",
  "cartoes_credito",
  "compradores",
  "comprador_contratos",
  "pessoas",
  "pessoa_documentos",
  "pessoa_permissoes",
  "servicos",
  "medicoes",
  "contratos_clientes",
] as const;

/**
 * Mantém todo o sistema conversando entre si: ao mudar algo em qualquer aba
 * (ou em outro usuário/dispositivo), todas as consultas ativas são atualizadas.
 */
export function useRealtimeSync() {
  const qc = useQueryClient();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const invalidarTudo = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        qc.invalidateQueries();
      }, 350);
    };

    const channel = supabase.channel("sync-global");
    for (const table of TABELAS_COMPARTILHADAS) {
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table },
        invalidarTudo,
      );
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
