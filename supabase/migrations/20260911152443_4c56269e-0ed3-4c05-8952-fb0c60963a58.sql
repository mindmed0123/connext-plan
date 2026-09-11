CREATE OR REPLACE FUNCTION public.get_dre_obra(_empresa_id uuid, _obra_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(obra_id uuid, obra_codigo text, receita_contratada numeric, receita_medida numeric,
 receita_recebida numeric, custo_subcontratado numeric, custo_materiais numeric,
 custo_total_real numeric, margem_bruta numeric, margem_pct numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
 IF NOT(public.is_super_admin(auth.uid()) OR _empresa_id=public.get_user_empresa_id()) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
 RETURN QUERY WITH base AS(
  SELECT o.id,o.codigo_chamado,
   COALESCE((SELECT SUM(COALESCE(valor_total,valor_orcamento)) FROM orcamentos WHERE obra_id=o.id AND status='aprovado'),0)
   +COALESCE((SELECT SUM(valor_total) FROM obra_adendos WHERE obra_id=o.id AND status IN('assinado','em_execucao','concluido')),0) receita_contratada,
   COALESCE((SELECT SUM(valor_medido) FROM medicoes WHERE obra_id=o.id AND status='aprovada'),0) receita_medida,
   COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND tipo='receita' AND status='realizado' AND impacto_caixa),0) receita_recebida,
   COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND tipo='despesa' AND status='realizado' AND origem='parcela_pagamento' AND impacto_caixa),0) custo_subcontratado,
   COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND tipo='despesa' AND status='realizado' AND origem='material' AND impacto_caixa),0) custo_materiais,
   COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND tipo='despesa' AND status='realizado' AND impacto_caixa AND COALESCE(origem,'manual') NOT IN('material','parcela_pagamento')),0) outras_despesas,
   o.created_at FROM obras o WHERE o.empresa_id=_empresa_id AND(_obra_id IS NULL OR o.id=_obra_id)
 )
 SELECT b.id,b.codigo_chamado,b.receita_contratada,b.receita_medida,b.receita_recebida,b.custo_subcontratado,b.custo_materiais,
  b.custo_subcontratado+b.custo_materiais+b.outras_despesas,
  b.receita_recebida-(b.custo_subcontratado+b.custo_materiais+b.outras_despesas),
  CASE WHEN b.receita_contratada=0 THEN 0 ELSE round(((b.receita_recebida-(b.custo_subcontratado+b.custo_materiais+b.outras_despesas))/NULLIF(b.receita_contratada,0))*100,2) END
 FROM base b ORDER BY b.created_at DESC;
END;$$;

REVOKE EXECUTE ON FUNCTION public.fn_nf_normalize_values() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_normalize_recebimento_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_nf_to_recebimento_retencao() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_recebimento_to_lancamento() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_obra_financeiro_resumo(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_dre_obra(uuid,uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_financeiro_kpis(date,date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_fluxo_caixa_mensal(uuid,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_obra_financeiro_resumo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dre_obra(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financeiro_kpis(date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fluxo_caixa_mensal(uuid,integer,integer) TO authenticated;