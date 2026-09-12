
DROP POLICY IF EXISTS obra_documentos_storage_select ON storage.objects;
CREATE POLICY obra_documentos_storage_select ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'obra-documentos' AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text);

DROP POLICY IF EXISTS obra_documentos_storage_insert ON storage.objects;
CREATE POLICY obra_documentos_storage_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'obra-documentos'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
  AND public.tenant_can_write(public.get_user_empresa_id())
);

DROP POLICY IF EXISTS obra_documentos_storage_update ON storage.objects;
CREATE POLICY obra_documentos_storage_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'obra-documentos' AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text)
WITH CHECK (bucket_id = 'obra-documentos' AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text);

DROP POLICY IF EXISTS obra_documentos_storage_delete ON storage.objects;
CREATE POLICY obra_documentos_storage_delete ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'obra-documentos'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
  AND public.tenant_can_write(public.get_user_empresa_id())
);
