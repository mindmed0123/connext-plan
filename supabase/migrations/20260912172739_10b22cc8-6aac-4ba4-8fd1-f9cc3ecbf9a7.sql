CREATE OR REPLACE FUNCTION public.get_desempenho_obras(_obra_id uuid DEFAULT NULL)
RETURNS TABLE (
  obra_id uuid, codigo_chamado text, descricao text,
  receita_orcada numeric, custo_orcado numeric, custo_realizado numeric,
  pct_executado numeric, pct_previsto numeric, valor_agregado numeric, valor_planejado numeric,
  idc numeric, idp numeric, custo_previsto_fim numeric, estouro_projetado numeric,
  medido_acumulado numeric, saldo_a_medir numeric, comprometido numeric,
  contas_a_vencer numeric, margem_projetada numeric, tem_linha_base boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_user_empresa_id();
BEGIN
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Empresa não identificada'; END IF;
  IF NOT (public.is_admin_or_super(auth.uid())
          OR public.has_permission(auth.uid(),'dashboard','view')
          OR public.has_permission(auth.uid(),'obras','view')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT o.id, o.codigo_chamado, o.descricao_servico,
      COALESCE((SELECT SUM(COALESCE(x.valor_total, x.valor_orcamento)) FROM public.orcamentos x
                 WHERE x.obra_id = o.id AND x.empresa_id = v_emp AND x.status = 'aprovado'),0)
      + COALESCE((SELECT SUM(a.valor_total) FROM public.obra_adendos a
                   WHERE a.obra_id = o.id AND a.empresa_id = v_emp
                     AND a.status IN ('assinado','em_execucao','concluido')),0) AS receita,
      COALESCE((SELECT SUM(c.valor_previsto) FROM public.cronograma_etapas c
                 WHERE c.obra_id = o.id AND c.empresa_id = v_emp),0) AS cron_total,
      COALESCE((SELECT SUM(c.valor_previsto) FROM public.cronograma_etapas c
                 WHERE c.obra_id = o.id AND c.empresa_id = v_emp
                   AND c.mes <= date_trunc('month',(now() AT TIME ZONE 'America/Sao_Paulo')::date)::date),0) AS cron_ate_hoje,
      COALESCE((SELECT SUM(l.valor) FROM public.lancamentos_financeiros l
                 WHERE l.obra_id = o.id AND l.empresa_id = v_emp
                   AND l.tipo = 'despesa' AND l.status = 'realizado'),0) AS realizado,
      COALESCE((SELECT MAX(m.valor_acumulado) FROM public.medicoes m
                 WHERE m.obra_id = o.id AND m.empresa_id = v_emp AND m.status = 'aprovada'),0) AS medido,
      COALESCE((SELECT SUM(oc.valor_total) FROM public.ordens_compra oc
                 WHERE oc.obra_id = o.id AND oc.empresa_id = v_emp
                   AND oc.status IN ('emitida','parcial')),0) AS oc_aberta,
      COALESCE((SELECT SUM(pp.valor - COALESCE(pp.valor_pago,0)) FROM public.contas_pagar_parcelas pp
                 JOIN public.contas_pagar cp ON cp.id = pp.conta_id AND cp.empresa_id = v_emp
                 WHERE cp.obra_id = o.id AND pp.empresa_id = v_emp AND pp.status <> 'pago'),0) AS cp_aberto,
      COALESCE((SELECT SUM(pp.valor - COALESCE(pp.valor_pago,0)) FROM public.contas_pagar_parcelas pp
                 JOIN public.contas_pagar cp ON cp.id = pp.conta_id AND cp.empresa_id = v_emp
                 WHERE cp.obra_id = o.id AND pp.empresa_id = v_emp AND pp.status <> 'pago'
                   AND pp.data_vencimento <= CURRENT_DATE + 30),0) AS cp_30
    FROM public.obras o
    WHERE o.empresa_id = v_emp AND COALESCE(o.arquivada,false) = false
      AND (_obra_id IS NULL OR o.id = _obra_id)
  ), calc AS (
    SELECT b.*,
      CASE WHEN b.cron_total > 0 THEN b.cron_total
           WHEN b.receita > 0 THEN b.receita
           ELSE 0 END AS bac,
      CASE WHEN b.receita > 0 THEN LEAST(b.medido / b.receita, 1)
           WHEN b.cron_total > 0 THEN LEAST(b.realizado / b.cron_total, 1)
           ELSE 0 END AS pct_exec,
      CASE WHEN b.cron_total > 0 THEN LEAST(b.cron_ate_hoje / b.cron_total, 1) ELSE NULL END AS pct_prev
    FROM base b
  )
  SELECT c.id, c.codigo_chamado, c.descricao_servico,
    ROUND(c.receita,2), ROUND(c.bac,2), ROUND(c.realizado,2),
    ROUND(c.pct_exec * 100, 2), ROUND(c.pct_prev * 100, 2),
    ROUND(c.bac * c.pct_exec, 2),
    ROUND(c.bac * COALESCE(c.pct_prev,0), 2),
    CASE WHEN c.realizado > 0 THEN ROUND((c.bac * c.pct_exec) / c.realizado, 4) ELSE NULL END,
    CASE WHEN COALESCE(c.pct_prev,0) > 0 THEN ROUND(c.pct_exec / c.pct_prev, 4) ELSE NULL END,
    CASE WHEN c.realizado > 0 AND c.pct_exec > 0
         THEN ROUND(c.bac / ((c.bac * c.pct_exec) / c.realizado), 2)
         ELSE ROUND(c.bac, 2) END,
    CASE WHEN c.realizado > 0 AND c.pct_exec > 0
         THEN ROUND(c.bac / ((c.bac * c.pct_exec) / c.realizado) - c.bac, 2)
         ELSE 0 END,
    ROUND(c.medido,2), ROUND(GREATEST(c.receita - c.medido,0),2),
    ROUND(c.oc_aberta + c.cp_aberto, 2), ROUND(c.cp_30,2),
    CASE WHEN c.receita > 0 THEN ROUND(((c.receita -
      CASE WHEN c.realizado > 0 AND c.pct_exec > 0
           THEN c.bac / ((c.bac * c.pct_exec) / c.realizado) ELSE c.bac END) / c.receita) * 100, 2)
      ELSE NULL END,
    (c.cron_total > 0)
  FROM calc c
  ORDER BY c.codigo_chamado;
END $$;
REVOKE EXECUTE ON FUNCTION public.get_desempenho_obras(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_desempenho_obras(uuid) TO authenticated;