-- cartoes_credito
DROP POLICY IF EXISTS cart_sel ON public.cartoes_credito;
DROP POLICY IF EXISTS cart_ins ON public.cartoes_credito;
DROP POLICY IF EXISTS cart_upd ON public.cartoes_credito;
DROP POLICY IF EXISTS cart_del ON public.cartoes_credito;

CREATE POLICY cart_sel ON public.cartoes_credito FOR SELECT TO authenticated
USING (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'cartoes','view') OR has_permission(auth.uid(),'financeiro','view')));
CREATE POLICY cart_ins ON public.cartoes_credito FOR INSERT TO authenticated
WITH CHECK (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'cartoes','create')));
CREATE POLICY cart_upd ON public.cartoes_credito FOR UPDATE TO authenticated
USING (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'cartoes','edit')));
CREATE POLICY cart_del ON public.cartoes_credito FOR DELETE TO authenticated
USING (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'cartoes','delete')));

-- cartao_despesas
DROP POLICY IF EXISTS cdesp_sel ON public.cartao_despesas;
DROP POLICY IF EXISTS cdesp_ins ON public.cartao_despesas;
DROP POLICY IF EXISTS cdesp_upd ON public.cartao_despesas;
DROP POLICY IF EXISTS cdesp_del ON public.cartao_despesas;

CREATE POLICY cdesp_sel ON public.cartao_despesas FOR SELECT TO authenticated
USING (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'cartoes','view') OR has_permission(auth.uid(),'financeiro','view')));
CREATE POLICY cdesp_ins ON public.cartao_despesas FOR INSERT TO authenticated
WITH CHECK (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'cartoes','create')));
CREATE POLICY cdesp_upd ON public.cartao_despesas FOR UPDATE TO authenticated
USING (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'cartoes','edit')));
CREATE POLICY cdesp_del ON public.cartao_despesas FOR DELETE TO authenticated
USING (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'cartoes','delete')));

-- compradores
DROP POLICY IF EXISTS comp_sel ON public.compradores;
DROP POLICY IF EXISTS comp_ins ON public.compradores;
DROP POLICY IF EXISTS comp_upd ON public.compradores;
DROP POLICY IF EXISTS comp_del ON public.compradores;

CREATE POLICY comp_sel ON public.compradores FOR SELECT TO authenticated
USING (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'compradores','view') OR has_permission(auth.uid(),'financeiro','view')));
CREATE POLICY comp_ins ON public.compradores FOR INSERT TO authenticated
WITH CHECK (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'compradores','create')));
CREATE POLICY comp_upd ON public.compradores FOR UPDATE TO authenticated
USING (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'compradores','edit')));
CREATE POLICY comp_del ON public.compradores FOR DELETE TO authenticated
USING (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'compradores','delete')));