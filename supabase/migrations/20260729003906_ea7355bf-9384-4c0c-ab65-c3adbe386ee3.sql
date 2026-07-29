-- Convenção de caminho: <empresa_id>/<registro_id>/<arquivo>
CREATE POLICY "pessoas_docs_all" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'pessoas-documentos'
    AND (public.is_super_admin(auth.uid())
         OR (storage.foldername(name))[1] = public.get_user_empresa_id()::text)
  )
  WITH CHECK (
    bucket_id = 'pessoas-documentos'
    AND (public.is_super_admin(auth.uid())
         OR (storage.foldername(name))[1] = public.get_user_empresa_id()::text)
  );

CREATE POLICY "compradores_contratos_all" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'compradores-contratos'
    AND (public.is_super_admin(auth.uid())
         OR (storage.foldername(name))[1] = public.get_user_empresa_id()::text)
  )
  WITH CHECK (
    bucket_id = 'compradores-contratos'
    AND (public.is_super_admin(auth.uid())
         OR (storage.foldername(name))[1] = public.get_user_empresa_id()::text)
  );

CREATE POLICY "obras_contratos_all" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'obras-contratos'
    AND (public.is_super_admin(auth.uid())
         OR (storage.foldername(name))[1] = public.get_user_empresa_id()::text)
  )
  WITH CHECK (
    bucket_id = 'obras-contratos'
    AND (public.is_super_admin(auth.uid())
         OR (storage.foldername(name))[1] = public.get_user_empresa_id()::text)
  );