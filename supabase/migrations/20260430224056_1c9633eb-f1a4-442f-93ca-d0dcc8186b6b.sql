DROP POLICY IF EXISTS orcamentos_del ON public.orcamentos;
CREATE POLICY orcamentos_del ON public.orcamentos
FOR DELETE TO authenticated
USING (
  public.is_admin_or_super(auth.uid())
  OR public.has_permission(auth.uid(), 'orcamentos'::app_modulo, 'delete'::app_acao)
);