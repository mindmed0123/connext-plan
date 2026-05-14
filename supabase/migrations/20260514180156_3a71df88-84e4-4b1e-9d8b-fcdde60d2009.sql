-- Corrige a função de criação de usuário para conceder super admin apenas ao e-mail correto
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email))
  ON CONFLICT (user_id) DO NOTHING;

  IF lower(NEW.email) = 'pedrolsuassuna@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role, empresa_id)
    VALUES (NEW.id, 'super_admin', NULL)
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.pessoas
     SET user_id = NEW.id, updated_at = now()
   WHERE lower(email) = lower(NEW.email) AND user_id IS NULL;

  RETURN NEW;
END;
$$;

-- Super admin não deve ter empresa operacional ativa por padrão
CREATE OR REPLACE FUNCTION public.get_user_empresa_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ur.empresa_id
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid()
    AND ur.empresa_id IS NOT NULL
    AND NOT public.is_super_admin(auth.uid())
  ORDER BY ur.created_at ASC
  LIMIT 1;
$$;

-- Isolamento de tenant: super admin não passa mais automaticamente em dados operacionais
CREATE OR REPLACE FUNCTION public.tenant_match(_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _empresa_id = public.get_user_empresa_id();
$$;

-- Super admin continua podendo acessar somente obras quando for explicitamente responsável por elas;
-- caso contrário, dados operacionais ficam restritos à empresa do usuário.
CREATE OR REPLACE FUNCTION public.can_access_obra(_uid uuid, _obra_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.obras o
    WHERE o.id = _obra_id
      AND (
        (
          o.empresa_id = (
            SELECT ur.empresa_id
            FROM public.user_roles ur
            WHERE ur.user_id = _uid
              AND ur.empresa_id IS NOT NULL
              AND NOT public.is_super_admin(_uid)
            ORDER BY ur.created_at ASC
            LIMIT 1
          )
          AND (
            public.is_admin_or_super(_uid)
            OR public.has_permission(_uid, 'obras', 'view')
            OR EXISTS (
              SELECT 1
              FROM public.obra_responsaveis r
              JOIN public.pessoas p ON p.id = r.pessoa_id
              WHERE r.obra_id = _obra_id
                AND p.user_id = _uid
                AND p.status = 'ativo'
            )
          )
        )
        OR EXISTS (
          SELECT 1
          FROM public.obra_responsaveis r
          JOIN public.pessoas p ON p.id = r.pessoa_id
          WHERE r.obra_id = _obra_id
            AND p.user_id = _uid
            AND p.status = 'ativo'
        )
      )
  );
$$;

-- Perfis: super admin não lista todos os perfis pessoais/operacionais por padrão
DROP POLICY IF EXISTS "Profiles visíveis na empresa ou self" ON public.profiles;
CREATE POLICY "Profiles visíveis na empresa ou self"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = profiles.user_id
      AND ur.empresa_id = public.get_user_empresa_id()
  )
  OR EXISTS (
    SELECT 1
    FROM public.pessoas p
    WHERE p.user_id = profiles.user_id
      AND p.empresa_id = public.get_user_empresa_id()
  )
);

-- Permissões: sem listagem global para super admin em dados operacionais de equipes
DROP POLICY IF EXISTS perm_sel ON public.pessoa_permissoes;
CREATE POLICY perm_sel
ON public.pessoa_permissoes
FOR SELECT
TO authenticated
USING (
  empresa_id = public.get_user_empresa_id()
  AND (
    public.is_admin_or_super(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.pessoas p
      WHERE p.id = pessoa_permissoes.pessoa_id
        AND p.user_id = auth.uid()
    )
  )
);

-- Painel de sistema: empresas continuam visíveis ao super admin, mas sem acesso operacional automático
DROP POLICY IF EXISTS empresas_sel ON public.empresas;
CREATE POLICY empresas_sel
ON public.empresas
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()) OR id = public.get_user_empresa_id());

DROP POLICY IF EXISTS empresas_upd ON public.empresas;
CREATE POLICY empresas_upd
ON public.empresas
FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()) OR (id = public.get_user_empresa_id() AND public.is_admin_or_super(auth.uid())))
WITH CHECK (public.is_super_admin(auth.uid()) OR (id = public.get_user_empresa_id() AND public.is_admin_or_super(auth.uid())));

-- Assinaturas/billing: super admin mantém apenas gestão administrativa do painel do sistema
DROP POLICY IF EXISTS "Empresa vê sua assinatura" ON public.assinaturas;
CREATE POLICY "Empresa vê sua assinatura"
ON public.assinaturas
FOR SELECT
TO authenticated
USING (public.tenant_match(empresa_id));

DROP POLICY IF EXISTS "Super admin gerencia assinaturas" ON public.assinaturas;
CREATE POLICY "Super admin gerencia assinaturas"
ON public.assinaturas
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Empresa vê seus billing events" ON public.billing_events;
CREATE POLICY "Empresa vê seus billing events"
ON public.billing_events
FOR SELECT
TO authenticated
USING (public.tenant_match(empresa_id));

DROP POLICY IF EXISTS "Super admin vê billing events" ON public.billing_events;
CREATE POLICY "Super admin vê billing events"
ON public.billing_events
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));