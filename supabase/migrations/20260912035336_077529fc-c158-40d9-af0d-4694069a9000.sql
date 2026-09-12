-- ============ 1. TABELAS NOVAS ============
CREATE TABLE public.obra_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT get_user_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX obra_etapas_unq ON public.obra_etapas (empresa_id, obra_id, lower(nome));
CREATE INDEX obra_etapas_obra_idx ON public.obra_etapas (empresa_id, obra_id, ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_etapas TO authenticated;
GRANT ALL ON public.obra_etapas TO service_role;
ALTER TABLE public.obra_etapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "obra_etapas_select" ON public.obra_etapas FOR SELECT TO authenticated
USING (tenant_match(empresa_id));
CREATE POLICY "obra_etapas_insert" ON public.obra_etapas FOR INSERT TO authenticated
WITH CHECK (
  tenant_can_write(empresa_id)
  AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(), 'obras'::app_modulo, 'create'::app_acao))
  AND EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_id AND o.empresa_id = obra_etapas.empresa_id)
);
CREATE POLICY "obra_etapas_update" ON public.obra_etapas FOR UPDATE TO authenticated
USING (
  tenant_can_write(empresa_id)
  AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(), 'obras'::app_modulo, 'edit'::app_acao))
  AND EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_id AND o.empresa_id = obra_etapas.empresa_id)
)
WITH CHECK (
  tenant_can_write(empresa_id)
  AND EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_id AND o.empresa_id = obra_etapas.empresa_id)
);
CREATE POLICY "obra_etapas_delete" ON public.obra_etapas FOR DELETE TO authenticated
USING (
  tenant_can_write(empresa_id)
  AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(), 'obras'::app_modulo, 'delete'::app_acao))
);

CREATE TRIGGER trg_obra_etapas_updated BEFORE UPDATE ON public.obra_etapas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.cronograma_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT get_user_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  etapa_id uuid REFERENCES public.obra_etapas(id) ON DELETE CASCADE,
  mes date NOT NULL,
  valor_previsto numeric(14,2) NOT NULL DEFAULT 0,
  percentual_previsto numeric(7,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX cronograma_etapas_unq ON public.cronograma_etapas (empresa_id, obra_id, coalesce(etapa_id, '00000000-0000-0000-0000-000000000000'::uuid), mes);
CREATE INDEX cronograma_etapas_obra_idx ON public.cronograma_etapas (empresa_id, obra_id, mes);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_etapas TO authenticated;
GRANT ALL ON public.cronograma_etapas TO service_role;
ALTER TABLE public.cronograma_etapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cronograma_select" ON public.cronograma_etapas FOR SELECT TO authenticated
USING (tenant_match(empresa_id));
CREATE POLICY "cronograma_insert" ON public.cronograma_etapas FOR INSERT TO authenticated
WITH CHECK (
  tenant_can_write(empresa_id)
  AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(), 'obras'::app_modulo, 'create'::app_acao))
  AND EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_id AND o.empresa_id = cronograma_etapas.empresa_id)
  AND (etapa_id IS NULL OR EXISTS (SELECT 1 FROM public.obra_etapas e WHERE e.id = etapa_id AND e.empresa_id = cronograma_etapas.empresa_id AND e.obra_id = cronograma_etapas.obra_id))
);
CREATE POLICY "cronograma_update" ON public.cronograma_etapas FOR UPDATE TO authenticated
USING (
  tenant_can_write(empresa_id)
  AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(), 'obras'::app_modulo, 'edit'::app_acao))
  AND EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_id AND o.empresa_id = cronograma_etapas.empresa_id)
)
WITH CHECK (
  tenant_can_write(empresa_id)
  AND EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_id AND o.empresa_id = cronograma_etapas.empresa_id)
  AND (etapa_id IS NULL OR EXISTS (SELECT 1 FROM public.obra_etapas e WHERE e.id = etapa_id AND e.empresa_id = cronograma_etapas.empresa_id AND e.obra_id = cronograma_etapas.obra_id))
);
CREATE POLICY "cronograma_delete" ON public.cronograma_etapas FOR DELETE TO authenticated
USING (
  tenant_can_write(empresa_id)
  AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(), 'obras'::app_modulo, 'delete'::app_acao))
);

CREATE TRIGGER trg_cronograma_updated BEFORE UPDATE ON public.cronograma_etapas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 2. COLUNAS DE VÍNCULO ============
ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS etapa_id uuid REFERENCES public.obra_etapas(id) ON DELETE SET NULL;
ALTER TABLE public.lancamentos_financeiros
  ADD COLUMN IF NOT EXISTS etapa_id uuid REFERENCES public.obra_etapas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS orcamento_item_id uuid REFERENCES public.orcamento_itens(id) ON DELETE SET NULL;
ALTER TABLE public.materiais_obra
  ADD COLUMN IF NOT EXISTS etapa_id uuid REFERENCES public.obra_etapas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS orcamento_item_id uuid REFERENCES public.orcamento_itens(id) ON DELETE SET NULL;
ALTER TABLE public.cartao_despesas
  ADD COLUMN IF NOT EXISTS etapa_id uuid REFERENCES public.obra_etapas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS orcamento_item_id uuid REFERENCES public.orcamento_itens(id) ON DELETE SET NULL;
ALTER TABLE public.contratacoes_terceirizado
  ADD COLUMN IF NOT EXISTS etapa_id uuid REFERENCES public.obra_etapas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS orcamento_item_id uuid REFERENCES public.orcamento_itens(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS lanc_etapa_idx ON public.lancamentos_financeiros (empresa_id, obra_id, etapa_id);

-- ============ 3. VALIDAÇÃO DE TENANT NOS VÍNCULOS ============
CREATE OR REPLACE FUNCTION public.fn_valida_etapa_item_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _emp uuid := NEW.empresa_id;
BEGIN
  IF _emp IS NULL THEN
    RAISE EXCEPTION 'empresa_id obrigatório';
  END IF;
  IF NEW.etapa_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.obra_etapas e WHERE e.id = NEW.etapa_id AND e.empresa_id = _emp) THEN
      RAISE EXCEPTION 'Etapa não pertence à sua empresa';
    END IF;
  END IF;
  IF NEW.orcamento_item_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.orcamento_itens i WHERE i.id = NEW.orcamento_item_id AND i.empresa_id = _emp) THEN
      RAISE EXCEPTION 'Item de orçamento não pertence à sua empresa';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fn_valida_etapa_item_tenant() FROM anon, public, authenticated;

CREATE TRIGGER trg_lanc_etapa_tenant BEFORE INSERT OR UPDATE OF etapa_id, orcamento_item_id ON public.lancamentos_financeiros
FOR EACH ROW EXECUTE FUNCTION public.fn_valida_etapa_item_tenant();
CREATE TRIGGER trg_mat_etapa_tenant BEFORE INSERT OR UPDATE OF etapa_id, orcamento_item_id ON public.materiais_obra
FOR EACH ROW EXECUTE FUNCTION public.fn_valida_etapa_item_tenant();
CREATE TRIGGER trg_cartao_etapa_tenant BEFORE INSERT OR UPDATE OF etapa_id, orcamento_item_id ON public.cartao_despesas
FOR EACH ROW EXECUTE FUNCTION public.fn_valida_etapa_item_tenant();
CREATE TRIGGER trg_contr_etapa_tenant BEFORE INSERT OR UPDATE OF etapa_id, orcamento_item_id ON public.contratacoes_terceirizado
FOR EACH ROW EXECUTE FUNCTION public.fn_valida_etapa_item_tenant();

CREATE OR REPLACE FUNCTION public.fn_valida_etapa_orcamento_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.etapa_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.obra_etapas e WHERE e.id = NEW.etapa_id AND e.empresa_id = NEW.empresa_id) THEN
      RAISE EXCEPTION 'Etapa não pertence à sua empresa';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fn_valida_etapa_orcamento_item() FROM anon, public, authenticated;

CREATE TRIGGER trg_orc_item_etapa_tenant BEFORE INSERT OR UPDATE OF etapa_id ON public.orcamento_itens
FOR EACH ROW EXECUTE FUNCTION public.fn_valida_etapa_orcamento_item();

-- ============ 4. RELATÓRIO ORÇADO x REALIZADO ============
CREATE OR REPLACE FUNCTION public.get_orcado_realizado(_obra_id uuid, _inicio date DEFAULT NULL, _fim date DEFAULT NULL)
RETURNS TABLE(
  etapa_id uuid, etapa_nome text, item_id uuid, item_descricao text,
  quantidade_orcada numeric, valor_orcado numeric, comprometido numeric, realizado numeric,
  saldo numeric, pct_consumido numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _emp uuid := get_user_empresa_id();
BEGIN
  IF _emp IS NULL THEN RAISE EXCEPTION 'Empresa não identificada'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.obras o WHERE o.id = _obra_id AND o.empresa_id = _emp) THEN
    RAISE EXCEPTION 'Obra não encontrada';
  END IF;
  IF NOT (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(), 'obras'::app_modulo, 'view'::app_acao)) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  RETURN QUERY
  WITH orc AS (
    SELECT i.etapa_id AS e_id, i.id AS i_id, i.descricao AS i_desc,
           coalesce(i.quantidade,0) AS qtd, coalesce(i.subtotal,0) AS valor
    FROM public.orcamento_itens i
    JOIN public.orcamentos o ON o.id = i.orcamento_id
    WHERE i.empresa_id = _emp AND o.empresa_id = _emp
      AND o.obra_id = _obra_id AND o.status = 'aprovado'
  ),
  raz AS (
    SELECT l.etapa_id AS e_id, l.orcamento_item_id AS i_id,
           sum(CASE WHEN l.status = 'realizado' THEN l.valor ELSE 0 END) AS realizado,
           sum(CASE WHEN l.status = 'previsto' THEN l.valor ELSE 0 END) AS comprometido
    FROM public.lancamentos_financeiros l
    WHERE l.empresa_id = _emp AND l.obra_id = _obra_id AND l.tipo = 'despesa'
      AND (_inicio IS NULL OR coalesce(l.data_realizado, l.data_vencimento, l.data_competencia) >= _inicio)
      AND (_fim IS NULL OR coalesce(l.data_realizado, l.data_vencimento, l.data_competencia) <= _fim)
    GROUP BY l.etapa_id, l.orcamento_item_id
  ),
  chaves AS (
    SELECT e_id, i_id FROM orc
    UNION
    SELECT e_id, i_id FROM raz
  )
  SELECT
    k.e_id,
    coalesce(et.nome, 'Sem etapa') AS etapa_nome,
    k.i_id,
    coalesce(oi.i_desc, 'Sem item') AS item_descricao,
    coalesce(oi.qtd, 0),
    coalesce(oi.valor, 0),
    coalesce(r.comprometido, 0),
    coalesce(r.realizado, 0),
    coalesce(oi.valor, 0) - coalesce(r.comprometido, 0) - coalesce(r.realizado, 0),
    CASE WHEN coalesce(oi.valor,0) > 0
      THEN ((coalesce(r.comprometido,0) + coalesce(r.realizado,0)) / oi.valor) * 100
      ELSE NULL END
  FROM chaves k
  LEFT JOIN orc oi ON oi.i_id IS NOT DISTINCT FROM k.i_id AND oi.e_id IS NOT DISTINCT FROM k.e_id
  LEFT JOIN raz r ON r.i_id IS NOT DISTINCT FROM k.i_id AND r.e_id IS NOT DISTINCT FROM k.e_id
  LEFT JOIN public.obra_etapas et ON et.id = k.e_id AND et.empresa_id = _emp
  ORDER BY (k.e_id IS NULL), coalesce(et.ordem, 9999), etapa_nome, item_descricao;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_orcado_realizado(uuid, date, date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_orcado_realizado(uuid, date, date) TO authenticated;

-- ============ 5. CURVA S ============
CREATE OR REPLACE FUNCTION public.get_curva_s(_obra_id uuid)
RETURNS TABLE(mes date, previsto numeric, realizado numeric, previsto_acum numeric, realizado_acum numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _emp uuid := get_user_empresa_id();
BEGIN
  IF _emp IS NULL THEN RAISE EXCEPTION 'Empresa não identificada'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.obras o WHERE o.id = _obra_id AND o.empresa_id = _emp) THEN
    RAISE EXCEPTION 'Obra não encontrada';
  END IF;
  IF NOT (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(), 'obras'::app_modulo, 'view'::app_acao)) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  RETURN QUERY
  WITH prev AS (
    SELECT date_trunc('month', c.mes)::date AS m, sum(c.valor_previsto) AS v
    FROM public.cronograma_etapas c
    WHERE c.empresa_id = _emp AND c.obra_id = _obra_id
    GROUP BY 1
  ),
  real AS (
    SELECT date_trunc('month', coalesce(l.data_realizado, l.data_competencia))::date AS m, sum(l.valor) AS v
    FROM public.lancamentos_financeiros l
    WHERE l.empresa_id = _emp AND l.obra_id = _obra_id AND l.tipo = 'despesa' AND l.status = 'realizado'
    GROUP BY 1
  ),
  meses AS (
    SELECT m FROM prev UNION SELECT m FROM real
  )
  SELECT x.m, x.p, x.r,
         sum(x.p) OVER (ORDER BY x.m),
         sum(x.r) OVER (ORDER BY x.m)
  FROM (
    SELECT ms.m, coalesce(prev.v, 0) AS p, coalesce(real.v, 0) AS r
    FROM meses ms
    LEFT JOIN prev ON prev.m = ms.m
    LEFT JOIN real ON real.m = ms.m
  ) x
  ORDER BY x.m;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_curva_s(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_curva_s(uuid) TO authenticated;

-- ============ 6. CURVA ABC ============
CREATE OR REPLACE FUNCTION public.get_curva_abc(_obra_id uuid DEFAULT NULL, _inicio date DEFAULT NULL, _fim date DEFAULT NULL)
RETURNS TABLE(descricao text, valor numeric, pct numeric, pct_acumulado numeric, classe text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _emp uuid := get_user_empresa_id();
BEGIN
  IF _emp IS NULL THEN RAISE EXCEPTION 'Empresa não identificada'; END IF;
  IF _obra_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.obras o WHERE o.id = _obra_id AND o.empresa_id = _emp) THEN
    RAISE EXCEPTION 'Obra não encontrada';
  END IF;
  IF NOT (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(), 'financeiro'::app_modulo, 'view'::app_acao)
          OR has_permission(auth.uid(), 'obras'::app_modulo, 'view'::app_acao)) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT coalesce(oi.descricao, cat.nome, l.descricao, 'Sem descrição') AS d, sum(l.valor) AS v
    FROM public.lancamentos_financeiros l
    LEFT JOIN public.orcamento_itens oi ON oi.id = l.orcamento_item_id AND oi.empresa_id = _emp
    LEFT JOIN public.categorias_financeiras cat ON cat.id = l.categoria_id AND cat.empresa_id = _emp
    WHERE l.empresa_id = _emp AND l.tipo = 'despesa' AND l.status = 'realizado'
      AND (_obra_id IS NULL OR l.obra_id = _obra_id)
      AND (_inicio IS NULL OR coalesce(l.data_realizado, l.data_competencia) >= _inicio)
      AND (_fim IS NULL OR coalesce(l.data_realizado, l.data_competencia) <= _fim)
    GROUP BY 1
  ),
  tot AS (SELECT nullif(sum(v), 0) AS t FROM base),
  ord AS (
    SELECT b.d, b.v, (b.v / t.t) * 100 AS p,
           (sum(b.v) OVER (ORDER BY b.v DESC, b.d) / t.t) * 100 AS pa
    FROM base b CROSS JOIN tot t
    WHERE t.t IS NOT NULL
  )
  SELECT o.d, o.v, o.p, o.pa,
         CASE WHEN o.pa <= 80 THEN 'A' WHEN o.pa <= 95 THEN 'B' ELSE 'C' END
  FROM ord o
  ORDER BY o.v DESC;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_curva_abc(uuid, date, date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_curva_abc(uuid, date, date) TO authenticated;

-- ============ 7. AVANÇO POR OBRA (DASHBOARD) ============
CREATE OR REPLACE FUNCTION public.get_obras_avanco()
RETURNS TABLE(obra_id uuid, codigo_chamado text, descricao text, previsto_total numeric, previsto_ate_hoje numeric, realizado numeric, pct_fisico_previsto numeric, pct_financeiro_realizado numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _emp uuid := get_user_empresa_id();
BEGIN
  IF _emp IS NULL THEN RAISE EXCEPTION 'Empresa não identificada'; END IF;
  IF NOT (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(), 'dashboard'::app_modulo, 'view'::app_acao)
          OR has_permission(auth.uid(), 'obras'::app_modulo, 'view'::app_acao)) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  RETURN QUERY
  WITH prev AS (
    SELECT c.obra_id AS oid,
           sum(c.valor_previsto) AS total,
           sum(CASE WHEN c.mes <= date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo')::date)::date THEN c.valor_previsto ELSE 0 END) AS ate_hoje
    FROM public.cronograma_etapas c
    WHERE c.empresa_id = _emp
    GROUP BY c.obra_id
  ),
  real AS (
    SELECT l.obra_id AS oid, sum(l.valor) AS v
    FROM public.lancamentos_financeiros l
    WHERE l.empresa_id = _emp AND l.tipo = 'despesa' AND l.status = 'realizado' AND l.obra_id IS NOT NULL
    GROUP BY l.obra_id
  )
  SELECT o.id, o.codigo_chamado, o.descricao_servico,
         coalesce(p.total, 0), coalesce(p.ate_hoje, 0), coalesce(r.v, 0),
         CASE WHEN coalesce(p.total,0) > 0 THEN (p.ate_hoje / p.total) * 100 ELSE NULL END,
         CASE WHEN coalesce(p.total,0) > 0 THEN (coalesce(r.v,0) / p.total) * 100 ELSE NULL END
  FROM public.obras o
  JOIN prev p ON p.oid = o.id
  LEFT JOIN real r ON r.oid = o.id
  WHERE o.empresa_id = _emp AND coalesce(o.arquivada, false) = false
  ORDER BY o.codigo_chamado;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_obras_avanco() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_obras_avanco() TO authenticated;