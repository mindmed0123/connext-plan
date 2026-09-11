
-- ============ 1. Cartão: vencimento da fatura + pagamento ============
ALTER TABLE public.cartao_despesas
  ADD COLUMN IF NOT EXISTS fatura_vencimento date,
  ADD COLUMN IF NOT EXISTS fatura_paga boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fatura_paga_em date;

CREATE OR REPLACE FUNCTION public.calc_fatura_vencimento(_data_compra date, _dia_fech integer, _dia_venc integer)
RETURNS date LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _data_compra IS NULL OR _dia_fech IS NULL OR _dia_venc IS NULL THEN NULL
    ELSE (
      SELECT (mes_venc + (LEAST(_dia_venc, EXTRACT(day FROM (mes_venc + interval '1 month - 1 day'))::int) - 1))
      FROM (
        SELECT ((CASE WHEN EXTRACT(day FROM _data_compra)::int < _dia_fech
                      THEN date_trunc('month', _data_compra)
                      ELSE date_trunc('month', _data_compra) + interval '1 month' END)
                + interval '1 month')::date AS mes_venc
      ) x
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.fn_cartao_set_fatura()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_f int; v_v int;
BEGIN
  SELECT dia_fechamento, dia_vencimento INTO v_f, v_v
    FROM public.cartoes_credito WHERE id = NEW.cartao_id;
  NEW.fatura_vencimento := COALESCE(public.calc_fatura_vencimento(NEW.data_compra, v_f, v_v), NEW.data_compra);
  IF NOT NEW.fatura_paga THEN NEW.fatura_paga_em := NULL; END IF;
  IF NEW.fatura_paga AND NEW.fatura_paga_em IS NULL THEN
    NEW.fatura_paga_em := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_cartao_set_fatura ON public.cartao_despesas;
CREATE TRIGGER trg_cartao_set_fatura
BEFORE INSERT OR UPDATE ON public.cartao_despesas
FOR EACH ROW EXECUTE FUNCTION public.fn_cartao_set_fatura();

-- preenche faturas existentes; faturas já vencidas contam como pagas
UPDATE public.cartao_despesas cd
SET fatura_vencimento = COALESCE(public.calc_fatura_vencimento(cd.data_compra, c.dia_fechamento, c.dia_vencimento), cd.data_compra)
FROM public.cartoes_credito c
WHERE c.id = cd.cartao_id AND cd.fatura_vencimento IS NULL;

UPDATE public.cartao_despesas
SET fatura_vencimento = data_compra
WHERE fatura_vencimento IS NULL;

UPDATE public.cartao_despesas
SET fatura_paga = true,
    fatura_paga_em = COALESCE(fatura_paga_em, fatura_vencimento)
WHERE fatura_paga = false
  AND fatura_vencimento <= (now() AT TIME ZONE 'America/Sao_Paulo')::date;

-- ============ 2. Triggers de sincronização com o razão ============
CREATE OR REPLACE FUNCTION public.fn_material_to_lancamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cat uuid;
BEGIN
  PERFORM set_config('app.sync', 'on', true);
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lancamentos_financeiros WHERE origem = 'material' AND origem_id = OLD.id;
    RETURN OLD;
  END IF;

  SELECT id INTO v_cat FROM public.categorias_financeiras
    WHERE empresa_id = NEW.empresa_id AND grupo = 'custo_material' ORDER BY nome LIMIT 1;
  IF v_cat IS NULL THEN
    SELECT id INTO v_cat FROM public.categorias_financeiras
      WHERE empresa_id = NEW.empresa_id AND tipo = 'despesa' ORDER BY nome LIMIT 1;
  END IF;

  INSERT INTO public.lancamentos_financeiros (
    empresa_id, obra_id, categoria_id, tipo, status, descricao, valor,
    data_competencia, data_vencimento, data_realizado, forma_pagamento, fornecedor_nome, origem, origem_id
  ) VALUES (
    NEW.empresa_id, NEW.obra_id, v_cat, 'despesa'::public.lancamento_tipo, 'realizado'::public.lancamento_status,
    COALESCE(NULLIF(NEW.descricao, ''), 'Material'), NEW.valor_total,
    NEW.data_compra, NEW.data_compra, NEW.data_compra, NEW.forma_pagamento, NEW.fornecedor,
    'material', NEW.id
  )
  ON CONFLICT (origem, origem_id) DO UPDATE SET
    empresa_id = EXCLUDED.empresa_id, obra_id = EXCLUDED.obra_id, categoria_id = EXCLUDED.categoria_id,
    status = EXCLUDED.status, descricao = EXCLUDED.descricao, valor = EXCLUDED.valor,
    data_competencia = EXCLUDED.data_competencia, data_vencimento = EXCLUDED.data_vencimento,
    data_realizado = EXCLUDED.data_realizado, forma_pagamento = EXCLUDED.forma_pagamento,
    fornecedor_nome = EXCLUDED.fornecedor_nome, updated_at = now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_material_to_lancamento ON public.materiais_obra;
CREATE TRIGGER trg_material_to_lancamento
AFTER INSERT OR UPDATE OR DELETE ON public.materiais_obra
FOR EACH ROW EXECUTE FUNCTION public.fn_material_to_lancamento();

CREATE OR REPLACE FUNCTION public.fn_cartao_to_lancamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cat uuid; v_apelido text;
BEGIN
  PERFORM set_config('app.sync', 'on', true);
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lancamentos_financeiros WHERE origem = 'cartao' AND origem_id = OLD.id;
    RETURN OLD;
  END IF;

  SELECT id INTO v_cat FROM public.categorias_financeiras
    WHERE empresa_id = NEW.empresa_id AND grupo = 'custo_outro' ORDER BY nome LIMIT 1;
  IF v_cat IS NULL THEN
    SELECT id INTO v_cat FROM public.categorias_financeiras
      WHERE empresa_id = NEW.empresa_id AND tipo = 'despesa' ORDER BY nome LIMIT 1;
  END IF;

  SELECT apelido INTO v_apelido FROM public.cartoes_credito WHERE id = NEW.cartao_id;

  INSERT INTO public.lancamentos_financeiros (
    empresa_id, obra_id, categoria_id, tipo, status, descricao, valor,
    data_competencia, data_vencimento, data_realizado, fornecedor_nome, origem, origem_id
  ) VALUES (
    NEW.empresa_id, NEW.obra_id, v_cat, 'despesa'::public.lancamento_tipo,
    (CASE WHEN NEW.fatura_paga THEN 'realizado' ELSE 'previsto' END)::public.lancamento_status,
    COALESCE(NULLIF(NEW.descricao, ''), NEW.categoria, 'Despesa de cartão'), NEW.valor,
    NEW.data_compra, COALESCE(NEW.fatura_vencimento, NEW.data_compra),
    CASE WHEN NEW.fatura_paga THEN COALESCE(NEW.fatura_paga_em, NEW.fatura_vencimento, NEW.data_compra) END,
    COALESCE(v_apelido, 'Cartão'),
    'cartao', NEW.id
  )
  ON CONFLICT (origem, origem_id) DO UPDATE SET
    empresa_id = EXCLUDED.empresa_id, obra_id = EXCLUDED.obra_id, categoria_id = EXCLUDED.categoria_id,
    status = EXCLUDED.status, descricao = EXCLUDED.descricao, valor = EXCLUDED.valor,
    data_competencia = EXCLUDED.data_competencia, data_vencimento = EXCLUDED.data_vencimento,
    data_realizado = EXCLUDED.data_realizado, fornecedor_nome = EXCLUDED.fornecedor_nome, updated_at = now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_cartao_to_lancamento ON public.cartao_despesas;
CREATE TRIGGER trg_cartao_to_lancamento
AFTER INSERT OR UPDATE OR DELETE ON public.cartao_despesas
FOR EACH ROW EXECUTE FUNCTION public.fn_cartao_to_lancamento();

-- ============ 3. Pagar fatura ============
CREATE OR REPLACE FUNCTION public.pagar_fatura_cartao(_cartao_id uuid, _vencimento date, _data_pagamento date DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid; v_n integer;
BEGIN
  SELECT empresa_id INTO v_emp FROM public.cartoes_credito WHERE id = _cartao_id;
  IF v_emp IS NULL OR NOT (public.is_super_admin(auth.uid()) OR v_emp = public.get_user_empresa_id()) THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;
  UPDATE public.cartao_despesas
     SET fatura_paga = true,
         fatura_paga_em = COALESCE(_data_pagamento, (now() AT TIME ZONE 'America/Sao_Paulo')::date)
   WHERE cartao_id = _cartao_id AND fatura_vencimento = _vencimento;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END; $$;

CREATE OR REPLACE FUNCTION public.reabrir_fatura_cartao(_cartao_id uuid, _vencimento date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid; v_n integer;
BEGIN
  SELECT empresa_id INTO v_emp FROM public.cartoes_credito WHERE id = _cartao_id;
  IF v_emp IS NULL OR NOT (public.is_super_admin(auth.uid()) OR v_emp = public.get_user_empresa_id()) THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;
  UPDATE public.cartao_despesas
     SET fatura_paga = false, fatura_paga_em = NULL
   WHERE cartao_id = _cartao_id AND fatura_vencimento = _vencimento;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END; $$;

REVOKE EXECUTE ON FUNCTION public.pagar_fatura_cartao(uuid, date, date) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reabrir_fatura_cartao(uuid, date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.pagar_fatura_cartao(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reabrir_fatura_cartao(uuid, date) TO authenticated;

-- ============ 4. Backfill ============
-- recebimentos
INSERT INTO public.lancamentos_financeiros (
  empresa_id, obra_id, categoria_id, tipo, status, descricao, valor,
  data_competencia, data_vencimento, data_realizado, origem, origem_id)
SELECT r.empresa_id, r.obra_id,
  (SELECT id FROM public.categorias_financeiras c WHERE c.empresa_id = r.empresa_id AND c.grupo = 'receita_servico' ORDER BY nome LIMIT 1),
  'receita', (CASE WHEN r.status = 'recebido' THEN 'realizado' ELSE 'previsto' END)::public.lancamento_status,
  COALESCE(r.descricao, 'Recebimento de obra'), r.valor,
  COALESCE(r.data_recebido, r.data_prevista, r.created_at::date), r.data_prevista, r.data_recebido,
  'recebimento', r.id
FROM public.recebimentos r
ON CONFLICT (origem, origem_id) DO NOTHING;

-- parcelas de contratação
INSERT INTO public.lancamentos_financeiros (
  empresa_id, obra_id, categoria_id, tipo, status, descricao, valor,
  data_competencia, data_vencimento, data_realizado, forma_pagamento, origem, origem_id)
SELECT COALESCE(ct.empresa_id, pp.empresa_id), ct.obra_id,
  (SELECT id FROM public.categorias_financeiras c WHERE c.empresa_id = COALESCE(ct.empresa_id, pp.empresa_id) AND c.grupo = 'custo_subcontratado' ORDER BY nome LIMIT 1),
  'despesa', (CASE WHEN pp.status = 'pago' THEN 'realizado' ELSE 'previsto' END)::public.lancamento_status,
  'Parcela ' || pp.numero_parcela || ' - contratação', pp.valor,
  COALESCE(pp.data_pagamento, pp.data_prevista, pp.created_at::date), pp.data_prevista, pp.data_pagamento,
  pp.forma_pagamento, 'parcela_pagamento', pp.id
FROM public.parcelas_pagamento pp
JOIN public.contratacoes_terceirizado ct ON ct.id = pp.contratacao_id
ON CONFLICT (origem, origem_id) DO NOTHING;

-- materiais
INSERT INTO public.lancamentos_financeiros (
  empresa_id, obra_id, categoria_id, tipo, status, descricao, valor,
  data_competencia, data_vencimento, data_realizado, forma_pagamento, fornecedor_nome, origem, origem_id)
SELECT m.empresa_id, m.obra_id,
  (SELECT id FROM public.categorias_financeiras c WHERE c.empresa_id = m.empresa_id AND c.grupo = 'custo_material' ORDER BY nome LIMIT 1),
  'despesa', 'realizado', COALESCE(NULLIF(m.descricao, ''), 'Material'), m.valor_total,
  m.data_compra, m.data_compra, m.data_compra, m.forma_pagamento, m.fornecedor, 'material', m.id
FROM public.materiais_obra m
ON CONFLICT (origem, origem_id) DO NOTHING;

-- cartão
INSERT INTO public.lancamentos_financeiros (
  empresa_id, obra_id, categoria_id, tipo, status, descricao, valor,
  data_competencia, data_vencimento, data_realizado, fornecedor_nome, origem, origem_id)
SELECT cd.empresa_id, cd.obra_id,
  (SELECT id FROM public.categorias_financeiras c WHERE c.empresa_id = cd.empresa_id AND c.grupo = 'custo_outro' ORDER BY nome LIMIT 1),
  'despesa', (CASE WHEN cd.fatura_paga THEN 'realizado' ELSE 'previsto' END)::public.lancamento_status,
  COALESCE(NULLIF(cd.descricao, ''), cd.categoria, 'Despesa de cartão'), cd.valor,
  cd.data_compra, COALESCE(cd.fatura_vencimento, cd.data_compra),
  CASE WHEN cd.fatura_paga THEN COALESCE(cd.fatura_paga_em, cd.fatura_vencimento, cd.data_compra) END,
  (SELECT apelido FROM public.cartoes_credito cc WHERE cc.id = cd.cartao_id),
  'cartao', cd.id
FROM public.cartao_despesas cd
ON CONFLICT (origem, origem_id) DO NOTHING;

-- ============ 5. Leitura única ============
CREATE OR REPLACE FUNCTION public.get_obra_financeiro_resumo(_obra_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(obra_id uuid, codigo_chamado text, receita_orcada numeric, receita_faturada numeric, receita_recebida numeric, custo_materiais numeric, custo_terceirizados_pago numeric, custo_terceirizados_previsto numeric, custo_cartao numeric, despesas_realizadas numeric, custo_total numeric, saldo numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH e AS (SELECT public.get_user_empresa_id() AS eid),
  base AS (
    SELECT
      o.id,
      o.codigo_chamado,
      COALESCE((SELECT SUM(COALESCE(valor_total, valor_orcamento)) FROM orcamentos WHERE obra_id = o.id AND status = 'aprovado'), 0)
        + COALESCE((SELECT SUM(valor_total) FROM obra_adendos WHERE obra_id = o.id AND status IN ('assinado','em_execucao','concluido')), 0) AS receita_orcada,
      COALESCE((SELECT SUM(valor) FROM notas_fiscais WHERE obra_id = o.id), 0) AS receita_faturada,
      COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id = o.id AND tipo = 'receita' AND status = 'realizado'), 0) AS receita_recebida,
      COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id = o.id AND tipo = 'despesa' AND status = 'realizado' AND origem = 'material'), 0) AS custo_materiais,
      COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id = o.id AND tipo = 'despesa' AND status = 'realizado' AND origem = 'parcela_pagamento'), 0) AS custo_terc_pago,
      COALESCE((SELECT SUM(valor_total) FROM contratacoes_terceirizado WHERE obra_id = o.id AND status_financeiro <> 'cancelado'), 0) AS custo_terc_prev,
      COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id = o.id AND tipo = 'despesa' AND status = 'realizado' AND origem = 'cartao'), 0) AS custo_cartao,
      COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id = o.id AND tipo = 'despesa' AND status = 'realizado' AND COALESCE(origem,'manual') NOT IN ('material','cartao','parcela_pagamento')), 0) AS despesas
    FROM obras o, e
    WHERE o.empresa_id = e.eid AND (_obra_id IS NULL OR o.id = _obra_id)
  )
  SELECT id, codigo_chamado, receita_orcada, receita_faturada, receita_recebida,
         custo_materiais, custo_terc_pago, custo_terc_prev, custo_cartao, despesas,
         custo_materiais + custo_terc_pago + custo_cartao + despesas,
         receita_recebida - (custo_materiais + custo_terc_pago + custo_cartao + despesas)
  FROM base;
$$;

CREATE OR REPLACE FUNCTION public.get_dre_obra(_empresa_id uuid, _obra_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(obra_id uuid, obra_codigo text, receita_contratada numeric, receita_medida numeric, receita_recebida numeric, custo_subcontratado numeric, custo_materiais numeric, custo_total_real numeric, margem_bruta numeric, margem_pct numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR _empresa_id = public.get_user_empresa_id()) THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;
  RETURN QUERY
  WITH base AS (
    SELECT
      o.id,
      o.codigo_chamado,
      COALESCE((SELECT SUM(COALESCE(valor_total, valor_orcamento)) FROM orcamentos WHERE obra_id = o.id AND status = 'aprovado'), 0)
        + COALESCE((SELECT SUM(valor_total) FROM obra_adendos WHERE obra_id = o.id AND status IN ('assinado','em_execucao','concluido')), 0) AS receita_contratada,
      COALESCE((SELECT SUM(valor_medido) FROM medicoes WHERE obra_id = o.id AND status = 'aprovada'), 0) AS receita_medida,
      COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id = o.id AND tipo = 'receita' AND status = 'realizado'), 0) AS receita_recebida,
      COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id = o.id AND tipo = 'despesa' AND status = 'realizado' AND origem = 'parcela_pagamento'), 0) AS custo_subcontratado,
      COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id = o.id AND tipo = 'despesa' AND status = 'realizado' AND origem = 'material'), 0) AS custo_materiais,
      COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id = o.id AND tipo = 'despesa' AND status = 'realizado' AND COALESCE(origem,'manual') NOT IN ('material','parcela_pagamento')), 0) AS outras_despesas,
      o.created_at
    FROM obras o
    WHERE o.empresa_id = _empresa_id AND (_obra_id IS NULL OR o.id = _obra_id)
  )
  SELECT b.id, b.codigo_chamado, b.receita_contratada, b.receita_medida, b.receita_recebida,
         b.custo_subcontratado, b.custo_materiais,
         (b.custo_subcontratado + b.custo_materiais + b.outras_despesas) AS custo_total_real,
         (b.receita_recebida - (b.custo_subcontratado + b.custo_materiais + b.outras_despesas)) AS margem_bruta,
         CASE WHEN b.receita_contratada = 0 THEN 0
              ELSE ROUND(((b.receita_recebida - (b.custo_subcontratado + b.custo_materiais + b.outras_despesas))
                   / NULLIF(b.receita_contratada, 0)) * 100, 2) END AS margem_pct
  FROM base b
  ORDER BY b.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.get_financeiro_kpis(_inicio date DEFAULT NULL::date, _fim date DEFAULT NULL::date)
RETURNS TABLE(receita_realizada numeric, despesa_realizada numeric, receita_prevista numeric, despesa_prevista numeric, vencidos_qtd integer, vencidos_valor numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH e AS (SELECT public.get_user_empresa_id() AS eid),
  hoje AS (SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS d),
  lanc AS (
    SELECT lf.tipo, lf.status, lf.valor, lf.data_vencimento,
           COALESCE(lf.data_realizado, lf.data_vencimento, lf.data_competencia) AS dt
    FROM lancamentos_financeiros lf, e WHERE lf.empresa_id = e.eid
  )
  SELECT
    COALESCE((SELECT SUM(valor) FROM lanc WHERE tipo = 'receita' AND status = 'realizado'
              AND (_inicio IS NULL OR dt >= _inicio) AND (_fim IS NULL OR dt <= _fim)), 0),
    COALESCE((SELECT SUM(valor) FROM lanc WHERE tipo = 'despesa' AND status = 'realizado'
              AND (_inicio IS NULL OR dt >= _inicio) AND (_fim IS NULL OR dt <= _fim)), 0),
    COALESCE((SELECT SUM(valor) FROM lanc WHERE tipo = 'receita' AND status = 'previsto'
              AND (_inicio IS NULL OR dt >= _inicio) AND (_fim IS NULL OR dt <= _fim)), 0),
    COALESCE((SELECT SUM(valor) FROM lanc WHERE tipo = 'despesa' AND status = 'previsto'
              AND (_inicio IS NULL OR dt >= _inicio) AND (_fim IS NULL OR dt <= _fim)), 0),
    COALESCE((SELECT COUNT(*) FROM lanc, hoje WHERE lanc.tipo = 'despesa' AND lanc.status = 'previsto'
              AND lanc.data_vencimento < hoje.d), 0)::int,
    COALESCE((SELECT SUM(lanc.valor) FROM lanc, hoje WHERE lanc.tipo = 'despesa' AND lanc.status = 'previsto'
              AND lanc.data_vencimento < hoje.d), 0);
$$;

CREATE OR REPLACE FUNCTION public.get_fluxo_caixa_mensal(_empresa_id uuid, _meses_atras integer DEFAULT 6, _meses_frente integer DEFAULT 3)
RETURNS TABLE(mes text, ano integer, mes_num integer, receitas_prev numeric, receitas_real numeric, despesas_prev numeric, despesas_real numeric, saldo_prev numeric, saldo_real numeric, saldo_acumulado numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inicio date := date_trunc('month', CURRENT_DATE - (_meses_atras || ' months')::interval)::date;
  v_fim date := date_trunc('month', CURRENT_DATE + (_meses_frente || ' months')::interval)::date;
  v_saldo_ini numeric := 0;
  v_data_ini date;
  v_abertura numeric := 0;
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR _empresa_id = public.get_user_empresa_id()) THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;

  SELECT COALESCE(e.saldo_inicial, 0), e.data_saldo_inicial
    INTO v_saldo_ini, v_data_ini
    FROM public.empresas e WHERE e.id = _empresa_id;

  -- saldo de abertura = saldo inicial + movimento realizado entre a data do saldo e o início da série
  SELECT v_saldo_ini + COALESCE(SUM(CASE WHEN lf.tipo = 'receita' THEN lf.valor ELSE -lf.valor END), 0)
    INTO v_abertura
    FROM public.lancamentos_financeiros lf
   WHERE lf.empresa_id = _empresa_id
     AND lf.status = 'realizado'
     AND COALESCE(lf.data_realizado, lf.data_competencia) < v_inicio
     AND (v_data_ini IS NULL OR COALESCE(lf.data_realizado, lf.data_competencia) >= v_data_ini);

  RETURN QUERY
  WITH serie AS (
    SELECT generate_series(v_inicio, v_fim, '1 month'::interval)::date AS mes_inicio
  ),
  prev AS (
    SELECT date_trunc('month', COALESCE(lf.data_vencimento, lf.data_competencia))::date AS mes_ref,
      SUM(CASE WHEN lf.tipo = 'receita' THEN lf.valor ELSE 0 END) AS rec_prev,
      SUM(CASE WHEN lf.tipo = 'despesa' THEN lf.valor ELSE 0 END) AS dep_prev
    FROM public.lancamentos_financeiros lf
    WHERE lf.empresa_id = _empresa_id AND lf.status IN ('previsto','realizado')
    GROUP BY 1
  ),
  realiz AS (
    SELECT date_trunc('month', COALESCE(lf.data_realizado, lf.data_competencia))::date AS mes_ref,
      SUM(CASE WHEN lf.tipo = 'receita' THEN lf.valor ELSE 0 END) AS rec_real,
      SUM(CASE WHEN lf.tipo = 'despesa' THEN lf.valor ELSE 0 END) AS dep_real
    FROM public.lancamentos_financeiros lf
    WHERE lf.empresa_id = _empresa_id AND lf.status = 'realizado'
    GROUP BY 1
  ),
  base AS (
    SELECT s.mes_inicio,
      COALESCE(p.rec_prev, 0) AS rec_prev, COALESCE(r.rec_real, 0) AS rec_real,
      COALESCE(p.dep_prev, 0) AS dep_prev, COALESCE(r.dep_real, 0) AS dep_real
    FROM serie s
    LEFT JOIN prev p ON p.mes_ref = s.mes_inicio
    LEFT JOIN realiz r ON r.mes_ref = s.mes_inicio
  )
  SELECT to_char(b.mes_inicio, 'Mon/YY'),
    EXTRACT(YEAR FROM b.mes_inicio)::integer,
    EXTRACT(MONTH FROM b.mes_inicio)::integer,
    b.rec_prev, b.rec_real, b.dep_prev, b.dep_real,
    b.rec_prev - b.dep_prev,
    b.rec_real - b.dep_real,
    v_abertura + SUM(b.rec_real - b.dep_real) OVER (ORDER BY b.mes_inicio ROWS UNBOUNDED PRECEDING)
  FROM base b
  ORDER BY b.mes_inicio;
END; $$;

-- ============ 6. Verificação do razão ============
CREATE OR REPLACE FUNCTION public.verificar_razao()
RETURNS TABLE(obra_id uuid, origem text, soma_origem numeric, soma_razao numeric, diferenca numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH e AS (SELECT public.get_user_empresa_id() AS eid),
  origem_vals AS (
    SELECT r.obra_id, 'recebimento'::text AS origem, SUM(r.valor) AS total
      FROM recebimentos r, e WHERE r.empresa_id = e.eid GROUP BY 1
    UNION ALL
    SELECT ct.obra_id, 'parcela_pagamento', SUM(pp.valor)
      FROM parcelas_pagamento pp JOIN contratacoes_terceirizado ct ON ct.id = pp.contratacao_id, e
     WHERE ct.empresa_id = e.eid GROUP BY 1
    UNION ALL
    SELECT m.obra_id, 'material', SUM(m.valor_total)
      FROM materiais_obra m, e WHERE m.empresa_id = e.eid GROUP BY 1
    UNION ALL
    SELECT cd.obra_id, 'cartao', SUM(cd.valor)
      FROM cartao_despesas cd, e WHERE cd.empresa_id = e.eid GROUP BY 1
  ),
  razao AS (
    SELECT lf.obra_id, lf.origem, SUM(lf.valor) AS total
      FROM lancamentos_financeiros lf, e
     WHERE lf.empresa_id = e.eid AND lf.origem IS NOT NULL
     GROUP BY 1, 2
  )
  SELECT COALESCE(o.obra_id, r.obra_id), COALESCE(o.origem, r.origem),
         COALESCE(o.total, 0), COALESCE(r.total, 0), COALESCE(o.total, 0) - COALESCE(r.total, 0)
    FROM origem_vals o
    FULL JOIN razao r ON r.obra_id IS NOT DISTINCT FROM o.obra_id AND r.origem = o.origem;
$$;

REVOKE EXECUTE ON FUNCTION public.verificar_razao() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.verificar_razao() TO authenticated;
