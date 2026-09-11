-- 1) user_roles: somente super_admin escreve
DROP POLICY IF EXISTS user_roles_ins ON public.user_roles;
DROP POLICY IF EXISTS user_roles_upd ON public.user_roles;
DROP POLICY IF EXISTS user_roles_del ON public.user_roles;

CREATE POLICY user_roles_ins ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY user_roles_upd ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY user_roles_del ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 5) empresas: bloquear alteração de ativo/plano por não super_admin
CREATE OR REPLACE FUNCTION public.protect_empresa_billing_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.ativo IS DISTINCT FROM OLD.ativo OR NEW.plano IS DISTINCT FROM OLD.plano THEN
    RAISE EXCEPTION 'Somente o suporte pode alterar este campo';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_protect_empresa_billing_fields ON public.empresas;
CREATE TRIGGER trg_protect_empresa_billing_fields
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.protect_empresa_billing_fields();

-- 6) pessoas: user_id imutável pelo cliente
CREATE OR REPLACE FUNCTION public.protect_pessoa_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Somente o suporte pode alterar este campo';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_protect_pessoa_user_id ON public.pessoas;
CREATE TRIGGER trg_protect_pessoa_user_id
  BEFORE UPDATE ON public.pessoas
  FOR EACH ROW EXECUTE FUNCTION public.protect_pessoa_user_id();

-- 7) funções expostas
CREATE OR REPLACE FUNCTION public.seed_categorias_financeiras(_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (_empresa_id = public.get_user_empresa_id() OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  INSERT INTO public.categorias_financeiras (empresa_id, nome, grupo, tipo, cor) VALUES
    (_empresa_id, 'Serviço contratado', 'receita_servico', 'receita', '#22c55e'),
    (_empresa_id, 'Fornecimento de material', 'receita_material', 'receita', '#16a34a'),
    (_empresa_id, 'Outras receitas', 'receita_outro', 'receita', '#4ade80'),
    (_empresa_id, 'Mão de obra direta', 'custo_mao_obra_direta', 'despesa', '#f97316'),
    (_empresa_id, 'Mão de obra indireta', 'custo_mao_obra_indireta', 'despesa', '#fb923c'),
    (_empresa_id, 'Materiais e insumos', 'custo_material', 'despesa', '#ef4444'),
    (_empresa_id, 'Equipamentos e locação', 'custo_equipamento', 'despesa', '#dc2626'),
    (_empresa_id, 'Subempreiteiros', 'custo_subcontratado', 'despesa', '#b91c1c'),
    (_empresa_id, 'Despesas administrativas', 'custo_administrativo', 'despesa', '#6b7280'),
    (_empresa_id, 'Impostos e taxas', 'custo_imposto', 'despesa', '#4b5563'),
    (_empresa_id, 'Outros custos', 'custo_outro', 'despesa', '#374151')
  ON CONFLICT (empresa_id, nome) DO NOTHING;
END; $$;

REVOKE EXECUTE ON FUNCTION public.seed_categorias_financeiras(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_categorias_financeiras(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_admin_or_super(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_super(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.can_access_obra(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_obra(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, app_modulo, app_acao) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, app_modulo, app_acao) TO authenticated, service_role;