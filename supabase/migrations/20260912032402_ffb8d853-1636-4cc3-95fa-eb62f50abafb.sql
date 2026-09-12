
-- ============ 1. GRUPOS DE CATEGORIA ============
CREATE TABLE public.categoria_grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_user_empresa_id(),
  chave text NOT NULL,
  nome text NOT NULL,
  tipo public.lancamento_tipo NOT NULL,
  papel text CHECK (papel IN ('receita_servico','material','subcontratado')),
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX categoria_grupos_empresa_chave_uidx ON public.categoria_grupos(empresa_id, chave);
CREATE UNIQUE INDEX categoria_grupos_empresa_papel_uidx ON public.categoria_grupos(empresa_id, papel) WHERE papel IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categoria_grupos TO authenticated;
GRANT ALL ON public.categoria_grupos TO service_role;
ALTER TABLE public.categoria_grupos ENABLE ROW LEVEL SECURITY;
CREATE POLICY cg_sel ON public.categoria_grupos FOR SELECT TO authenticated USING (public.tenant_match(empresa_id));
CREATE POLICY cg_ins ON public.categoria_grupos FOR INSERT TO authenticated WITH CHECK (public.tenant_can_write(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','create')));
CREATE POLICY cg_upd ON public.categoria_grupos FOR UPDATE TO authenticated USING (public.tenant_can_write(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','edit'))) WITH CHECK (public.tenant_can_write(empresa_id));
CREATE POLICY cg_del ON public.categoria_grupos FOR DELETE TO authenticated USING (public.tenant_can_write(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','delete')));
CREATE TRIGGER cg_updated BEFORE UPDATE ON public.categoria_grupos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- semear grupos a partir dos existentes
INSERT INTO public.categoria_grupos (empresa_id, chave, nome, tipo, papel, ordem)
SELECT e.id, g.chave, g.nome, g.tipo::public.lancamento_tipo, g.papel, g.ordem
FROM public.empresas e
CROSS JOIN (VALUES
  ('receita_servico','Receita de serviço','receita','receita_servico',1),
  ('receita_material','Receita de material','receita',NULL,2),
  ('receita_outro','Outras receitas','receita',NULL,3),
  ('custo_mao_obra_direta','Mão de obra direta','despesa',NULL,4),
  ('custo_mao_obra_indireta','Mão de obra indireta','despesa',NULL,5),
  ('custo_material','Materiais e insumos','despesa','material',6),
  ('custo_equipamento','Equipamentos','despesa',NULL,7),
  ('custo_subcontratado','Subcontratados','despesa','subcontratado',8),
  ('custo_administrativo','Administrativo','despesa',NULL,9),
  ('custo_imposto','Impostos e taxas','despesa',NULL,10),
  ('custo_outro','Outros custos','despesa',NULL,11)
) AS g(chave,nome,tipo,papel,ordem)
ON CONFLICT DO NOTHING;

ALTER TABLE public.categorias_financeiras
  ADD COLUMN grupo_id uuid REFERENCES public.categoria_grupos(id),
  ADD COLUMN ordem integer NOT NULL DEFAULT 0,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.categorias_financeiras cf
SET grupo_id = cg.id
FROM public.categoria_grupos cg
WHERE cg.empresa_id = cf.empresa_id AND cg.chave = cf.grupo::text AND cf.grupo_id IS NULL;

-- manter coluna enum "grupo" preenchida a partir do grupo_id
CREATE OR REPLACE FUNCTION public.fn_categoria_sync_grupo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid; v_chave text;
BEGIN
  IF NEW.grupo_id IS NOT NULL THEN
    SELECT empresa_id, chave INTO v_emp, v_chave FROM public.categoria_grupos WHERE id = NEW.grupo_id;
    IF v_emp IS NULL OR v_emp IS DISTINCT FROM NEW.empresa_id THEN
      RAISE EXCEPTION 'Grupo de outra empresa';
    END IF;
    BEGIN
      NEW.grupo := v_chave::public.categoria_grupo;
    EXCEPTION WHEN others THEN
      NEW.grupo := (CASE WHEN NEW.tipo = 'receita' THEN 'receita_outro' ELSE 'custo_outro' END)::public.categoria_grupo;
    END;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_categoria_sync_grupo BEFORE INSERT OR UPDATE ON public.categorias_financeiras
FOR EACH ROW EXECUTE FUNCTION public.fn_categoria_sync_grupo();

-- bloquear exclusão de categoria em uso
CREATE OR REPLACE FUNCTION public.fn_block_delete_categoria_em_uso()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.lancamentos_financeiros l WHERE l.categoria_id = OLD.id AND l.empresa_id = OLD.empresa_id) THEN
    RAISE EXCEPTION 'Categoria já usada em lançamentos. Desative-a em vez de excluir.';
  END IF;
  RETURN OLD;
END; $$;
CREATE TRIGGER trg_block_delete_categoria BEFORE DELETE ON public.categorias_financeiras
FOR EACH ROW EXECUTE FUNCTION public.fn_block_delete_categoria_em_uso();

-- resolver categoria padrão por papel
CREATE OR REPLACE FUNCTION public.categoria_por_papel(_empresa uuid, _papel text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_tipo public.lancamento_tipo;
BEGIN
  v_tipo := CASE WHEN _papel = 'receita_servico' THEN 'receita' ELSE 'despesa' END::public.lancamento_tipo;
  SELECT cf.id INTO v_id FROM public.categorias_financeiras cf
    JOIN public.categoria_grupos cg ON cg.id = cf.grupo_id
   WHERE cf.empresa_id = _empresa AND cg.papel = _papel AND cf.ativo
   ORDER BY cf.ordem, cf.nome LIMIT 1;
  IF v_id IS NULL THEN
    SELECT cf.id INTO v_id FROM public.categorias_financeiras cf
     WHERE cf.empresa_id = _empresa AND cf.tipo = v_tipo AND cf.ativo
     ORDER BY cf.ordem, cf.nome LIMIT 1;
  END IF;
  RETURN v_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.categoria_por_papel(uuid,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.categoria_por_papel(uuid,text) TO authenticated, service_role;

-- ============ 2. CENTROS DE CUSTO ============
CREATE TABLE public.centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_user_empresa_id(),
  nome text NOT NULL,
  codigo text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX centros_custo_empresa_nome_uidx ON public.centros_custo(empresa_id, nome);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.centros_custo TO authenticated;
GRANT ALL ON public.centros_custo TO service_role;
ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;
CREATE POLICY cc_sel ON public.centros_custo FOR SELECT TO authenticated USING (public.tenant_match(empresa_id));
CREATE POLICY cc_ins ON public.centros_custo FOR INSERT TO authenticated WITH CHECK (public.tenant_can_write(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','create')));
CREATE POLICY cc_upd ON public.centros_custo FOR UPDATE TO authenticated USING (public.tenant_can_write(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','edit'))) WITH CHECK (public.tenant_can_write(empresa_id));
CREATE POLICY cc_del ON public.centros_custo FOR DELETE TO authenticated USING (public.tenant_can_write(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','delete')));
CREATE TRIGGER cc_updated BEFORE UPDATE ON public.centros_custo FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.lancamentos_financeiros ADD COLUMN centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE RESTRICT;
ALTER TABLE public.materiais_obra ADD COLUMN centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE RESTRICT;
ALTER TABLE public.cartao_despesas ADD COLUMN centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE RESTRICT;
ALTER TABLE public.contratacoes_terceirizado ADD COLUMN centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.fn_valida_centro_custo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid;
BEGIN
  IF NEW.centro_custo_id IS NOT NULL THEN
    SELECT empresa_id INTO v_emp FROM public.centros_custo WHERE id = NEW.centro_custo_id;
    IF v_emp IS NULL OR v_emp IS DISTINCT FROM NEW.empresa_id THEN
      RAISE EXCEPTION 'Centro de custo de outra empresa';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_cc_lanc BEFORE INSERT OR UPDATE ON public.lancamentos_financeiros FOR EACH ROW EXECUTE FUNCTION public.fn_valida_centro_custo();
CREATE TRIGGER trg_cc_mat BEFORE INSERT OR UPDATE ON public.materiais_obra FOR EACH ROW EXECUTE FUNCTION public.fn_valida_centro_custo();
CREATE TRIGGER trg_cc_cartao BEFORE INSERT OR UPDATE ON public.cartao_despesas FOR EACH ROW EXECUTE FUNCTION public.fn_valida_centro_custo();
CREATE TRIGGER trg_cc_contr BEFORE INSERT OR UPDATE ON public.contratacoes_terceirizado FOR EACH ROW EXECUTE FUNCTION public.fn_valida_centro_custo();

-- ============ 3. LISTAS CONFIGURÁVEIS ============
CREATE TABLE public.listas_opcoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_user_empresa_id(),
  lista text NOT NULL,
  valor text NOT NULL,
  rotulo text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX listas_opcoes_uidx ON public.listas_opcoes(empresa_id, lista, valor);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listas_opcoes TO authenticated;
GRANT ALL ON public.listas_opcoes TO service_role;
ALTER TABLE public.listas_opcoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY lo_sel ON public.listas_opcoes FOR SELECT TO authenticated USING (public.tenant_match(empresa_id));
CREATE POLICY lo_ins ON public.listas_opcoes FOR INSERT TO authenticated WITH CHECK (public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid()));
CREATE POLICY lo_upd ON public.listas_opcoes FOR UPDATE TO authenticated USING (public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid())) WITH CHECK (public.tenant_can_write(empresa_id));
CREATE POLICY lo_del ON public.listas_opcoes FOR DELETE TO authenticated USING (public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid()));
CREATE TRIGGER lo_updated BEFORE UPDATE ON public.listas_opcoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.seed_listas_opcoes(_empresa_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (_empresa_id = public.get_user_empresa_id() OR public.is_super_admin(auth.uid()) OR auth.uid() IS NULL) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  INSERT INTO public.listas_opcoes (empresa_id, lista, valor, rotulo, ordem)
  SELECT _empresa_id, l.lista, l.valor, l.rotulo, l.ordem FROM (VALUES
    ('unidade','un','UN',1),('unidade','m','M',2),('unidade','m²','M²',3),('unidade','m³','M³',4),
    ('unidade','kg','KG',5),('unidade','t','T',6),('unidade','h','H',7),('unidade','dia','DIA',8),
    ('unidade','mês','MÊS',9),('unidade','vb','VB',10),('unidade','cj','CJ',11),('unidade','pc','PC',12),
    ('unidade','gl','GL',13),('unidade','km','KM',14),('unidade','l','L',15),('unidade','cx','CX',16),
    ('condicao_pagamento','a_vista','À vista',1),
    ('condicao_pagamento','parcelado','Parcelado',2),
    ('condicao_pagamento','entrada_parcelas','Entrada + parcelas',3),
    ('condicao_pagamento','faturado','Faturado',4),
    ('tipo_obra','construcao','Construção',1),('tipo_obra','reforma','Reforma',2),
    ('tipo_obra','manutencao','Manutenção',3),('tipo_obra','servico','Serviço',4),
    ('tipo_comprador','construtora','Construtora',1),('tipo_comprador','industria','Indústria',2),
    ('tipo_comprador','orgao_publico','Órgão público',3),('tipo_comprador','condominio','Condomínio',4),
    ('tipo_comprador','outro','Outro',5),
    ('forma_pagamento','pix','PIX',1),('forma_pagamento','dinheiro','Dinheiro',2),
    ('forma_pagamento','transferencia','Transferência',3),('forma_pagamento','boleto','Boleto',4),
    ('forma_pagamento','outro','Outro',5)
  ) AS l(lista,valor,rotulo,ordem)
  ON CONFLICT (empresa_id, lista, valor) DO NOTHING;
END; $$;
REVOKE EXECUTE ON FUNCTION public.seed_listas_opcoes(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.seed_listas_opcoes(uuid) TO authenticated, service_role;

INSERT INTO public.listas_opcoes (empresa_id, lista, valor, rotulo, ordem)
SELECT e.id, l.lista, l.valor, l.rotulo, l.ordem FROM public.empresas e CROSS JOIN (VALUES
    ('unidade','un','UN',1),('unidade','m','M',2),('unidade','m²','M²',3),('unidade','m³','M³',4),
    ('unidade','kg','KG',5),('unidade','t','T',6),('unidade','h','H',7),('unidade','dia','DIA',8),
    ('unidade','mês','MÊS',9),('unidade','vb','VB',10),('unidade','cj','CJ',11),('unidade','pc','PC',12),
    ('unidade','gl','GL',13),('unidade','km','KM',14),('unidade','l','L',15),('unidade','cx','CX',16),
    ('condicao_pagamento','a_vista','À vista',1),
    ('condicao_pagamento','parcelado','Parcelado',2),
    ('condicao_pagamento','entrada_parcelas','Entrada + parcelas',3),
    ('condicao_pagamento','faturado','Faturado',4),
    ('tipo_obra','construcao','Construção',1),('tipo_obra','reforma','Reforma',2),
    ('tipo_obra','manutencao','Manutenção',3),('tipo_obra','servico','Serviço',4),
    ('tipo_comprador','construtora','Construtora',1),('tipo_comprador','industria','Indústria',2),
    ('tipo_comprador','orgao_publico','Órgão público',3),('tipo_comprador','condominio','Condomínio',4),
    ('tipo_comprador','outro','Outro',5),
    ('forma_pagamento','pix','PIX',1),('forma_pagamento','dinheiro','Dinheiro',2),
    ('forma_pagamento','transferencia','Transferência',3),('forma_pagamento','boleto','Boleto',4),
    ('forma_pagamento','outro','Outro',5)
) AS l(lista,valor,rotulo,ordem)
ON CONFLICT DO NOTHING;

-- ============ 4. PERFIS DE PERMISSÃO ============
CREATE TABLE public.perfis_permissao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_user_empresa_id(),
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX perfis_permissao_empresa_nome_uidx ON public.perfis_permissao(empresa_id, nome);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfis_permissao TO authenticated;
GRANT ALL ON public.perfis_permissao TO service_role;
ALTER TABLE public.perfis_permissao ENABLE ROW LEVEL SECURITY;
CREATE POLICY pp_sel ON public.perfis_permissao FOR SELECT TO authenticated USING (public.tenant_match(empresa_id));
CREATE POLICY pp_ins ON public.perfis_permissao FOR INSERT TO authenticated WITH CHECK (public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid()));
CREATE POLICY pp_upd ON public.perfis_permissao FOR UPDATE TO authenticated USING (public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid())) WITH CHECK (public.tenant_can_write(empresa_id));
CREATE POLICY pp_del ON public.perfis_permissao FOR DELETE TO authenticated USING (public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid()));
CREATE TRIGGER pp_updated BEFORE UPDATE ON public.perfis_permissao FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.perfil_permissao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_user_empresa_id(),
  perfil_id uuid NOT NULL REFERENCES public.perfis_permissao(id) ON DELETE CASCADE,
  modulo public.app_modulo NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX perfil_itens_uidx ON public.perfil_permissao_itens(empresa_id, perfil_id, modulo);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfil_permissao_itens TO authenticated;
GRANT ALL ON public.perfil_permissao_itens TO service_role;
ALTER TABLE public.perfil_permissao_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY ppi_sel ON public.perfil_permissao_itens FOR SELECT TO authenticated USING (public.tenant_match(empresa_id));
CREATE POLICY ppi_ins ON public.perfil_permissao_itens FOR INSERT TO authenticated WITH CHECK (
  public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid())
  AND EXISTS (SELECT 1 FROM public.perfis_permissao p WHERE p.id = perfil_id AND p.empresa_id = empresa_id));
CREATE POLICY ppi_upd ON public.perfil_permissao_itens FOR UPDATE TO authenticated USING (
  public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid())
  AND EXISTS (SELECT 1 FROM public.perfis_permissao p WHERE p.id = perfil_id AND p.empresa_id = empresa_id))
WITH CHECK (public.tenant_can_write(empresa_id)
  AND EXISTS (SELECT 1 FROM public.perfis_permissao p WHERE p.id = perfil_id AND p.empresa_id = empresa_id));
CREATE POLICY ppi_del ON public.perfil_permissao_itens FOR DELETE TO authenticated USING (
  public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid()));
CREATE TRIGGER ppi_updated BEFORE UPDATE ON public.perfil_permissao_itens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.pessoas ADD COLUMN perfil_id uuid REFERENCES public.perfis_permissao(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.fn_valida_perfil_pessoa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid;
BEGIN
  IF NEW.perfil_id IS NOT NULL THEN
    SELECT empresa_id INTO v_emp FROM public.perfis_permissao WHERE id = NEW.perfil_id;
    IF v_emp IS NULL OR v_emp IS DISTINCT FROM NEW.empresa_id THEN
      RAISE EXCEPTION 'Perfil de outra empresa';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_valida_perfil_pessoa BEFORE INSERT OR UPDATE ON public.pessoas FOR EACH ROW EXECUTE FUNCTION public.fn_valida_perfil_pessoa();

-- semear perfis padrão
CREATE OR REPLACE FUNCTION public.seed_perfis_permissao(_empresa_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_perfil uuid; m public.app_modulo;
BEGIN
  IF NOT (_empresa_id = public.get_user_empresa_id() OR public.is_super_admin(auth.uid()) OR auth.uid() IS NULL) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  FOR r IN SELECT * FROM (VALUES
    ('Administrador','Acesso total a todos os módulos','all'),
    ('Gestor','Vê tudo e edita obras, orçamentos e faturamento','gestor'),
    ('Financeiro','Foco em financeiro, faturamento e cartões','financeiro'),
    ('Engenharia','Obras, etapas, execuções e vistorias','engenharia'),
    ('Operacional','Apenas consulta do dia a dia','operacional')
  ) AS t(nome,descricao,tipo) LOOP
    INSERT INTO public.perfis_permissao (empresa_id, nome, descricao)
    VALUES (_empresa_id, r.nome, r.descricao)
    ON CONFLICT (empresa_id, nome) DO UPDATE SET descricao = EXCLUDED.descricao
    RETURNING id INTO v_perfil;

    FOR m IN SELECT unnest(enum_range(NULL::public.app_modulo)) LOOP
      INSERT INTO public.perfil_permissao_itens (empresa_id, perfil_id, modulo, can_view, can_create, can_edit, can_delete)
      VALUES (
        _empresa_id, v_perfil, m,
        CASE r.tipo
          WHEN 'all' THEN true
          WHEN 'gestor' THEN true
          WHEN 'financeiro' THEN m IN ('dashboard','financeiro','faturamento','cartoes','obras','orcamentos','compradores')
          WHEN 'engenharia' THEN m IN ('dashboard','obras','etapas','execucoes','vistorias','equipes','servicos')
          ELSE m IN ('dashboard','obras','etapas','vistorias')
        END,
        CASE r.tipo
          WHEN 'all' THEN true
          WHEN 'gestor' THEN m <> 'equipes'
          WHEN 'financeiro' THEN m IN ('financeiro','faturamento','cartoes')
          WHEN 'engenharia' THEN m IN ('obras','etapas','execucoes','vistorias')
          ELSE false
        END,
        CASE r.tipo
          WHEN 'all' THEN true
          WHEN 'gestor' THEN m <> 'equipes'
          WHEN 'financeiro' THEN m IN ('financeiro','faturamento','cartoes')
          WHEN 'engenharia' THEN m IN ('obras','etapas','execucoes','vistorias')
          ELSE false
        END,
        CASE r.tipo WHEN 'all' THEN true ELSE false END
      )
      ON CONFLICT (empresa_id, perfil_id, modulo) DO NOTHING;
    END LOOP;
  END LOOP;
END; $$;
REVOKE EXECUTE ON FUNCTION public.seed_perfis_permissao(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.seed_perfis_permissao(uuid) TO authenticated, service_role;

-- aplicar perfil às pessoas ligadas
CREATE OR REPLACE FUNCTION public.aplicar_perfil_permissao(_perfil_id uuid, _pessoa_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid; v_count integer := 0;
BEGIN
  SELECT empresa_id INTO v_emp FROM public.perfis_permissao WHERE id = _perfil_id;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
  IF NOT (v_emp = public.get_user_empresa_id() AND public.is_admin_or_super(auth.uid())) AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF NOT public.tenant_can_write(v_emp) THEN RAISE EXCEPTION 'Assinatura inativa'; END IF;

  INSERT INTO public.pessoa_permissoes (empresa_id, pessoa_id, modulo, can_view, can_create, can_edit, can_delete)
  SELECT v_emp, p.id, i.modulo, i.can_view, i.can_create, i.can_edit, i.can_delete
    FROM public.pessoas p
    JOIN public.perfil_permissao_itens i ON i.perfil_id = _perfil_id AND i.empresa_id = v_emp
   WHERE p.empresa_id = v_emp AND p.perfil_id = _perfil_id
     AND (_pessoa_id IS NULL OR p.id = _pessoa_id)
  ON CONFLICT (pessoa_id, modulo) DO UPDATE SET
    can_view = EXCLUDED.can_view, can_create = EXCLUDED.can_create,
    can_edit = EXCLUDED.can_edit, can_delete = EXCLUDED.can_delete, updated_at = now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;
REVOKE EXECUTE ON FUNCTION public.aplicar_perfil_permissao(uuid,uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.aplicar_perfil_permissao(uuid,uuid) TO authenticated, service_role;

-- semear perfis/grupos para empresas existentes
DO $$
DECLARE e record;
BEGIN
  FOR e IN SELECT id FROM public.empresas LOOP
    PERFORM public.seed_perfis_permissao(e.id);
  END LOOP;
END $$;

-- ============ 5. TRIGGERS FINANCEIROS USAM PAPEL ============
CREATE OR REPLACE FUNCTION public.fn_material_to_lancamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cat uuid; v_obra_emp uuid;
BEGIN
  PERFORM set_config('app.sync', 'on', true);
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lancamentos_financeiros WHERE origem = 'material' AND origem_id = OLD.id;
    RETURN OLD;
  END IF;
  IF NEW.obra_id IS NOT NULL THEN
    SELECT empresa_id INTO v_obra_emp FROM public.obras WHERE id = NEW.obra_id;
    IF v_obra_emp IS NULL OR v_obra_emp IS DISTINCT FROM NEW.empresa_id THEN
      RAISE EXCEPTION 'Obra de outra empresa';
    END IF;
  END IF;
  v_cat := public.categoria_por_papel(NEW.empresa_id, 'material');
  INSERT INTO public.lancamentos_financeiros (
    empresa_id, obra_id, categoria_id, centro_custo_id, tipo, status, descricao, valor,
    data_competencia, data_vencimento, data_realizado, forma_pagamento, fornecedor_nome, origem, origem_id
  ) VALUES (
    NEW.empresa_id, NEW.obra_id, v_cat, NEW.centro_custo_id, 'despesa'::public.lancamento_tipo, 'realizado'::public.lancamento_status,
    COALESCE(NULLIF(NEW.descricao, ''), 'Material'), NEW.valor_total,
    NEW.data_compra, NEW.data_compra, NEW.data_compra, NEW.forma_pagamento, NEW.fornecedor,
    'material', NEW.id
  )
  ON CONFLICT (origem, origem_id) DO UPDATE SET
    empresa_id = EXCLUDED.empresa_id, obra_id = EXCLUDED.obra_id, categoria_id = EXCLUDED.categoria_id,
    centro_custo_id = EXCLUDED.centro_custo_id,
    status = EXCLUDED.status, descricao = EXCLUDED.descricao, valor = EXCLUDED.valor,
    data_competencia = EXCLUDED.data_competencia, data_vencimento = EXCLUDED.data_vencimento,
    data_realizado = EXCLUDED.data_realizado, forma_pagamento = EXCLUDED.forma_pagamento,
    fornecedor_nome = EXCLUDED.fornecedor_nome, updated_at = now();
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.fn_cartao_to_lancamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cat uuid; v_apelido text; v_obra_emp uuid;
BEGIN
  PERFORM set_config('app.sync', 'on', true);
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lancamentos_financeiros WHERE origem = 'cartao' AND origem_id = OLD.id;
    RETURN OLD;
  END IF;
  IF NEW.obra_id IS NOT NULL THEN
    SELECT empresa_id INTO v_obra_emp FROM public.obras WHERE id = NEW.obra_id;
    IF v_obra_emp IS NULL OR v_obra_emp IS DISTINCT FROM NEW.empresa_id THEN
      RAISE EXCEPTION 'Obra de outra empresa';
    END IF;
  END IF;
  SELECT id INTO v_cat FROM public.categorias_financeiras
    WHERE empresa_id = NEW.empresa_id AND tipo = 'despesa' AND ativo ORDER BY ordem, nome LIMIT 1;
  SELECT apelido INTO v_apelido FROM public.cartoes_credito WHERE id = NEW.cartao_id;
  INSERT INTO public.lancamentos_financeiros (
    empresa_id, obra_id, categoria_id, centro_custo_id, tipo, status, descricao, valor,
    data_competencia, data_vencimento, data_realizado, fornecedor_nome, origem, origem_id
  ) VALUES (
    NEW.empresa_id, NEW.obra_id, v_cat, NEW.centro_custo_id, 'despesa'::public.lancamento_tipo,
    (CASE WHEN NEW.fatura_paga THEN 'realizado' ELSE 'previsto' END)::public.lancamento_status,
    COALESCE(NULLIF(NEW.descricao, ''), NEW.categoria, 'Despesa de cartão'), NEW.valor,
    NEW.data_compra, COALESCE(NEW.fatura_vencimento, NEW.data_compra),
    CASE WHEN NEW.fatura_paga THEN COALESCE(NEW.fatura_paga_em, NEW.fatura_vencimento, NEW.data_compra) END,
    COALESCE(v_apelido, 'Cartão'), 'cartao', NEW.id
  )
  ON CONFLICT (origem, origem_id) DO UPDATE SET
    empresa_id = EXCLUDED.empresa_id, obra_id = EXCLUDED.obra_id, categoria_id = EXCLUDED.categoria_id,
    centro_custo_id = EXCLUDED.centro_custo_id,
    status = EXCLUDED.status, descricao = EXCLUDED.descricao, valor = EXCLUDED.valor,
    data_competencia = EXCLUDED.data_competencia, data_vencimento = EXCLUDED.data_vencimento,
    data_realizado = EXCLUDED.data_realizado, fornecedor_nome = EXCLUDED.fornecedor_nome, updated_at = now();
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.fn_parcela_to_lancamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cat uuid; v_empresa uuid; v_obra uuid; v_ct_emp uuid; v_cc uuid;
BEGIN
  PERFORM set_config('app.sync', 'on', true);
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lancamentos_financeiros
      WHERE origem = 'parcela_pagamento' AND origem_id = OLD.id AND empresa_id = OLD.empresa_id;
    RETURN OLD;
  END IF;
  SELECT ct.empresa_id, ct.obra_id, ct.centro_custo_id INTO v_ct_emp, v_obra, v_cc
    FROM public.contratacoes_terceirizado ct WHERE ct.id = NEW.contratacao_id;
  IF v_ct_emp IS NULL OR v_ct_emp IS DISTINCT FROM NEW.empresa_id THEN
    RAISE EXCEPTION 'Registro de outra empresa';
  END IF;
  v_empresa := NEW.empresa_id;
  v_cat := public.categoria_por_papel(v_empresa, 'subcontratado');
  INSERT INTO public.lancamentos_financeiros (
    empresa_id, obra_id, categoria_id, centro_custo_id, tipo, status, descricao, valor,
    data_competencia, data_vencimento, data_realizado, forma_pagamento, origem, origem_id
  ) VALUES (
    v_empresa, v_obra, v_cat, v_cc, 'despesa'::public.lancamento_tipo,
    (CASE WHEN NEW.status = 'pago' THEN 'realizado' ELSE 'previsto' END)::public.lancamento_status,
    'Parcela ' || NEW.numero_parcela || ' - contratação', NEW.valor,
    COALESCE(NEW.data_pagamento, NEW.data_prevista, CURRENT_DATE),
    NEW.data_prevista, NEW.data_pagamento, NEW.forma_pagamento, 'parcela_pagamento', NEW.id
  )
  ON CONFLICT (origem, origem_id) DO UPDATE SET
    empresa_id = EXCLUDED.empresa_id, obra_id = EXCLUDED.obra_id, categoria_id = EXCLUDED.categoria_id,
    centro_custo_id = EXCLUDED.centro_custo_id,
    status = EXCLUDED.status, descricao = EXCLUDED.descricao, valor = EXCLUDED.valor,
    data_competencia = EXCLUDED.data_competencia, data_vencimento = EXCLUDED.data_vencimento,
    data_realizado = EXCLUDED.data_realizado, forma_pagamento = EXCLUDED.forma_pagamento,
    updated_at = now();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.fn_recebimento_to_lancamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cat uuid; v_saldo numeric(14,2); v_obra_emp uuid;
BEGIN
  PERFORM set_config('app.sync','on',true);
  IF TG_OP='DELETE' THEN
    DELETE FROM public.lancamentos_financeiros
     WHERE origem IN ('recebimento','recebimento_saldo') AND origem_id=OLD.id AND empresa_id = OLD.empresa_id;
    RETURN OLD;
  END IF;
  IF NEW.obra_id IS NOT NULL THEN
    SELECT empresa_id INTO v_obra_emp FROM public.obras WHERE id = NEW.obra_id;
    IF v_obra_emp IS NULL OR v_obra_emp IS DISTINCT FROM NEW.empresa_id THEN
      RAISE EXCEPTION 'Registro de outra empresa';
    END IF;
  END IF;
  v_cat := public.categoria_por_papel(NEW.empresa_id, 'receita_servico');
  DELETE FROM public.lancamentos_financeiros
   WHERE origem='recebimento_saldo' AND origem_id=NEW.id AND empresa_id = NEW.empresa_id;
  v_saldo := GREATEST(COALESCE(NEW.valor,0) - COALESCE(NEW.valor_recebido,0), 0);
  IF v_saldo > 0 THEN
    INSERT INTO public.lancamentos_financeiros(
      empresa_id,obra_id,categoria_id,tipo,status,descricao,valor,
      data_competencia,data_vencimento,data_realizado,origem,origem_id,impacto_caixa
    ) VALUES (
      NEW.empresa_id,NEW.obra_id,v_cat,'receita','previsto',
      COALESCE(NEW.descricao,'Recebimento de obra'), v_saldo,
      COALESCE(NEW.data_prevista,CURRENT_DATE), NEW.data_prevista, NULL,'recebimento',NEW.id,true
    )
    ON CONFLICT (origem,origem_id) DO UPDATE SET
      obra_id=EXCLUDED.obra_id, categoria_id=EXCLUDED.categoria_id, status='previsto',
      descricao=EXCLUDED.descricao, valor=EXCLUDED.valor,
      data_competencia=EXCLUDED.data_competencia, data_vencimento=EXCLUDED.data_vencimento,
      data_realizado=NULL, impacto_caixa=true, updated_at=now();
  ELSE
    DELETE FROM public.lancamentos_financeiros
     WHERE origem='recebimento' AND origem_id=NEW.id AND empresa_id = NEW.empresa_id;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.fn_pagamento_to_lancamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rec public.recebimentos%ROWTYPE; v_cat uuid;
BEGIN
  PERFORM set_config('app.sync','on',true);
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lancamentos_financeiros
     WHERE origem='recebimento_pagamento' AND origem_id=OLD.id AND empresa_id = OLD.empresa_id;
    RETURN OLD;
  END IF;
  SELECT * INTO v_rec FROM public.recebimentos WHERE id = NEW.recebimento_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recebimento não encontrado'; END IF;
  IF v_rec.empresa_id IS DISTINCT FROM NEW.empresa_id THEN
    RAISE EXCEPTION 'Registro de outra empresa';
  END IF;
  v_cat := public.categoria_por_papel(NEW.empresa_id, 'receita_servico');
  INSERT INTO public.lancamentos_financeiros(
    empresa_id,obra_id,categoria_id,tipo,status,descricao,valor,
    data_competencia,data_vencimento,data_realizado,forma_pagamento,origem,origem_id,impacto_caixa
  ) VALUES (
    NEW.empresa_id, v_rec.obra_id, v_cat,'receita','realizado',
    COALESCE(v_rec.descricao,'Recebimento de obra')||' — pagamento', NEW.valor,
    NEW.data, v_rec.data_prevista, NEW.data, NEW.forma_pagamento,'recebimento_pagamento',NEW.id,true
  )
  ON CONFLICT (origem,origem_id) DO UPDATE SET
    obra_id=EXCLUDED.obra_id, categoria_id=EXCLUDED.categoria_id, descricao=EXCLUDED.descricao,
    valor=EXCLUDED.valor, data_competencia=EXCLUDED.data_competencia,
    data_vencimento=EXCLUDED.data_vencimento, data_realizado=EXCLUDED.data_realizado,
    forma_pagamento=EXCLUDED.forma_pagamento, impacto_caixa=true, updated_at=now();
  RETURN NEW;
END $$;

-- ============ 6. NOVA EMPRESA ============
CREATE OR REPLACE FUNCTION public.handle_nova_empresa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.seed_categorias_financeiras(NEW.id);

  INSERT INTO public.categoria_grupos (empresa_id, chave, nome, tipo, papel, ordem)
  SELECT NEW.id, g.chave, g.nome, g.tipo::public.lancamento_tipo, g.papel, g.ordem FROM (VALUES
    ('receita_servico','Receita de serviço','receita','receita_servico',1),
    ('receita_material','Receita de material','receita',NULL,2),
    ('receita_outro','Outras receitas','receita',NULL,3),
    ('custo_mao_obra_direta','Mão de obra direta','despesa',NULL,4),
    ('custo_mao_obra_indireta','Mão de obra indireta','despesa',NULL,5),
    ('custo_material','Materiais e insumos','despesa','material',6),
    ('custo_equipamento','Equipamentos','despesa',NULL,7),
    ('custo_subcontratado','Subcontratados','despesa','subcontratado',8),
    ('custo_administrativo','Administrativo','despesa',NULL,9),
    ('custo_imposto','Impostos e taxas','despesa',NULL,10),
    ('custo_outro','Outros custos','despesa',NULL,11)
  ) AS g(chave,nome,tipo,papel,ordem)
  ON CONFLICT DO NOTHING;

  UPDATE public.categorias_financeiras cf SET grupo_id = cg.id
    FROM public.categoria_grupos cg
   WHERE cg.empresa_id = NEW.id AND cf.empresa_id = NEW.id AND cg.chave = cf.grupo::text;

  PERFORM public.seed_listas_opcoes(NEW.id);
  PERFORM public.seed_perfis_permissao(NEW.id);

  INSERT INTO public.obra_status_config (empresa_id, chave, nome, cor, ordem, categoria, padrao)
  VALUES
    (NEW.id,'planejada','Planejada','#64748B',1,'nao_iniciada',true),
    (NEW.id,'em_execucao','Em execução','#3B82F6',2,'em_execucao',true),
    (NEW.id,'pausada','Pausada','#F59E0B',3,'em_execucao',false),
    (NEW.id,'concluida','Concluída','#10B981',4,'concluida',true),
    (NEW.id,'cancelada','Cancelada','#EF4444',5,'cancelada',true)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.empresa_rotulos (empresa_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
