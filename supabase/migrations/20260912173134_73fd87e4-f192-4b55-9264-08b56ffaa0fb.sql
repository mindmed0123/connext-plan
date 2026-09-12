-- ===== INSUMOS =====
CREATE TABLE public.insumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) DEFAULT public.get_user_empresa_id(),
  codigo text NOT NULL,
  descricao text NOT NULL,
  unidade text NOT NULL DEFAULT 'un',
  preco_unitario numeric(14,4) NOT NULL DEFAULT 0,
  origem text NOT NULL DEFAULT 'propria' CHECK (origem IN ('propria','referencia')),
  tabela_referencia text NOT NULL DEFAULT '',
  data_referencia date,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insumos TO authenticated;
GRANT ALL ON public.insumos TO service_role;
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX insumos_empresa_codigo_key ON public.insumos (empresa_id, codigo, tabela_referencia);
CREATE INDEX insumos_empresa_desc_idx ON public.insumos (empresa_id, lower(descricao));

CREATE POLICY "insumos_select" ON public.insumos FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY "insumos_insert" ON public.insumos FOR INSERT TO authenticated
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','create')));
CREATE POLICY "insumos_update" ON public.insumos FOR UPDATE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','edit')))
  WITH CHECK (public.tenant_can_write(empresa_id));
CREATE POLICY "insumos_delete" ON public.insumos FOR DELETE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','delete')));

CREATE TABLE public.insumo_precos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) DEFAULT public.get_user_empresa_id(),
  insumo_id uuid NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
  data_referencia date NOT NULL,
  preco_unitario numeric(14,4) NOT NULL DEFAULT 0,
  fonte text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insumo_precos TO authenticated;
GRANT ALL ON public.insumo_precos TO service_role;
ALTER TABLE public.insumo_precos ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX insumo_precos_key ON public.insumo_precos (empresa_id, insumo_id, data_referencia);

CREATE POLICY "insumo_precos_select" ON public.insumo_precos FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY "insumo_precos_insert" ON public.insumo_precos FOR INSERT TO authenticated
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','create'))
    AND public.mesmo_tenant('public.insumos', insumo_id, empresa_id));
CREATE POLICY "insumo_precos_update" ON public.insumo_precos FOR UPDATE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','edit'))
    AND public.mesmo_tenant('public.insumos', insumo_id, empresa_id))
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND public.mesmo_tenant('public.insumos', insumo_id, empresa_id));
CREATE POLICY "insumo_precos_delete" ON public.insumo_precos FOR DELETE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','delete')));

-- ===== COMPOSICOES =====
CREATE TABLE public.composicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) DEFAULT public.get_user_empresa_id(),
  codigo text NOT NULL,
  descricao text NOT NULL,
  unidade text NOT NULL DEFAULT 'un',
  origem text NOT NULL DEFAULT 'propria' CHECK (origem IN ('propria','referencia')),
  tabela_referencia text NOT NULL DEFAULT '',
  data_referencia date,
  preco_calculado numeric(14,4) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.composicoes TO authenticated;
GRANT ALL ON public.composicoes TO service_role;
ALTER TABLE public.composicoes ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX composicoes_empresa_codigo_key ON public.composicoes (empresa_id, codigo, tabela_referencia);

CREATE POLICY "composicoes_select" ON public.composicoes FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY "composicoes_insert" ON public.composicoes FOR INSERT TO authenticated
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','create')));
CREATE POLICY "composicoes_update" ON public.composicoes FOR UPDATE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','edit')))
  WITH CHECK (public.tenant_can_write(empresa_id));
CREATE POLICY "composicoes_delete" ON public.composicoes FOR DELETE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','delete')));

CREATE TABLE public.composicao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) DEFAULT public.get_user_empresa_id(),
  composicao_id uuid NOT NULL REFERENCES public.composicoes(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('insumo','composicao')),
  insumo_id uuid REFERENCES public.insumos(id) ON DELETE RESTRICT,
  composicao_filha_id uuid REFERENCES public.composicoes(id) ON DELETE RESTRICT,
  coeficiente numeric(14,6) NOT NULL DEFAULT 1,
  observacao text,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT composicao_itens_ref_chk CHECK (
    (tipo = 'insumo' AND insumo_id IS NOT NULL AND composicao_filha_id IS NULL)
    OR (tipo = 'composicao' AND composicao_filha_id IS NOT NULL AND insumo_id IS NULL)
  ),
  CONSTRAINT composicao_itens_nao_self CHECK (composicao_filha_id IS NULL OR composicao_filha_id <> composicao_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.composicao_itens TO authenticated;
GRANT ALL ON public.composicao_itens TO service_role;
ALTER TABLE public.composicao_itens ENABLE ROW LEVEL SECURITY;
CREATE INDEX composicao_itens_comp_idx ON public.composicao_itens (empresa_id, composicao_id);

CREATE POLICY "composicao_itens_select" ON public.composicao_itens FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY "composicao_itens_insert" ON public.composicao_itens FOR INSERT TO authenticated
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','create'))
    AND public.mesmo_tenant('public.composicoes', composicao_id, empresa_id)
    AND (insumo_id IS NULL OR public.mesmo_tenant('public.insumos', insumo_id, empresa_id))
    AND (composicao_filha_id IS NULL OR public.mesmo_tenant('public.composicoes', composicao_filha_id, empresa_id)));
CREATE POLICY "composicao_itens_update" ON public.composicao_itens FOR UPDATE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','edit'))
    AND public.mesmo_tenant('public.composicoes', composicao_id, empresa_id)
    AND (insumo_id IS NULL OR public.mesmo_tenant('public.insumos', insumo_id, empresa_id))
    AND (composicao_filha_id IS NULL OR public.mesmo_tenant('public.composicoes', composicao_filha_id, empresa_id)))
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND public.mesmo_tenant('public.composicoes', composicao_id, empresa_id)
    AND (insumo_id IS NULL OR public.mesmo_tenant('public.insumos', insumo_id, empresa_id))
    AND (composicao_filha_id IS NULL OR public.mesmo_tenant('public.composicoes', composicao_filha_id, empresa_id)));
CREATE POLICY "composicao_itens_delete" ON public.composicao_itens FOR DELETE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','delete')));

-- ===== IMPORTACOES DE REFERENCIA =====
CREATE TABLE public.importacoes_referencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) DEFAULT public.get_user_empresa_id(),
  arquivo_nome text NOT NULL,
  tabela_referencia text NOT NULL DEFAULT '',
  mes_referencia date,
  tipo text NOT NULL DEFAULT 'insumos' CHECK (tipo IN ('insumos','composicoes','analitica')),
  linhas_novas integer NOT NULL DEFAULT 0,
  linhas_atualizadas integer NOT NULL DEFAULT 0,
  linhas_erro integer NOT NULL DEFAULT 0,
  importado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.importacoes_referencia TO authenticated;
GRANT ALL ON public.importacoes_referencia TO service_role;
ALTER TABLE public.importacoes_referencia ENABLE ROW LEVEL SECURITY;
CREATE INDEX importacoes_referencia_emp_idx ON public.importacoes_referencia (empresa_id, created_at DESC);

CREATE POLICY "importacoes_referencia_select" ON public.importacoes_referencia FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY "importacoes_referencia_insert" ON public.importacoes_referencia FOR INSERT TO authenticated
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','create')));
CREATE POLICY "importacoes_referencia_update" ON public.importacoes_referencia FOR UPDATE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','edit')))
  WITH CHECK (public.tenant_can_write(empresa_id));
CREATE POLICY "importacoes_referencia_delete" ON public.importacoes_referencia FOR DELETE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','delete')));

-- ===== CRONOGRAMA: COLUNAS E DEPENDENCIAS =====
ALTER TABLE public.cronograma_etapas
  ADD COLUMN IF NOT EXISTS data_inicio date,
  ADD COLUMN IF NOT EXISTS data_fim date,
  ADD COLUMN IF NOT EXISTS duracao_dias integer,
  ADD COLUMN IF NOT EXISTS percentual_realizado numeric(7,4) NOT NULL DEFAULT 0;

CREATE TABLE public.cronograma_dependencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) DEFAULT public.get_user_empresa_id(),
  etapa_id uuid NOT NULL REFERENCES public.cronograma_etapas(id) ON DELETE CASCADE,
  depende_de_etapa_id uuid NOT NULL REFERENCES public.cronograma_etapas(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'FI' CHECK (tipo IN ('FI','II')),
  folga_dias integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cronograma_dep_nao_self CHECK (etapa_id <> depende_de_etapa_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_dependencias TO authenticated;
GRANT ALL ON public.cronograma_dependencias TO service_role;
ALTER TABLE public.cronograma_dependencias ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX cronograma_dep_key ON public.cronograma_dependencias (empresa_id, etapa_id, depende_de_etapa_id);

CREATE POLICY "cronograma_dep_select" ON public.cronograma_dependencias FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY "cronograma_dep_insert" ON public.cronograma_dependencias FOR INSERT TO authenticated
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'etapas','create'))
    AND public.mesmo_tenant('public.cronograma_etapas', etapa_id, empresa_id)
    AND public.mesmo_tenant('public.cronograma_etapas', depende_de_etapa_id, empresa_id));
CREATE POLICY "cronograma_dep_update" ON public.cronograma_dependencias FOR UPDATE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'etapas','edit'))
    AND public.mesmo_tenant('public.cronograma_etapas', etapa_id, empresa_id)
    AND public.mesmo_tenant('public.cronograma_etapas', depende_de_etapa_id, empresa_id))
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND public.mesmo_tenant('public.cronograma_etapas', etapa_id, empresa_id)
    AND public.mesmo_tenant('public.cronograma_etapas', depende_de_etapa_id, empresa_id));
CREATE POLICY "cronograma_dep_delete" ON public.cronograma_dependencias FOR DELETE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'etapas','delete')));

-- ===== ORCAMENTO_ITENS: origem da base =====
ALTER TABLE public.orcamento_itens
  ADD COLUMN IF NOT EXISTS insumo_id uuid REFERENCES public.insumos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS composicao_id uuid REFERENCES public.composicoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS preco_base numeric(14,4),
  ADD COLUMN IF NOT EXISTS preco_aplicado numeric(14,4),
  ADD COLUMN IF NOT EXISTS justificativa_preco text;

-- ===== TRIGGERS =====
CREATE TRIGGER trg_insumos_updated BEFORE UPDATE ON public.insumos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_insumo_precos_updated BEFORE UPDATE ON public.insumo_precos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_composicoes_updated BEFORE UPDATE ON public.composicoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_composicao_itens_updated BEFORE UPDATE ON public.composicao_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_importacoes_ref_updated BEFORE UPDATE ON public.importacoes_referencia
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cronograma_dep_updated BEFORE UPDATE ON public.cronograma_dependencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- valida tenant dos pais sem derivar empresa_id do pai
CREATE OR REPLACE FUNCTION public.fn_composicao_item_before()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.composicoes c WHERE c.id = NEW.composicao_id AND c.empresa_id = NEW.empresa_id) THEN
    RAISE EXCEPTION 'Composição de outra empresa';
  END IF;
  IF NEW.insumo_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.insumos i WHERE i.id = NEW.insumo_id AND i.empresa_id = NEW.empresa_id) THEN
    RAISE EXCEPTION 'Insumo de outra empresa';
  END IF;
  IF NEW.composicao_filha_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.composicoes c WHERE c.id = NEW.composicao_filha_id AND c.empresa_id = NEW.empresa_id) THEN
    RAISE EXCEPTION 'Subcomposição de outra empresa';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.fn_composicao_item_before() FROM anon, public;
CREATE TRIGGER trg_composicao_item_before BEFORE INSERT OR UPDATE ON public.composicao_itens
  FOR EACH ROW EXECUTE FUNCTION public.fn_composicao_item_before();

CREATE OR REPLACE FUNCTION public.fn_cronograma_dep_before()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ciclo boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.cronograma_etapas e WHERE e.id = NEW.etapa_id AND e.empresa_id = NEW.empresa_id)
     OR NOT EXISTS (SELECT 1 FROM public.cronograma_etapas e WHERE e.id = NEW.depende_de_etapa_id AND e.empresa_id = NEW.empresa_id) THEN
    RAISE EXCEPTION 'Etapa de outra empresa';
  END IF;
  WITH RECURSIVE cadeia AS (
    SELECT d.depende_de_etapa_id AS no FROM public.cronograma_dependencias d
      WHERE d.etapa_id = NEW.depende_de_etapa_id AND d.empresa_id = NEW.empresa_id
    UNION
    SELECT d.depende_de_etapa_id FROM public.cronograma_dependencias d
      JOIN cadeia c ON d.etapa_id = c.no
      WHERE d.empresa_id = NEW.empresa_id
  )
  SELECT EXISTS (SELECT 1 FROM cadeia WHERE no = NEW.etapa_id) INTO v_ciclo;
  IF v_ciclo THEN
    RAISE EXCEPTION 'Dependência circular entre etapas do cronograma';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.fn_cronograma_dep_before() FROM anon, public;
CREATE TRIGGER trg_cronograma_dep_before BEFORE INSERT OR UPDATE ON public.cronograma_dependencias
  FOR EACH ROW EXECUTE FUNCTION public.fn_cronograma_dep_before();

-- ===== CALCULO DE COMPOSICAO =====
CREATE OR REPLACE FUNCTION public.calc_preco_composicao(_composicao_id uuid, _data date DEFAULT NULL, _nivel integer DEFAULT 1, _visitados uuid[] DEFAULT '{}')
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp uuid := public.get_user_empresa_id();
  v_total numeric(18,6) := 0;
  r record;
  v_preco numeric(18,6);
BEGIN
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Empresa não identificada'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.composicoes c WHERE c.id = _composicao_id AND c.empresa_id = v_emp) THEN
    RAISE EXCEPTION 'Composição não encontrada nesta empresa';
  END IF;
  IF _nivel > 5 THEN RAISE EXCEPTION 'Composição com mais de 5 níveis de subcomposição'; END IF;
  IF _composicao_id = ANY(_visitados) THEN RAISE EXCEPTION 'Referência circular na composição'; END IF;

  FOR r IN SELECT ci.tipo, ci.insumo_id, ci.composicao_filha_id, ci.coeficiente
           FROM public.composicao_itens ci
           WHERE ci.composicao_id = _composicao_id AND ci.empresa_id = v_emp LOOP
    IF r.tipo = 'insumo' THEN
      IF _data IS NULL THEN
        SELECT i.preco_unitario INTO v_preco FROM public.insumos i
          WHERE i.id = r.insumo_id AND i.empresa_id = v_emp;
      ELSE
        SELECT p.preco_unitario INTO v_preco FROM public.insumo_precos p
          WHERE p.insumo_id = r.insumo_id AND p.empresa_id = v_emp AND p.data_referencia <= _data
          ORDER BY p.data_referencia DESC LIMIT 1;
        IF v_preco IS NULL THEN
          SELECT i.preco_unitario INTO v_preco FROM public.insumos i
            WHERE i.id = r.insumo_id AND i.empresa_id = v_emp;
        END IF;
      END IF;
    ELSE
      v_preco := public.calc_preco_composicao(r.composicao_filha_id, _data, _nivel + 1, _visitados || _composicao_id);
    END IF;
    v_total := v_total + COALESCE(v_preco,0) * r.coeficiente;
  END LOOP;

  RETURN round(v_total, 4);
END $$;
REVOKE EXECUTE ON FUNCTION public.calc_preco_composicao(uuid, date, integer, uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.calc_preco_composicao(uuid, date, integer, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.recalcular_composicao(_composicao_id uuid, _data date DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp uuid := public.get_user_empresa_id();
  v_preco numeric;
BEGIN
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Empresa não identificada'; END IF;
  IF NOT (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','edit')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  v_preco := public.calc_preco_composicao(_composicao_id, _data, 1, '{}');
  UPDATE public.composicoes SET preco_calculado = v_preco, updated_at = now()
    WHERE id = _composicao_id AND empresa_id = v_emp;
  RETURN v_preco;
END $$;
REVOKE EXECUTE ON FUNCTION public.recalcular_composicao(uuid, date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.recalcular_composicao(uuid, date) TO authenticated;

-- ===== PREVIA DE ATUALIZACAO DE PRECOS DO ORCAMENTO =====
CREATE OR REPLACE FUNCTION public.previa_precos_orcamento(_orcamento_id uuid, _data date)
RETURNS TABLE (item_id uuid, descricao text, preco_atual numeric, preco_novo numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_user_empresa_id();
BEGIN
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Empresa não identificada'; END IF;
  IF NOT (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','view')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.orcamentos o WHERE o.id = _orcamento_id AND o.empresa_id = v_emp) THEN
    RAISE EXCEPTION 'Orçamento não encontrado nesta empresa';
  END IF;
  RETURN QUERY
  SELECT oi.id, oi.descricao, oi.preco_unitario,
    CASE
      WHEN oi.composicao_id IS NOT NULL THEN public.calc_preco_composicao(oi.composicao_id, _data, 1, '{}')
      WHEN oi.insumo_id IS NOT NULL THEN COALESCE(
        (SELECT p.preco_unitario FROM public.insumo_precos p
          WHERE p.insumo_id = oi.insumo_id AND p.empresa_id = v_emp AND p.data_referencia <= _data
          ORDER BY p.data_referencia DESC LIMIT 1),
        (SELECT i.preco_unitario FROM public.insumos i WHERE i.id = oi.insumo_id AND i.empresa_id = v_emp))
      ELSE oi.preco_unitario
    END
  FROM public.orcamento_itens oi
  WHERE oi.orcamento_id = _orcamento_id AND oi.empresa_id = v_emp
  ORDER BY oi.ordem;
END $$;
REVOKE EXECUTE ON FUNCTION public.previa_precos_orcamento(uuid, date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.previa_precos_orcamento(uuid, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.aplicar_precos_orcamento(_orcamento_id uuid, _data date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp uuid := public.get_user_empresa_id();
  v_status text;
  v_qtd integer := 0;
  r record;
BEGIN
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Empresa não identificada'; END IF;
  IF NOT (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','edit')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  SELECT o.status::text INTO v_status FROM public.orcamentos o
    WHERE o.id = _orcamento_id AND o.empresa_id = v_emp;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Orçamento não encontrado nesta empresa'; END IF;
  IF v_status = 'aprovado' THEN RAISE EXCEPTION 'Orçamento aprovado não pode ser recalculado'; END IF;

  FOR r IN SELECT * FROM public.previa_precos_orcamento(_orcamento_id, _data) LOOP
    IF r.preco_novo IS NOT NULL AND r.preco_novo <> r.preco_atual THEN
      UPDATE public.orcamento_itens
        SET preco_unitario = r.preco_novo, preco_base = r.preco_novo, preco_aplicado = r.preco_novo
        WHERE id = r.item_id AND empresa_id = v_emp;
      v_qtd := v_qtd + 1;
    END IF;
  END LOOP;
  RETURN v_qtd;
END $$;
REVOKE EXECUTE ON FUNCTION public.aplicar_precos_orcamento(uuid, date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.aplicar_precos_orcamento(uuid, date) TO authenticated;