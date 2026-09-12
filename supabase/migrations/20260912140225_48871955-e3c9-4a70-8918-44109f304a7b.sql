-- 1) Limites de plano -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.limites_plano(_empresa_id uuid)
RETURNS TABLE (limite_obras int, limite_usuarios int, plano_nome text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.limite_obras, p.limite_usuarios, p.nome
  FROM public.assinaturas a
  JOIN public.planos p ON p.id = a.plano_id
  WHERE a.empresa_id = _empresa_id
    AND a.status IN ('trialing','active','past_due')
  ORDER BY CASE a.status WHEN 'active' THEN 0 WHEN 'trialing' THEN 1 ELSE 2 END,
           a.created_at DESC
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.limites_plano(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.limites_plano(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_limite_obras()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lim int; v_plano text; v_uso int;
BEGIN
  IF NEW.empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa não identificada.';
  END IF;
  SELECT l.limite_obras, l.plano_nome INTO v_lim, v_plano
    FROM public.limites_plano(NEW.empresa_id) l;
  IF v_lim IS NULL OR v_lim <= 0 THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_uso FROM public.obras o
   WHERE o.empresa_id = NEW.empresa_id AND COALESCE(o.arquivada,false) = false;
  IF v_uso >= v_lim THEN
    RAISE EXCEPTION 'LIMITE_PLANO_OBRAS: O plano % permite % obra(s) ativa(s) e a empresa já tem %.',
      COALESCE(v_plano,'atual'), v_lim, v_uso
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_limite_obras ON public.obras;
CREATE TRIGGER trg_limite_obras BEFORE INSERT ON public.obras
FOR EACH ROW EXECUTE FUNCTION public.fn_limite_obras();

CREATE OR REPLACE FUNCTION public.fn_limite_usuarios()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lim int; v_plano text; v_uso int;
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.user_id IS NOT DISTINCT FROM NEW.user_id THEN RETURN NEW; END IF;
  IF NEW.empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa não identificada.';
  END IF;
  SELECT l.limite_usuarios, l.plano_nome INTO v_lim, v_plano
    FROM public.limites_plano(NEW.empresa_id) l;
  IF v_lim IS NULL OR v_lim <= 0 THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_uso FROM public.pessoas p
   WHERE p.empresa_id = NEW.empresa_id AND p.user_id IS NOT NULL
     AND p.id <> NEW.id AND p.status = 'ativo';
  IF v_uso >= v_lim THEN
    RAISE EXCEPTION 'LIMITE_PLANO_USUARIOS: O plano % permite % usuário(s) com acesso e a empresa já tem %.',
      COALESCE(v_plano,'atual'), v_lim, v_uso
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_limite_usuarios ON public.pessoas;
CREATE TRIGGER trg_limite_usuarios BEFORE INSERT OR UPDATE OF user_id ON public.pessoas
FOR EACH ROW EXECUTE FUNCTION public.fn_limite_usuarios();

-- Consumo por empresa (painel admin; só super admin)
CREATE OR REPLACE FUNCTION public.admin_consumo_empresas()
RETURNS TABLE (
  empresa_id uuid, empresa_nome text, plano text,
  obras_ativas bigint, limite_obras int,
  usuarios_ativos bigint, limite_usuarios int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN QUERY
  SELECT e.id, e.nome, l.plano_nome,
         (SELECT count(*) FROM public.obras o WHERE o.empresa_id = e.id AND COALESCE(o.arquivada,false) = false),
         l.limite_obras,
         (SELECT count(*) FROM public.pessoas p WHERE p.empresa_id = e.id AND p.user_id IS NOT NULL AND p.status = 'ativo'),
         l.limite_usuarios
  FROM public.empresas e
  LEFT JOIN LATERAL public.limites_plano(e.id) l ON true
  ORDER BY e.nome;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_consumo_empresas() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_consumo_empresas() TO authenticated;

-- Consumo da própria empresa (tela)
CREATE OR REPLACE FUNCTION public.consumo_empresa()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid; v jsonb;
BEGIN
  v_emp := public.get_user_empresa_id();
  IF v_emp IS NULL THEN RETURN '{}'::jsonb; END IF;
  SELECT jsonb_build_object(
    'plano', l.plano_nome,
    'limite_obras', l.limite_obras,
    'limite_usuarios', l.limite_usuarios,
    'obras_ativas', (SELECT count(*) FROM public.obras o WHERE o.empresa_id = v_emp AND COALESCE(o.arquivada,false) = false),
    'usuarios_ativos', (SELECT count(*) FROM public.pessoas p WHERE p.empresa_id = v_emp AND p.user_id IS NOT NULL AND p.status = 'ativo')
  ) INTO v FROM public.limites_plano(v_emp) l;
  RETURN COALESCE(v, '{}'::jsonb);
END; $$;
REVOKE EXECUTE ON FUNCTION public.consumo_empresa() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.consumo_empresa() TO authenticated;

-- 2) Auditoria das demais ações críticas ------------------------------------
DROP TRIGGER IF EXISTS trg_audit_medicoes ON public.medicoes;
CREATE TRIGGER trg_audit_medicoes AFTER INSERT OR UPDATE OR DELETE ON public.medicoes
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row();

DROP TRIGGER IF EXISTS trg_audit_perfil_permissao_itens ON public.perfil_permissao_itens;
CREATE TRIGGER trg_audit_perfil_permissao_itens AFTER INSERT OR UPDATE OR DELETE ON public.perfil_permissao_itens
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row();

DROP TRIGGER IF EXISTS trg_audit_perfis_permissao ON public.perfis_permissao;
CREATE TRIGGER trg_audit_perfis_permissao AFTER INSERT OR UPDATE OR DELETE ON public.perfis_permissao
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row();

DROP TRIGGER IF EXISTS trg_audit_cartoes_credito ON public.cartoes_credito;
CREATE TRIGGER trg_audit_cartoes_credito AFTER INSERT OR UPDATE OR DELETE ON public.cartoes_credito
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row();

-- 3) Gatilhos duplicados ----------------------------------------------------
DROP TRIGGER IF EXISTS trg_recalc_orc_desc ON public.orcamentos;
DROP TRIGGER IF EXISTS trg_orcamentos_updated_at ON public.orcamentos;

-- 4) LGPD: aceite de termos -------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS aceite_termos_em timestamptz,
  ADD COLUMN IF NOT EXISTS aceite_termos_versao text,
  ADD COLUMN IF NOT EXISTS aceite_privacidade_em timestamptz,
  ADD COLUMN IF NOT EXISTS aceite_privacidade_versao text;

-- 5) LGPD: pedido de exclusão da conta --------------------------------------
CREATE TABLE IF NOT EXISTS public.exclusao_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) DEFAULT public.get_user_empresa_id(),
  solicitado_por uuid NOT NULL DEFAULT auth.uid(),
  solicitado_por_email text,
  motivo text,
  confirmacao text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  prazo_em timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  cancelada_em timestamptz,
  concluida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exclusao_solicitacoes TO authenticated;
GRANT ALL ON public.exclusao_solicitacoes TO service_role;
ALTER TABLE public.exclusao_solicitacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exclusao_select" ON public.exclusao_solicitacoes;
CREATE POLICY "exclusao_select" ON public.exclusao_solicitacoes FOR SELECT TO authenticated
USING (public.tenant_match(empresa_id) AND public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "exclusao_insert" ON public.exclusao_solicitacoes;
CREATE POLICY "exclusao_insert" ON public.exclusao_solicitacoes FOR INSERT TO authenticated
WITH CHECK (
  public.tenant_match(empresa_id)
  AND public.is_admin_or_super(auth.uid())
  AND solicitado_por = auth.uid()
  AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = empresa_id)
);

DROP POLICY IF EXISTS "exclusao_update" ON public.exclusao_solicitacoes;
CREATE POLICY "exclusao_update" ON public.exclusao_solicitacoes FOR UPDATE TO authenticated
USING (public.tenant_match(empresa_id) AND public.is_admin_or_super(auth.uid()))
WITH CHECK (public.tenant_match(empresa_id) AND public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "exclusao_delete" ON public.exclusao_solicitacoes;
CREATE POLICY "exclusao_delete" ON public.exclusao_solicitacoes FOR DELETE TO authenticated
USING (public.tenant_match(empresa_id) AND public.is_admin_or_super(auth.uid()));

CREATE UNIQUE INDEX IF NOT EXISTS ux_exclusao_pendente
  ON public.exclusao_solicitacoes (empresa_id) WHERE status = 'pendente';

DROP TRIGGER IF EXISTS trg_exclusao_updated ON public.exclusao_solicitacoes;
CREATE TRIGGER trg_exclusao_updated BEFORE UPDATE ON public.exclusao_solicitacoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_audit_exclusao ON public.exclusao_solicitacoes;
CREATE TRIGGER trg_audit_exclusao AFTER INSERT OR UPDATE OR DELETE ON public.exclusao_solicitacoes
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row();