
CREATE POLICY cpc_sel ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'contas-pagar-comprovantes'
  AND public.tenant_match(((storage.foldername(name))[1])::uuid)
);
CREATE POLICY cpc_ins ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'contas-pagar-comprovantes'
  AND public.tenant_can_write(((storage.foldername(name))[1])::uuid)
  AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','create'))
);
CREATE POLICY cpc_upd ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'contas-pagar-comprovantes'
  AND public.tenant_can_write(((storage.foldername(name))[1])::uuid)
  AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','edit'))
)
WITH CHECK (
  bucket_id = 'contas-pagar-comprovantes'
  AND public.tenant_can_write(((storage.foldername(name))[1])::uuid)
);
CREATE POLICY cpc_del ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'contas-pagar-comprovantes'
  AND public.tenant_can_write(((storage.foldername(name))[1])::uuid)
  AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','delete'))
);
