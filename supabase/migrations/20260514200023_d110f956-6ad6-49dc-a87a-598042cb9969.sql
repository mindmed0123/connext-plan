-- 1. Enums
DO $$ BEGIN
  CREATE TYPE public.lancamento_tipo AS ENUM ('receita','despesa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.lancamento_status AS ENUM ('previsto','realizado','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.categoria_grupo AS ENUM (
    'receita_servico','receita_material','receita_outro',
    'custo_mao_obra_direta','custo_mao_obra_indireta',
    'custo_material','custo_equipamento','custo_subcontratado',
    'custo_administrativo','custo_imposto','custo_outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.contrato_cliente_status AS ENUM ('ativo','suspenso','encerrado','em_negociacao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.medicao_status AS ENUM ('rascunho','enviada','aprovada','rejeitada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. categorias_financeiras
CREATE TABLE IF NOT EXISTS public.categorias_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  grupo public.categoria_grupo NOT NULL,
  tipo public.lancamento_tipo NOT NULL,
  cor text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);
ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_cat_fin_empresa ON public.categorias_financeiras(empresa_id);

DROP TRIGGER IF EXISTS trg_set_empresa_cat_fin ON public.categorias_financeiras;
CREATE TRIGGER trg_set_empresa_cat_fin BEFORE INSERT ON public.categorias_financeiras
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_from_user();

CREATE POLICY "cat_fin_sel" ON public.categorias_financeiras FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY "cat_fin_ins" ON public.categorias_financeiras FOR INSERT TO authenticated
  WITH CHECK (public.tenant_match(empresa_id) AND public.is_admin_or_super(auth.uid()));
CREATE POLICY "cat_fin_upd" ON public.categorias_financeiras FOR UPDATE TO authenticated
  USING (public.tenant_match(empresa_id) AND public.is_admin_or_super(auth.uid()));
CREATE POLICY "cat_fin_del" ON public.categorias_financeiras FOR DELETE TO authenticated
  USING (public.tenant_match(empresa_id) AND public.is_admin_or_super(auth.uid()));

-- 3. lancamentos_financeiros
CREATE TABLE IF NOT EXISTS public.lancamentos_financeiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  categoria_id uuid REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  tipo public.lancamento_tipo NOT NULL,
  status public.lancamento_status NOT NULL DEFAULT 'previsto',
  descricao text NOT NULL,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  data_competencia date NOT NULL,
  data_vencimento date,
  data_realizado date,
  fornecedor_nome text,
  pessoa_id uuid REFERENCES public.pessoas(id) ON DELETE SET NULL,
  documento_num text,
  forma_pagamento public.forma_pagamento,
  observacoes text,
  comprovante_url text,
  comprovante_path text,
  origem text,
  origem_id uuid,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lancamentos_financeiros ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_lanc_empresa ON public.lancamentos_financeiros(empresa_id);
CREATE INDEX IF NOT EXISTS idx_lanc_obra ON public.lancamentos_financeiros(obra_id);
CREATE INDEX IF NOT EXISTS idx_lanc_venc ON public.lancamentos_financeiros(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_lanc_status ON public.lancamentos_financeiros(status);

DROP TRIGGER IF EXISTS trg_lanc_updated ON public.lancamentos_financeiros;
CREATE TRIGGER trg_lanc_updated BEFORE UPDATE ON public.lancamentos_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_set_empresa_lanc ON public.lancamentos_financeiros;
CREATE TRIGGER trg_set_empresa_lanc BEFORE INSERT ON public.lancamentos_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_from_user();

CREATE POLICY "lanc_sel" ON public.lancamentos_financeiros FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'view')));
CREATE POLICY "lanc_ins" ON public.lancamentos_financeiros FOR INSERT TO authenticated
  WITH CHECK (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'create')));
CREATE POLICY "lanc_upd" ON public.lancamentos_financeiros FOR UPDATE TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'edit')));
CREATE POLICY "lanc_del" ON public.lancamentos_financeiros FOR DELETE TO authenticated
  USING (public.tenant_match(empresa_id) AND public.is_admin_or_super(auth.uid()));

-- 4. contratos_clientes
CREATE TABLE IF NOT EXISTS public.contratos_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  numero_contrato text,
  objeto text NOT NULL,
  valor_global numeric(14,2) NOT NULL DEFAULT 0,
  data_inicio date,
  data_fim date,
  status public.contrato_cliente_status NOT NULL DEFAULT 'ativo',
  condicoes_pgto text,
  observacoes text,
  documento_url text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contratos_clientes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_cc_empresa ON public.contratos_clientes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cc_obra ON public.contratos_clientes(obra_id);

DROP TRIGGER IF EXISTS trg_cc_updated ON public.contratos_clientes;
CREATE TRIGGER trg_cc_updated BEFORE UPDATE ON public.contratos_clientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_set_empresa_cc ON public.contratos_clientes;
CREATE TRIGGER trg_set_empresa_cc BEFORE INSERT ON public.contratos_clientes
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_from_user();

CREATE POLICY "cc_sel" ON public.contratos_clientes FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'view')));
CREATE POLICY "cc_ins" ON public.contratos_clientes FOR INSERT TO authenticated
  WITH CHECK (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'create')));
CREATE POLICY "cc_upd" ON public.contratos_clientes FOR UPDATE TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'edit')));
CREATE POLICY "cc_del" ON public.contratos_clientes FOR DELETE TO authenticated
  USING (public.tenant_match(empresa_id) AND public.is_admin_or_super(auth.uid()));

-- 5. medicoes
CREATE TABLE IF NOT EXISTS public.medicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  contrato_id uuid REFERENCES public.contratos_clientes(id) ON DELETE SET NULL,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  numero_medicao integer NOT NULL,
  referencia text,
  data_medicao date NOT NULL,
  valor_medido numeric(14,2) NOT NULL DEFAULT 0,
  valor_acumulado numeric(14,2) NOT NULL DEFAULT 0,
  percentual numeric(5,2),
  status public.medicao_status NOT NULL DEFAULT 'rascunho',
  observacoes text,
  aprovado_por uuid REFERENCES auth.users(id),
  aprovado_em timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medicoes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_med_empresa ON public.medicoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_med_obra ON public.medicoes(obra_id);
CREATE INDEX IF NOT EXISTS idx_med_contrato ON public.medicoes(contrato_id);

DROP TRIGGER IF EXISTS trg_med_updated ON public.medicoes;
CREATE TRIGGER trg_med_updated BEFORE UPDATE ON public.medicoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_set_empresa_med ON public.medicoes;
CREATE TRIGGER trg_set_empresa_med BEFORE INSERT ON public.medicoes
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_from_user();

CREATE POLICY "med_sel" ON public.medicoes FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'faturamento', 'view')));
CREATE POLICY "med_ins" ON public.medicoes FOR INSERT TO authenticated
  WITH CHECK (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'faturamento', 'create')));
CREATE POLICY "med_upd" ON public.medicoes FOR UPDATE TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'faturamento', 'edit')));
CREATE POLICY "med_del" ON public.medicoes FOR DELETE TO authenticated
  USING (public.tenant_match(empresa_id) AND public.is_admin_or_super(auth.uid()));

-- 6. get_dre_obra
CREATE OR REPLACE FUNCTION public.get_dre_obra(_empresa_id uuid, _obra_id uuid DEFAULT NULL)
RETURNS TABLE (
  obra_id uuid, obra_codigo text,
  receita_contratada numeric, receita_medida numeric, receita_recebida numeric,
  custo_subcontratado numeric, custo_materiais numeric, custo_total_real numeric,
  margem_bruta numeric, margem_pct numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR _empresa_id = public.get_user_empresa_id()) THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;
  RETURN QUERY
  SELECT o.id, o.codigo_chamado,
    COALESCE((SELECT SUM(orc.valor_orcamento) FROM public.orcamentos orc WHERE orc.obra_id = o.id AND orc.status = 'aprovado'), 0),
    COALESCE((SELECT SUM(m.valor_medido) FROM public.medicoes m WHERE m.obra_id = o.id AND m.status = 'aprovada'), 0),
    COALESCE((SELECT SUM(lf.valor) FROM public.lancamentos_financeiros lf WHERE lf.obra_id = o.id AND lf.tipo = 'receita' AND lf.status = 'realizado'), 0)
      + COALESCE((SELECT SUM(r.valor) FROM public.recebimentos r WHERE r.obra_id = o.id AND r.status = 'recebido'), 0),
    COALESCE((SELECT SUM(pp.valor) FROM public.parcelas_pagamento pp JOIN public.contratacoes_terceirizado ct ON ct.id = pp.contratacao_id WHERE ct.obra_id = o.id AND pp.status = 'pago'), 0),
    COALESCE((SELECT SUM(mo.valor_total) FROM public.materiais_obra mo WHERE mo.obra_id = o.id), 0),
    COALESCE((SELECT SUM(lf2.valor) FROM public.lancamentos_financeiros lf2 WHERE lf2.obra_id = o.id AND lf2.tipo = 'despesa' AND lf2.status = 'realizado'), 0)
      + COALESCE((SELECT SUM(pp2.valor) FROM public.parcelas_pagamento pp2 JOIN public.contratacoes_terceirizado ct2 ON ct2.id = pp2.contratacao_id WHERE ct2.obra_id = o.id AND pp2.status = 'pago'), 0)
      + COALESCE((SELECT SUM(mo2.valor_total) FROM public.materiais_obra mo2 WHERE mo2.obra_id = o.id), 0),
    (COALESCE((SELECT SUM(lf3.valor) FROM public.lancamentos_financeiros lf3 WHERE lf3.obra_id = o.id AND lf3.tipo = 'receita' AND lf3.status = 'realizado'), 0)
     + COALESCE((SELECT SUM(r2.valor) FROM public.recebimentos r2 WHERE r2.obra_id = o.id AND r2.status = 'recebido'), 0)
     - COALESCE((SELECT SUM(lf4.valor) FROM public.lancamentos_financeiros lf4 WHERE lf4.obra_id = o.id AND lf4.tipo = 'despesa' AND lf4.status = 'realizado'), 0)
     - COALESCE((SELECT SUM(pp3.valor) FROM public.parcelas_pagamento pp3 JOIN public.contratacoes_terceirizado ct3 ON ct3.id = pp3.contratacao_id WHERE ct3.obra_id = o.id AND pp3.status = 'pago'), 0)
     - COALESCE((SELECT SUM(mo3.valor_total) FROM public.materiais_obra mo3 WHERE mo3.obra_id = o.id), 0)),
    CASE WHEN COALESCE((SELECT SUM(orc2.valor_orcamento) FROM public.orcamentos orc2 WHERE orc2.obra_id = o.id AND orc2.status = 'aprovado'), 0) = 0 THEN 0
    ELSE ROUND(((COALESCE((SELECT SUM(lf5.valor) FROM public.lancamentos_financeiros lf5 WHERE lf5.obra_id = o.id AND lf5.tipo = 'receita' AND lf5.status = 'realizado'), 0)
       + COALESCE((SELECT SUM(r3.valor) FROM public.recebimentos r3 WHERE r3.obra_id = o.id AND r3.status = 'recebido'), 0)
       - COALESCE((SELECT SUM(lf6.valor) FROM public.lancamentos_financeiros lf6 WHERE lf6.obra_id = o.id AND lf6.tipo = 'despesa' AND lf6.status = 'realizado'), 0)
       - COALESCE((SELECT SUM(pp4.valor) FROM public.parcelas_pagamento pp4 JOIN public.contratacoes_terceirizado ct4 ON ct4.id = pp4.contratacao_id WHERE ct4.obra_id = o.id AND pp4.status = 'pago'), 0)
       - COALESCE((SELECT SUM(mo4.valor_total) FROM public.materiais_obra mo4 WHERE mo4.obra_id = o.id), 0))
      / NULLIF(COALESCE((SELECT SUM(orc3.valor_orcamento) FROM public.orcamentos orc3 WHERE orc3.obra_id = o.id AND orc3.status = 'aprovado'), 0), 0) * 100), 2)
    END
  FROM public.obras o
  WHERE o.empresa_id = _empresa_id AND (_obra_id IS NULL OR o.id = _obra_id)
  ORDER BY o.created_at DESC;
END; $$;

-- 7. get_fluxo_caixa_mensal
CREATE OR REPLACE FUNCTION public.get_fluxo_caixa_mensal(
  _empresa_id uuid, _meses_atras integer DEFAULT 6, _meses_frente integer DEFAULT 3
)
RETURNS TABLE (
  mes text, ano integer, mes_num integer,
  receitas_prev numeric, receitas_real numeric,
  despesas_prev numeric, despesas_real numeric,
  saldo_prev numeric, saldo_real numeric, saldo_acumulado numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inicio date := date_trunc('month', CURRENT_DATE - (_meses_atras || ' months')::interval)::date;
  v_fim date := date_trunc('month', CURRENT_DATE + (_meses_frente || ' months')::interval)::date;
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR _empresa_id = public.get_user_empresa_id()) THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;
  RETURN QUERY
  WITH serie AS (
    SELECT generate_series(v_inicio, v_fim, '1 month'::interval)::date AS mes_inicio
  ),
  lancamentos_agg AS (
    SELECT date_trunc('month', COALESCE(lf.data_vencimento, lf.data_competencia))::date AS mes_ref,
      SUM(CASE WHEN lf.tipo = 'receita' AND lf.status IN ('previsto','realizado') THEN lf.valor ELSE 0 END) AS rec_prev,
      SUM(CASE WHEN lf.tipo = 'receita' AND lf.status = 'realizado' THEN lf.valor ELSE 0 END) AS rec_real,
      SUM(CASE WHEN lf.tipo = 'despesa' AND lf.status IN ('previsto','realizado') THEN lf.valor ELSE 0 END) AS dep_prev,
      SUM(CASE WHEN lf.tipo = 'despesa' AND lf.status = 'realizado' THEN lf.valor ELSE 0 END) AS dep_real
    FROM public.lancamentos_financeiros lf
    WHERE lf.empresa_id = _empresa_id
    GROUP BY mes_ref
  ),
  parcelas_agg AS (
    SELECT date_trunc('month', pp.data_prevista)::date AS mes_ref,
      0::numeric AS rec_prev, 0::numeric AS rec_real,
      SUM(pp.valor) AS dep_prev,
      SUM(CASE WHEN pp.status = 'pago' THEN pp.valor ELSE 0 END) AS dep_real
    FROM public.parcelas_pagamento pp
    JOIN public.contratacoes_terceirizado ct ON ct.id = pp.contratacao_id
    WHERE ct.empresa_id = _empresa_id AND pp.data_prevista IS NOT NULL
    GROUP BY mes_ref
  ),
  rec_agg AS (
    SELECT date_trunc('month', r.data_prevista)::date AS mes_ref,
      SUM(r.valor) AS rec_prev,
      SUM(CASE WHEN r.status = 'recebido' THEN r.valor ELSE 0 END) AS rec_real,
      0::numeric AS dep_prev, 0::numeric AS dep_real
    FROM public.recebimentos r
    WHERE r.empresa_id = _empresa_id AND r.data_prevista IS NOT NULL
    GROUP BY mes_ref
  ),
  combined AS (
    SELECT mes_ref, rec_prev, rec_real, dep_prev, dep_real FROM lancamentos_agg
    UNION ALL SELECT mes_ref, rec_prev, rec_real, dep_prev, dep_real FROM parcelas_agg
    UNION ALL SELECT mes_ref, rec_prev, rec_real, dep_prev, dep_real FROM rec_agg
  ),
  agg AS (
    SELECT mes_ref, SUM(rec_prev) AS rec_prev, SUM(rec_real) AS rec_real,
      SUM(dep_prev) AS dep_prev, SUM(dep_real) AS dep_real
    FROM combined GROUP BY mes_ref
  )
  SELECT to_char(s.mes_inicio, 'Mon/YY'),
    EXTRACT(YEAR FROM s.mes_inicio)::integer,
    EXTRACT(MONTH FROM s.mes_inicio)::integer,
    COALESCE(a.rec_prev, 0), COALESCE(a.rec_real, 0),
    COALESCE(a.dep_prev, 0), COALESCE(a.dep_real, 0),
    COALESCE(a.rec_prev, 0) - COALESCE(a.dep_prev, 0),
    COALESCE(a.rec_real, 0) - COALESCE(a.dep_real, 0),
    SUM(COALESCE(a.rec_real, 0) - COALESCE(a.dep_real, 0))
      OVER (ORDER BY s.mes_inicio ROWS UNBOUNDED PRECEDING)
  FROM serie s LEFT JOIN agg a ON a.mes_ref = s.mes_inicio
  ORDER BY s.mes_inicio;
END; $$;

-- 8. seed categorias padrão
CREATE OR REPLACE FUNCTION public.seed_categorias_financeiras(_empresa_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
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

CREATE OR REPLACE FUNCTION public.handle_nova_empresa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.seed_categorias_financeiras(NEW.id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_nova_empresa_seed ON public.empresas;
CREATE TRIGGER trg_nova_empresa_seed
  AFTER INSERT ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.handle_nova_empresa();

-- Seed para empresas existentes
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.empresas LOOP
    PERFORM public.seed_categorias_financeiras(r.id);
  END LOOP;
END $$;