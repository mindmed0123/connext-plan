
-- 1) Planos: tirar leitura pública
DROP POLICY IF EXISTS "Planos são públicos para leitura" ON public.planos;
CREATE POLICY "Planos visíveis a autenticados"
  ON public.planos FOR SELECT
  TO authenticated
  USING (ativo = true OR public.is_super_admin(auth.uid()));

-- 2) Profiles: restringir por empresa / self
DROP POLICY IF EXISTS "Profiles visíveis para autenticados" ON public.profiles;
CREATE POLICY "Profiles visíveis na empresa ou self"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = profiles.user_id
        AND ur.empresa_id = public.get_user_empresa_id()
    )
    OR EXISTS (
      SELECT 1 FROM public.pessoas p
      WHERE p.user_id = profiles.user_id
        AND p.empresa_id = public.get_user_empresa_id()
    )
  );

-- 3) user_roles: bloquear self-escalation
DROP POLICY IF EXISTS user_roles_ins ON public.user_roles;
CREATE POLICY user_roles_ins
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (empresa_id = public.get_user_empresa_id() AND public.is_admin_or_super(auth.uid()))
  );

-- 4) has_permission com filtro de empresa
CREATE OR REPLACE FUNCTION public.has_permission(_uid uuid, _modulo app_modulo, _acao app_acao)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    public.is_super_admin(_uid)
    OR EXISTS (
      SELECT 1
      FROM public.pessoa_permissoes pp
      JOIN public.pessoas p ON p.id = pp.pessoa_id
      WHERE p.user_id = _uid
        AND p.empresa_id = pp.empresa_id
        AND pp.empresa_id = (
          SELECT empresa_id FROM public.user_roles
          WHERE user_id = _uid AND empresa_id IS NOT NULL LIMIT 1
        )
        AND pp.modulo = _modulo
        AND CASE _acao
          WHEN 'view'   THEN pp.can_view
          WHEN 'create' THEN pp.can_create
          WHEN 'edit'   THEN pp.can_edit
          WHEN 'delete' THEN pp.can_delete
        END
    );
$function$;

-- 5) Buckets privados
UPDATE storage.buckets SET public = false WHERE id IN ('obras-fotos','orcamentos-anexos');

-- 5a) obras-fotos: refazer policies escopadas por empresa/obra
DROP POLICY IF EXISTS "Fotos públicas para leitura" ON storage.objects;
DROP POLICY IF EXISTS "Autenticados podem upload de fotos" ON storage.objects;
DROP POLICY IF EXISTS "Autenticados podem atualizar fotos" ON storage.objects;
DROP POLICY IF EXISTS "Admin pode deletar fotos" ON storage.objects;

CREATE POLICY "obras_fotos_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'obras-fotos'
    AND public.can_access_obra(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "obras_fotos_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'obras-fotos'
    AND public.can_access_obra(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "obras_fotos_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'obras-fotos'
    AND public.can_access_obra(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "obras_fotos_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'obras-fotos'
    AND (
      public.is_admin_or_super(auth.uid())
      OR public.can_access_obra(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  );

-- 5b) orcamentos-anexos: idem
DROP POLICY IF EXISTS orcamentos_anexos_public_read ON storage.objects;
DROP POLICY IF EXISTS orcamentos_anexos_auth_insert ON storage.objects;
DROP POLICY IF EXISTS orcamentos_anexos_auth_update ON storage.objects;
DROP POLICY IF EXISTS orcamentos_anexos_auth_delete ON storage.objects;

CREATE POLICY "orcamentos_anexos_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'orcamentos-anexos'
    AND public.can_access_obra(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "orcamentos_anexos_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'orcamentos-anexos'
    AND public.can_access_obra(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "orcamentos_anexos_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'orcamentos-anexos'
    AND public.can_access_obra(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "orcamentos_anexos_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'orcamentos-anexos'
    AND (
      public.is_admin_or_super(auth.uid())
      OR public.can_access_obra(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  );
