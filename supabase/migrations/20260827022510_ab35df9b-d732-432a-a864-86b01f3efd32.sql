DROP POLICY IF EXISTS materiais_del ON public.materiais_obra;
CREATE POLICY materiais_del ON public.materiais_obra FOR DELETE TO authenticated
USING (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(), 'obras'::app_modulo, 'delete'::app_acao)));

DROP POLICY IF EXISTS nf_del ON public.notas_fiscais;
CREATE POLICY nf_del ON public.notas_fiscais FOR DELETE TO authenticated
USING (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(), 'faturamento'::app_modulo, 'delete'::app_acao)));

DROP POLICY IF EXISTS rec_del ON public.recebimentos;
CREATE POLICY rec_del ON public.recebimentos FOR DELETE TO authenticated
USING (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(), 'financeiro'::app_modulo, 'delete'::app_acao)));

DROP POLICY IF EXISTS lanc_del ON public.lancamentos_financeiros;
CREATE POLICY lanc_del ON public.lancamentos_financeiros FOR DELETE TO authenticated
USING (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(), 'financeiro'::app_modulo, 'delete'::app_acao)));