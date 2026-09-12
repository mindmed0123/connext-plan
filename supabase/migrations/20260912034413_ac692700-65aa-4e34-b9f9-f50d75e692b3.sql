REVOKE EXECUTE ON FUNCTION public.fn_medicao_before_write() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_medicao_recalc() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_medicao_timeline() FROM anon, public, authenticated;

DROP POLICY IF EXISTS contratos_clientes_files_sel ON storage.objects;
DROP POLICY IF EXISTS contratos_clientes_files_ins ON storage.objects;
DROP POLICY IF EXISTS contratos_clientes_files_upd ON storage.objects;
DROP POLICY IF EXISTS contratos_clientes_files_del ON storage.objects;
DROP POLICY IF EXISTS medicoes_files_sel ON storage.objects;
DROP POLICY IF EXISTS medicoes_files_ins ON storage.objects;
DROP POLICY IF EXISTS medicoes_files_upd ON storage.objects;
DROP POLICY IF EXISTS medicoes_files_del ON storage.objects;

CREATE POLICY contratos_clientes_files_sel ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'contratos-clientes' AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text);
CREATE POLICY contratos_clientes_files_ins ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'contratos-clientes' AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
  AND public.tenant_can_write(public.get_user_empresa_id()));
CREATE POLICY contratos_clientes_files_upd ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'contratos-clientes' AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text)
WITH CHECK (bucket_id = 'contratos-clientes' AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text);
CREATE POLICY contratos_clientes_files_del ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'contratos-clientes' AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text);

CREATE POLICY medicoes_files_sel ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'medicoes-anexos' AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text);
CREATE POLICY medicoes_files_ins ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'medicoes-anexos' AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
  AND public.tenant_can_write(public.get_user_empresa_id()));
CREATE POLICY medicoes_files_upd ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'medicoes-anexos' AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text)
WITH CHECK (bucket_id = 'medicoes-anexos' AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text);
CREATE POLICY medicoes_files_del ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'medicoes-anexos' AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text);