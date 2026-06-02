DROP POLICY IF EXISTS pessoas_del ON public.pessoas;
CREATE POLICY pessoas_del ON public.pessoas
FOR DELETE TO authenticated
USING (
  tenant_match(empresa_id) AND (
    is_admin_or_super(auth.uid())
    OR has_permission(auth.uid(), 'equipes'::app_modulo, 'delete'::app_acao)
  )
);