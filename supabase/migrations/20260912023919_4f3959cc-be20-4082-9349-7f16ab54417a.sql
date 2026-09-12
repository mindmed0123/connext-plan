-- =========================================================
-- 1) SESSOES DE SUPORTE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.suporte_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  motivo text NOT NULL,
  expira_em timestamptz NOT NULL,
  criada_por uuid NOT NULL,
  criada_por_email text,
  encerrada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.suporte_sessoes TO authenticated;
GRANT ALL ON public.suporte_sessoes TO service_role;

ALTER TABLE public.suporte_sessoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suporte_sessoes_select ON public.suporte_sessoes;
CREATE POLICY suporte_sessoes_select ON public.suporte_sessoes
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (empresa_id = public.get_user_empresa_id() AND public.is_admin_or_super(auth.uid()))
  );

DROP POLICY IF EXISTS suporte_sessoes_insert ON public.suporte_sessoes;
CREATE POLICY suporte_sessoes_insert ON public.suporte_sessoes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    AND criada_por = auth.uid()
    AND expira_em > now()
    AND expira_em <= now() + interval '7 days'
    AND length(btrim(motivo)) >= 10
    AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = empresa_id)
  );

DROP POLICY IF EXISTS suporte_sessoes_update ON public.suporte_sessoes;
CREATE POLICY suporte_sessoes_update ON public.suporte_sessoes
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) AND criada_por = auth.uid())
  WITH CHECK (public.is_super_admin(auth.uid()) AND criada_por = auth.uid());

DROP POLICY IF EXISTS suporte_sessoes_delete ON public.suporte_sessoes;
CREATE POLICY suporte_sessoes_delete ON public.suporte_sessoes
  FOR DELETE TO authenticated
  USING (false);

DROP TRIGGER IF EXISTS trg_suporte_sessoes_updated ON public.suporte_sessoes;
CREATE TRIGGER trg_suporte_sessoes_updated
  BEFORE UPDATE ON public.suporte_sessoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_suporte_sessoes_empresa ON public.suporte_sessoes(empresa_id, expira_em DESC);

CREATE OR REPLACE FUNCTION public.suporte_sessao_ativa(_empresa_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _empresa_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.suporte_sessoes s
    WHERE s.empresa_id = _empresa_id
      AND s.criada_por = auth.uid()
      AND s.encerrada_em IS NULL
      AND s.expira_em > now()
  );
$$;
REVOKE EXECUTE ON FUNCTION public.suporte_sessao_ativa(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.suporte_sessao_ativa(uuid) TO authenticated;

-- Suporte so grava com sessao aberta
CREATE OR REPLACE FUNCTION public.tenant_can_write(_empresa_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_super_admin(auth.uid())
      THEN public.suporte_sessao_ativa(_empresa_id)
    ELSE public.tenant_match(_empresa_id) AND public.empresa_assinatura_ativa(_empresa_id)
  END;
$$;
REVOKE EXECUTE ON FUNCTION public.tenant_can_write(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.tenant_can_write(uuid) TO authenticated;

-- =========================================================
-- 2) AUDIT LOG (append-only)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  ator_user_id uuid,
  ator_email text,
  papel text,
  suporte boolean NOT NULL DEFAULT false,
  acao text NOT NULL,
  tabela text NOT NULL,
  registro_id uuid,
  dados_antes jsonb,
  dados_depois jsonb,
  justificativa text,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_select ON public.audit_log;
CREATE POLICY audit_log_select ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (empresa_id IS NOT NULL AND empresa_id = public.get_user_empresa_id() AND public.is_admin_or_super(auth.uid()))
  );

-- append-only: nenhuma policy de INSERT/UPDATE/DELETE para authenticated
DROP POLICY IF EXISTS audit_log_no_update ON public.audit_log;
CREATE POLICY audit_log_no_update ON public.audit_log FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS audit_log_no_delete ON public.audit_log;
CREATE POLICY audit_log_no_delete ON public.audit_log FOR DELETE TO authenticated USING (false);
DROP POLICY IF EXISTS audit_log_no_insert ON public.audit_log;
CREATE POLICY audit_log_no_insert ON public.audit_log FOR INSERT TO authenticated WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_audit_log_empresa ON public.audit_log(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_suporte ON public.audit_log(empresa_id, suporte, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_registro ON public.audit_log(tabela, registro_id);

CREATE OR REPLACE FUNCTION public.fn_audit_row()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_before jsonb;
  v_after jsonb;
  v_emp uuid;
  v_id uuid;
  v_email text;
  v_papel text;
  v_super boolean;
  v_motivo text;
BEGIN
  IF TG_OP <> 'INSERT' THEN v_before := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN v_after := to_jsonb(NEW); END IF;

  v_id := NULLIF(COALESCE(v_after->>'id', v_before->>'id'), '')::uuid;

  IF TG_TABLE_NAME = 'empresas' THEN
    v_emp := v_id;
  ELSE
    v_emp := NULLIF(COALESCE(v_after->>'empresa_id', v_before->>'empresa_id'), '')::uuid;
  END IF;

  v_super := public.is_super_admin(auth.uid());

  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = auth.uid();

  SELECT ur.role::text INTO v_papel
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid()
  ORDER BY CASE ur.role WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1 WHEN 'gestor' THEN 2 ELSE 3 END
  LIMIT 1;

  IF v_super AND v_emp IS NOT NULL THEN
    SELECT s.motivo INTO v_motivo
    FROM public.suporte_sessoes s
    WHERE s.empresa_id = v_emp AND s.criada_por = auth.uid()
      AND s.encerrada_em IS NULL AND s.expira_em > now()
    ORDER BY s.created_at DESC LIMIT 1;
  END IF;

  INSERT INTO public.audit_log (
    empresa_id, ator_user_id, ator_email, papel, suporte, acao, tabela,
    registro_id, dados_antes, dados_depois, justificativa
  ) VALUES (
    v_emp, auth.uid(), v_email, v_papel, COALESCE(v_super, false), TG_OP, TG_TABLE_NAME,
    v_id, v_before, v_after, v_motivo
  );

  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fn_audit_row() FROM anon, public;

DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'obras','orcamentos','lancamentos_financeiros','recebimentos','recebimento_pagamentos',
    'notas_fiscais','contratacoes_terceirizado','parcelas_pagamento','cartao_despesas',
    'pessoas','pessoa_permissoes','user_roles','empresas','assinaturas'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row()',
      t
    );
  END LOOP;
END
$do$;

-- =========================================================
-- 3) handle_new_user: sem vinculo automatico e sem super admin por e-mail
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email))
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- =========================================================
-- 4) user_roles: unico por empresa
-- =========================================================
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_role_empresa_key
  ON public.user_roles (user_id, role, COALESCE(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid));