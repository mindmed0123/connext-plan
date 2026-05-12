
-- Função chamada após signup do usuário para criar a empresa dele
CREATE OR REPLACE FUNCTION public.signup_create_company(_nome_empresa text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_empresa_id uuid;
  v_slug text;
  v_existing uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Se o usuário já tem empresa, retorna a existente (idempotente)
  SELECT empresa_id INTO v_existing FROM public.user_roles
   WHERE user_id = v_uid AND empresa_id IS NOT NULL LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- gera slug único
  v_slug := lower(regexp_replace(coalesce(_nome_empresa,'empresa'), '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || substr(replace(gen_random_uuid()::text,'-',''), 1, 6);

  INSERT INTO public.empresas (nome, slug)
  VALUES (coalesce(nullif(trim(_nome_empresa),''),'Minha Empresa'), v_slug)
  RETURNING id INTO v_empresa_id;

  INSERT INTO public.user_roles (user_id, role, empresa_id)
  VALUES (v_uid, 'admin', v_empresa_id)
  ON CONFLICT DO NOTHING;

  -- O trigger trg_criar_trial cria a assinatura trial automaticamente

  RETURN v_empresa_id;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_assinaturas_trial_ends_at
  ON public.assinaturas (trial_ends_at) WHERE status = 'trialing';
