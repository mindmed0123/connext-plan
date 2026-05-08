
-- =========================================
-- FASE 1: MULTI-TENANT
-- =========================================

-- 1. Tabela empresas
CREATE TABLE public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  plano text NOT NULL DEFAULT 'basico',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_empresas_updated
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Adicionar empresa_id em todas as tabelas tenant
ALTER TABLE public.obras                    ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.pessoas                  ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.execucoes                ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.contratacoes_terceirizado ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.materiais_obra           ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.fotos_obra               ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.vistorias                ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.diario_obra              ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.pedidos_compra           ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.recebimentos             ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.pessoa_permissoes        ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles               ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.orcamentos               ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.notas_fiscais            ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.rcs                      ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.parcelas_pagamento       ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.obra_responsaveis        ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.obra_timeline            ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;

-- 3. Converter obras.origem de enum para text (origens dinâmicas por empresa)
ALTER TABLE public.obras ALTER COLUMN origem DROP DEFAULT;
ALTER TABLE public.obras ALTER COLUMN origem TYPE text USING origem::text;
ALTER TABLE public.obras ALTER COLUMN origem SET DEFAULT 'Sabesp';

-- 4. Função helper para pegar empresa do usuário
CREATE OR REPLACE FUNCTION public.get_user_empresa_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.user_roles
  WHERE user_id = auth.uid() AND empresa_id IS NOT NULL
  LIMIT 1;
$$;

-- Verifica se usuário pertence à mesma empresa do registro (super_admin global passa)
CREATE OR REPLACE FUNCTION public.tenant_match(_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(auth.uid())
      OR _empresa_id = public.get_user_empresa_id();
$$;

-- 5. Inserir empresa Potência Soluções e migrar dados
INSERT INTO public.empresas (nome, slug, plano) VALUES ('Potência Soluções', 'potencia', 'basico');

UPDATE public.obras                    SET empresa_id = (SELECT id FROM public.empresas WHERE slug = 'potencia') WHERE empresa_id IS NULL;
UPDATE public.pessoas                  SET empresa_id = (SELECT id FROM public.empresas WHERE slug = 'potencia') WHERE empresa_id IS NULL;
UPDATE public.execucoes                SET empresa_id = (SELECT id FROM public.empresas WHERE slug = 'potencia') WHERE empresa_id IS NULL;
UPDATE public.contratacoes_terceirizado SET empresa_id = (SELECT id FROM public.empresas WHERE slug = 'potencia') WHERE empresa_id IS NULL;
UPDATE public.materiais_obra           SET empresa_id = (SELECT id FROM public.empresas WHERE slug = 'potencia') WHERE empresa_id IS NULL;
UPDATE public.fotos_obra               SET empresa_id = (SELECT id FROM public.empresas WHERE slug = 'potencia') WHERE empresa_id IS NULL;
UPDATE public.vistorias                SET empresa_id = (SELECT id FROM public.empresas WHERE slug = 'potencia') WHERE empresa_id IS NULL;
UPDATE public.diario_obra              SET empresa_id = (SELECT id FROM public.empresas WHERE slug = 'potencia') WHERE empresa_id IS NULL;
UPDATE public.pedidos_compra           SET empresa_id = (SELECT id FROM public.empresas WHERE slug = 'potencia') WHERE empresa_id IS NULL;
UPDATE public.recebimentos             SET empresa_id = (SELECT id FROM public.empresas WHERE slug = 'potencia') WHERE empresa_id IS NULL;
UPDATE public.pessoa_permissoes        SET empresa_id = (SELECT id FROM public.empresas WHERE slug = 'potencia') WHERE empresa_id IS NULL;
UPDATE public.orcamentos               SET empresa_id = (SELECT id FROM public.empresas WHERE slug = 'potencia') WHERE empresa_id IS NULL;
UPDATE public.notas_fiscais            SET empresa_id = (SELECT id FROM public.empresas WHERE slug = 'potencia') WHERE empresa_id IS NULL;
UPDATE public.rcs                      SET empresa_id = (SELECT id FROM public.empresas WHERE slug = 'potencia') WHERE empresa_id IS NULL;
UPDATE public.parcelas_pagamento       SET empresa_id = (SELECT id FROM public.empresas WHERE slug = 'potencia') WHERE empresa_id IS NULL;
UPDATE public.obra_responsaveis        SET empresa_id = (SELECT id FROM public.empresas WHERE slug = 'potencia') WHERE empresa_id IS NULL;
UPDATE public.obra_timeline            SET empresa_id = (SELECT id FROM public.empresas WHERE slug = 'potencia') WHERE empresa_id IS NULL;

-- user_roles: associar todos os roles existentes EXCETO super_admins (super_admin é global, fica NULL)
UPDATE public.user_roles
  SET empresa_id = (SELECT id FROM public.empresas WHERE slug = 'potencia')
  WHERE empresa_id IS NULL AND role <> 'super_admin';

-- 6. Tornar empresa_id NOT NULL (exceto user_roles, onde super_admin pode ser NULL)
ALTER TABLE public.obras                    ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.pessoas                  ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.execucoes                ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.contratacoes_terceirizado ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.materiais_obra           ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.fotos_obra               ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.vistorias                ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.diario_obra              ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.pedidos_compra           ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.recebimentos             ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.pessoa_permissoes        ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.orcamentos               ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.notas_fiscais            ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.rcs                      ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.parcelas_pagamento       ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.obra_responsaveis        ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.obra_timeline            ALTER COLUMN empresa_id SET NOT NULL;

-- 7. Trigger para preencher empresa_id automaticamente
CREATE OR REPLACE FUNCTION public.set_empresa_id_from_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.empresa_id IS NULL THEN
    NEW.empresa_id := public.get_user_empresa_id();
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'obras','pessoas','execucoes','contratacoes_terceirizado','materiais_obra',
    'fotos_obra','vistorias','diario_obra','pedidos_compra','recebimentos',
    'pessoa_permissoes','orcamentos','notas_fiscais','rcs','parcelas_pagamento',
    'obra_responsaveis','obra_timeline'
  ])
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_set_empresa_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_from_user()',
      t
    );
  END LOOP;
END $$;

-- 8. Tabela origens_obra (dinâmica por empresa)
CREATE TABLE public.origens_obra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);

ALTER TABLE public.origens_obra ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_set_empresa_id_origens
  BEFORE INSERT ON public.origens_obra
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_from_user();

INSERT INTO public.origens_obra (empresa_id, nome)
SELECT id, x FROM public.empresas, unnest(ARRAY['Sabesp','Veman']) AS x
WHERE slug = 'potencia';

-- 9. Atualizar can_access_obra para considerar empresa
CREATE OR REPLACE FUNCTION public.can_access_obra(_uid uuid, _obra_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.obras o
    WHERE o.id = _obra_id
      AND (
        public.is_super_admin(_uid)
        OR (
          o.empresa_id = (SELECT empresa_id FROM public.user_roles WHERE user_id = _uid AND empresa_id IS NOT NULL LIMIT 1)
          AND (
            public.is_admin_or_super(_uid)
            OR public.has_permission(_uid, 'obras', 'view')
            OR EXISTS (
              SELECT 1 FROM public.obra_responsaveis r
              JOIN public.pessoas p ON p.id = r.pessoa_id
              WHERE r.obra_id = _obra_id AND p.user_id = _uid AND p.status = 'ativo'
            )
          )
        )
      )
  );
$$;

-- 10. Atualizar handle_new_user: NÃO atribui mais role automaticamente
-- O role é atribuído pelo fluxo de cadastro de empresa ou convite.
-- Mantém a criação do profile e o vínculo com pessoa pré-existente.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email));

  -- Mantém super_admin do dono original
  IF lower(NEW.email) = 'pedro@potenciasolucoes.com.br' THEN
    INSERT INTO public.user_roles (user_id, role, empresa_id) VALUES (NEW.id, 'super_admin', NULL) ON CONFLICT DO NOTHING;
  END IF;

  -- Vincular a pessoa pré-existente (caso de convite)
  UPDATE public.pessoas SET user_id = NEW.id, updated_at = now()
  WHERE lower(email) = lower(NEW.email) AND user_id IS NULL;

  RETURN NEW;
END;
$$;

-- 11. Reescrever policies com isolamento de tenant
-- Helper: dropar todas as policies das tabelas tenant
DO $$
DECLARE
  pol record;
  tables text[] := ARRAY[
    'obras','pessoas','execucoes','contratacoes_terceirizado','materiais_obra',
    'fotos_obra','vistorias','diario_obra','pedidos_compra','recebimentos',
    'pessoa_permissoes','orcamentos','notas_fiscais','rcs','parcelas_pagamento',
    'obra_responsaveis','obra_timeline','user_roles'
  ];
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename = ANY(tables)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ===== empresas =====
CREATE POLICY empresas_sel ON public.empresas FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR id = public.get_user_empresa_id());
CREATE POLICY empresas_ins ON public.empresas FOR INSERT TO authenticated
  WITH CHECK (true); -- qualquer usuário pode criar uma empresa (signup)
CREATE POLICY empresas_upd ON public.empresas FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR (id = public.get_user_empresa_id() AND public.is_admin_or_super(auth.uid())));
CREATE POLICY empresas_del ON public.empresas FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- ===== origens_obra =====
CREATE POLICY origens_sel ON public.origens_obra FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY origens_ins ON public.origens_obra FOR INSERT TO authenticated
  WITH CHECK (public.tenant_match(empresa_id));
CREATE POLICY origens_upd ON public.origens_obra FOR UPDATE TO authenticated
  USING (public.tenant_match(empresa_id) AND public.is_admin_or_super(auth.uid()));
CREATE POLICY origens_del ON public.origens_obra FOR DELETE TO authenticated
  USING (public.tenant_match(empresa_id) AND public.is_admin_or_super(auth.uid()));

-- ===== user_roles =====
CREATE POLICY user_roles_sel ON public.user_roles FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR user_id = auth.uid()
    OR empresa_id = public.get_user_empresa_id()
  );
CREATE POLICY user_roles_ins ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR user_id = auth.uid()  -- self durante signup
    OR (empresa_id = public.get_user_empresa_id() AND public.is_admin_or_super(auth.uid()))
  );
CREATE POLICY user_roles_upd ON public.user_roles FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (empresa_id = public.get_user_empresa_id() AND public.is_admin_or_super(auth.uid()))
  );
CREATE POLICY user_roles_del ON public.user_roles FOR DELETE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (empresa_id = public.get_user_empresa_id() AND public.is_admin_or_super(auth.uid()))
  );

-- ===== obras =====
CREATE POLICY obras_sel ON public.obras FOR SELECT TO authenticated USING (public.can_access_obra(auth.uid(), id));
CREATE POLICY obras_ins ON public.obras FOR INSERT TO authenticated
  WITH CHECK (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'obras', 'create')));
CREATE POLICY obras_upd ON public.obras FOR UPDATE TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'obras', 'edit')));
CREATE POLICY obras_del ON public.obras FOR DELETE TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'obras', 'delete')));

-- ===== pessoas =====
CREATE POLICY pessoas_sel ON public.pessoas FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id) AND (
    public.is_admin_or_super(auth.uid()) OR user_id = auth.uid()
    OR public.has_permission(auth.uid(), 'equipes', 'view')
    OR public.has_permission(auth.uid(), 'obras', 'view')
    OR public.has_permission(auth.uid(), 'financeiro', 'view')
  ));
CREATE POLICY pessoas_ins ON public.pessoas FOR INSERT TO authenticated
  WITH CHECK (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'equipes', 'create')));
CREATE POLICY pessoas_upd ON public.pessoas FOR UPDATE TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'equipes', 'edit')));
CREATE POLICY pessoas_del ON public.pessoas FOR DELETE TO authenticated
  USING (public.tenant_match(empresa_id) AND public.is_super_admin(auth.uid()));

-- ===== execucoes =====
CREATE POLICY execucoes_sel ON public.execucoes FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'execucoes', 'view')));
CREATE POLICY execucoes_ins ON public.execucoes FOR INSERT TO authenticated
  WITH CHECK (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'execucoes', 'create')));
CREATE POLICY execucoes_upd ON public.execucoes FOR UPDATE TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'execucoes', 'edit')));
CREATE POLICY execucoes_del ON public.execucoes FOR DELETE TO authenticated
  USING (public.tenant_match(empresa_id) AND public.is_super_admin(auth.uid()));

-- ===== contratacoes_terceirizado =====
CREATE POLICY contratacoes_sel ON public.contratacoes_terceirizado FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'view')));
CREATE POLICY contratacoes_ins ON public.contratacoes_terceirizado FOR INSERT TO authenticated
  WITH CHECK (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'create')));
CREATE POLICY contratacoes_upd ON public.contratacoes_terceirizado FOR UPDATE TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'edit')));
CREATE POLICY contratacoes_del ON public.contratacoes_terceirizado FOR DELETE TO authenticated
  USING (public.tenant_match(empresa_id) AND public.is_super_admin(auth.uid()));

-- ===== materiais_obra =====
CREATE POLICY materiais_sel ON public.materiais_obra FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id) AND (
    public.is_admin_or_super(auth.uid())
    OR public.has_permission(auth.uid(), 'financeiro', 'view')
    OR public.has_permission(auth.uid(), 'obras', 'view')
  ));
CREATE POLICY materiais_ins ON public.materiais_obra FOR INSERT TO authenticated
  WITH CHECK (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'create')));
CREATE POLICY materiais_upd ON public.materiais_obra FOR UPDATE TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'edit')));
CREATE POLICY materiais_del ON public.materiais_obra FOR DELETE TO authenticated
  USING (public.tenant_match(empresa_id) AND public.is_super_admin(auth.uid()));

-- ===== fotos_obra =====
CREATE POLICY fotos_sel ON public.fotos_obra FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id) AND public.can_access_obra(auth.uid(), obra_id));
CREATE POLICY fotos_ins ON public.fotos_obra FOR INSERT TO authenticated
  WITH CHECK (public.tenant_match(empresa_id) AND public.can_access_obra(auth.uid(), obra_id));
CREATE POLICY fotos_upd ON public.fotos_obra FOR UPDATE TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'obras', 'edit')));
CREATE POLICY fotos_del ON public.fotos_obra FOR DELETE TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_super_admin(auth.uid()) OR uploaded_by = auth.uid() OR public.is_admin_or_super(auth.uid())));

-- ===== vistorias =====
CREATE POLICY vistorias_sel ON public.vistorias FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'vistorias', 'view')));
CREATE POLICY vistorias_ins ON public.vistorias FOR INSERT TO authenticated
  WITH CHECK (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'vistorias', 'create')));
CREATE POLICY vistorias_upd ON public.vistorias FOR UPDATE TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'vistorias', 'edit')));
CREATE POLICY vistorias_del ON public.vistorias FOR DELETE TO authenticated
  USING (public.tenant_match(empresa_id) AND public.is_super_admin(auth.uid()));

-- ===== diario_obra =====
CREATE POLICY diario_sel ON public.diario_obra FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'etapas', 'view')));
CREATE POLICY diario_ins ON public.diario_obra FOR INSERT TO authenticated
  WITH CHECK (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'etapas', 'create')));
CREATE POLICY diario_upd ON public.diario_obra FOR UPDATE TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'etapas', 'edit')));
CREATE POLICY diario_del ON public.diario_obra FOR DELETE TO authenticated
  USING (public.tenant_match(empresa_id) AND public.is_super_admin(auth.uid()));

-- ===== pedidos_compra =====
CREATE POLICY pc_sel ON public.pedidos_compra FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'view')));
CREATE POLICY pc_ins ON public.pedidos_compra FOR INSERT TO authenticated
  WITH CHECK (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'create')));
CREATE POLICY pc_upd ON public.pedidos_compra FOR UPDATE TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'edit')));
CREATE POLICY pc_del ON public.pedidos_compra FOR DELETE TO authenticated
  USING (public.tenant_match(empresa_id) AND public.is_super_admin(auth.uid()));

-- ===== recebimentos =====
CREATE POLICY rec_sel ON public.recebimentos FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'view')));
CREATE POLICY rec_ins ON public.recebimentos FOR INSERT TO authenticated
  WITH CHECK (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'create')));
CREATE POLICY rec_upd ON public.recebimentos FOR UPDATE TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'edit')));
CREATE POLICY rec_del ON public.recebimentos FOR DELETE TO authenticated
  USING (public.tenant_match(empresa_id) AND public.is_super_admin(auth.uid()));

-- ===== pessoa_permissoes =====
CREATE POLICY perm_sel ON public.pessoa_permissoes FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (empresa_id = public.get_user_empresa_id() AND (
      public.is_admin_or_super(auth.uid())
      OR EXISTS (SELECT 1 FROM public.pessoas p WHERE p.id = pessoa_id AND p.user_id = auth.uid())
    ))
  );
CREATE POLICY perm_ins ON public.pessoa_permissoes FOR INSERT TO authenticated
  WITH CHECK (public.tenant_match(empresa_id) AND public.is_admin_or_super(auth.uid()));
CREATE POLICY perm_upd ON public.pessoa_permissoes FOR UPDATE TO authenticated
  USING (public.tenant_match(empresa_id) AND public.is_admin_or_super(auth.uid()));
CREATE POLICY perm_del ON public.pessoa_permissoes FOR DELETE TO authenticated
  USING (public.tenant_match(empresa_id) AND public.is_super_admin(auth.uid()));

-- ===== orcamentos =====
CREATE POLICY orc_sel ON public.orcamentos FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'orcamentos', 'view')));
CREATE POLICY orc_ins ON public.orcamentos FOR INSERT TO authenticated
  WITH CHECK (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'orcamentos', 'create')));
CREATE POLICY orc_upd ON public.orcamentos FOR UPDATE TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'orcamentos', 'edit')));
CREATE POLICY orc_del ON public.orcamentos FOR DELETE TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'orcamentos', 'delete')));

-- ===== notas_fiscais =====
CREATE POLICY nf_sel ON public.notas_fiscais FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'faturamento', 'view')));
CREATE POLICY nf_ins ON public.notas_fiscais FOR INSERT TO authenticated
  WITH CHECK (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'faturamento', 'create')));
CREATE POLICY nf_upd ON public.notas_fiscais FOR UPDATE TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'faturamento', 'edit')));
CREATE POLICY nf_del ON public.notas_fiscais FOR DELETE TO authenticated
  USING (public.tenant_match(empresa_id) AND public.is_super_admin(auth.uid()));

-- ===== rcs =====
CREATE POLICY rcs_sel ON public.rcs FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'view')));
CREATE POLICY rcs_ins ON public.rcs FOR INSERT TO authenticated
  WITH CHECK (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'create')));
CREATE POLICY rcs_upd ON public.rcs FOR UPDATE TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'edit')));
CREATE POLICY rcs_del ON public.rcs FOR DELETE TO authenticated
  USING (public.tenant_match(empresa_id) AND public.is_super_admin(auth.uid()));

-- ===== parcelas_pagamento =====
CREATE POLICY parc_sel ON public.parcelas_pagamento FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'view')));
CREATE POLICY parc_ins ON public.parcelas_pagamento FOR INSERT TO authenticated
  WITH CHECK (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'create')));
CREATE POLICY parc_upd ON public.parcelas_pagamento FOR UPDATE TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'edit')));
CREATE POLICY parc_del ON public.parcelas_pagamento FOR DELETE TO authenticated
  USING (public.tenant_match(empresa_id) AND public.is_super_admin(auth.uid()));

-- ===== obra_responsaveis =====
CREATE POLICY oresp_sel ON public.obra_responsaveis FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id) AND public.can_access_obra(auth.uid(), obra_id));
CREATE POLICY oresp_ins ON public.obra_responsaveis FOR INSERT TO authenticated
  WITH CHECK (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'obras', 'edit')));
CREATE POLICY oresp_upd ON public.obra_responsaveis FOR UPDATE TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'obras', 'edit')));
CREATE POLICY oresp_del ON public.obra_responsaveis FOR DELETE TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'obras', 'delete')));

-- ===== obra_timeline =====
CREATE POLICY otl_sel ON public.obra_timeline FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id) AND public.can_access_obra(auth.uid(), obra_id));
CREATE POLICY otl_ins ON public.obra_timeline FOR INSERT TO authenticated
  WITH CHECK (public.tenant_match(empresa_id) AND public.can_access_obra(auth.uid(), obra_id));
CREATE POLICY otl_upd ON public.obra_timeline FOR UPDATE TO authenticated
  USING (public.tenant_match(empresa_id) AND public.is_admin_or_super(auth.uid()));
CREATE POLICY otl_del ON public.obra_timeline FOR DELETE TO authenticated
  USING (public.tenant_match(empresa_id) AND public.is_super_admin(auth.uid()));
