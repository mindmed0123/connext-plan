-- materiais-anexos: escopo por obra (folder 1 = obra_id)
DROP POLICY IF EXISTS "Materiais anexos select" ON storage.objects;
DROP POLICY IF EXISTS "Materiais anexos insert" ON storage.objects;
DROP POLICY IF EXISTS "Materiais anexos update" ON storage.objects;
DROP POLICY IF EXISTS "Materiais anexos delete" ON storage.objects;

CREATE POLICY "Materiais anexos select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'materiais-anexos' AND public.can_access_obra(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "Materiais anexos insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'materiais-anexos' AND public.can_access_obra(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "Materiais anexos update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'materiais-anexos' AND public.can_access_obra(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "Materiais anexos delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'materiais-anexos' AND public.can_access_obra(auth.uid(), ((storage.foldername(name))[1])::uuid));

-- comprovantes-pagamento: escopo pela contratação (folder 1 = contratacao_id)
CREATE OR REPLACE FUNCTION public.can_access_contratacao(_uid uuid, _contratacao_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_super_admin(_uid) OR EXISTS (
    SELECT 1 FROM public.contratacoes_terceirizado ct
    WHERE ct.id = _contratacao_id
      AND ct.empresa_id = public.get_user_empresa_id()
      AND (public.is_admin_or_super(_uid) OR public.has_permission(_uid, 'financeiro', 'view'))
  );
$$;

DROP POLICY IF EXISTS "comprovantes_sel_admin" ON storage.objects;
DROP POLICY IF EXISTS "comprovantes_ins_admin" ON storage.objects;
DROP POLICY IF EXISTS "comprovantes_upd_admin" ON storage.objects;
DROP POLICY IF EXISTS "comprovantes_del_admin" ON storage.objects;

CREATE POLICY "comprovantes_sel_admin" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'comprovantes-pagamento' AND public.can_access_contratacao(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "comprovantes_ins_admin" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'comprovantes-pagamento' AND public.can_access_contratacao(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "comprovantes_upd_admin" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'comprovantes-pagamento' AND public.can_access_contratacao(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "comprovantes_del_admin" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'comprovantes-pagamento' AND public.can_access_contratacao(auth.uid(), ((storage.foldername(name))[1])::uuid));

-- empresas: impedir criação arbitrária (signup usa signup_create_company, security definer)
DROP POLICY IF EXISTS "empresas_ins" ON public.empresas;
CREATE POLICY "empresas_ins" ON public.empresas FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));