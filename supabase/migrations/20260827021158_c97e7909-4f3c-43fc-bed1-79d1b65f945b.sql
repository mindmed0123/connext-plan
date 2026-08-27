CREATE OR REPLACE FUNCTION public.get_obra_financeiro_resumo(_obra_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(obra_id uuid, codigo_chamado text, receita_orcada numeric, receita_faturada numeric, receita_recebida numeric, custo_materiais numeric, custo_terceirizados_pago numeric, custo_terceirizados_previsto numeric, custo_cartao numeric, despesas_realizadas numeric, custo_total numeric, saldo numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH e AS (SELECT public.get_user_empresa_id() AS eid),
  base AS (
    SELECT
      o.id,
      o.codigo_chamado,
      COALESCE((SELECT SUM(valor_orcamento) FROM orcamentos WHERE obra_id = o.id AND status = 'aprovado'), 0)
        + COALESCE((SELECT SUM(valor_total) FROM obra_adendos WHERE obra_id = o.id AND status IN ('assinado','em_execucao','concluido')), 0) AS receita_orcada,
      COALESCE((SELECT SUM(valor) FROM notas_fiscais WHERE obra_id = o.id), 0) AS receita_faturada,
      COALESCE((SELECT SUM(valor) FROM recebimentos WHERE obra_id = o.id AND status = 'recebido'), 0)
        + COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros
                    WHERE obra_id = o.id AND tipo = 'receita' AND status = 'realizado'
                      AND COALESCE(origem,'') <> 'recebimento'), 0) AS receita_recebida,
      COALESCE((SELECT SUM(valor_total) FROM materiais_obra WHERE obra_id = o.id), 0) AS custo_materiais,
      COALESCE((SELECT SUM(pp.valor) FROM parcelas_pagamento pp
                JOIN contratacoes_terceirizado ct ON ct.id = pp.contratacao_id
                WHERE ct.obra_id = o.id AND pp.status = 'pago'), 0) AS custo_terc_pago,
      COALESCE((SELECT SUM(valor_total) FROM contratacoes_terceirizado WHERE obra_id = o.id AND status_financeiro <> 'cancelado'), 0) AS custo_terc_prev,
      COALESCE((SELECT SUM(valor) FROM cartao_despesas WHERE obra_id = o.id), 0) AS custo_cartao,
      COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros
                WHERE obra_id = o.id AND tipo = 'despesa' AND status = 'realizado'
                  AND COALESCE(origem,'') <> 'parcela_pagamento'), 0) AS despesas
    FROM obras o, e
    WHERE o.empresa_id = e.eid
      AND (_obra_id IS NULL OR o.id = _obra_id)
  )
  SELECT id, codigo_chamado, receita_orcada, receita_faturada, receita_recebida,
         custo_materiais, custo_terc_pago, custo_terc_prev, custo_cartao, despesas,
         custo_materiais + custo_terc_pago + custo_cartao + despesas,
         receita_recebida - (custo_materiais + custo_terc_pago + custo_cartao + despesas)
  FROM base;
$function$;