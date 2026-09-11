
-- 1) KPIs do Financeiro
CREATE OR REPLACE FUNCTION public.get_financeiro_kpis(_inicio date DEFAULT NULL, _fim date DEFAULT NULL)
RETURNS TABLE(
  receita_realizada numeric,
  despesa_realizada numeric,
  receita_prevista numeric,
  despesa_prevista numeric,
  vencidos_qtd integer,
  vencidos_valor numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH e AS (SELECT public.get_user_empresa_id() AS eid),
  hoje AS (SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS d),
  rec AS (
    SELECT r.status, r.valor, COALESCE(r.data_recebido, r.data_prevista) AS dt
    FROM recebimentos r, e WHERE r.empresa_id = e.eid
  ),
  parc AS (
    SELECT pp.status, pp.valor, pp.data_prevista, COALESCE(pp.data_pagamento, pp.data_prevista) AS dt
    FROM parcelas_pagamento pp
    JOIN contratacoes_terceirizado ct ON ct.id = pp.contratacao_id, e
    WHERE ct.empresa_id = e.eid
  ),
  lanc AS (
    SELECT lf.tipo, lf.status, lf.valor, lf.origem, lf.data_vencimento,
           COALESCE(lf.data_realizado, lf.data_competencia) AS dt
    FROM lancamentos_financeiros lf, e WHERE lf.empresa_id = e.eid
  ),
  mat AS (SELECT mo.valor_total AS valor, mo.data_compra AS dt FROM materiais_obra mo, e WHERE mo.empresa_id = e.eid),
  cart AS (SELECT cd.valor, cd.data_compra AS dt FROM cartao_despesas cd, e WHERE cd.empresa_id = e.eid)
  SELECT
    -- receita realizada
    COALESCE((SELECT SUM(valor) FROM rec WHERE status = 'recebido'
              AND (_inicio IS NULL OR dt >= _inicio) AND (_fim IS NULL OR dt <= _fim)), 0)
    + COALESCE((SELECT SUM(valor) FROM lanc WHERE tipo = 'receita' AND status = 'realizado'
              AND COALESCE(origem,'') <> 'recebimento'
              AND (_inicio IS NULL OR dt >= _inicio) AND (_fim IS NULL OR dt <= _fim)), 0),
    -- despesa realizada
    COALESCE((SELECT SUM(valor) FROM parc WHERE status = 'pago'
              AND (_inicio IS NULL OR dt >= _inicio) AND (_fim IS NULL OR dt <= _fim)), 0)
    + COALESCE((SELECT SUM(valor) FROM lanc WHERE tipo = 'despesa' AND status = 'realizado'
              AND COALESCE(origem,'') <> 'parcela_pagamento'
              AND (_inicio IS NULL OR dt >= _inicio) AND (_fim IS NULL OR dt <= _fim)), 0)
    + COALESCE((SELECT SUM(valor) FROM mat WHERE (_inicio IS NULL OR dt >= _inicio) AND (_fim IS NULL OR dt <= _fim)), 0)
    + COALESCE((SELECT SUM(valor) FROM cart WHERE (_inicio IS NULL OR dt >= _inicio) AND (_fim IS NULL OR dt <= _fim)), 0),
    -- receita prevista
    COALESCE((SELECT SUM(valor) FROM rec WHERE status = 'a_receber'
              AND (_inicio IS NULL OR dt >= _inicio) AND (_fim IS NULL OR dt <= _fim)), 0)
    + COALESCE((SELECT SUM(valor) FROM lanc WHERE tipo = 'receita' AND status = 'previsto'
              AND COALESCE(origem,'') <> 'recebimento'
              AND (_inicio IS NULL OR dt >= _inicio) AND (_fim IS NULL OR dt <= _fim)), 0),
    -- despesa prevista
    COALESCE((SELECT SUM(valor) FROM parc WHERE status = 'pendente'
              AND (_inicio IS NULL OR dt >= _inicio) AND (_fim IS NULL OR dt <= _fim)), 0)
    + COALESCE((SELECT SUM(valor) FROM lanc WHERE tipo = 'despesa' AND status = 'previsto'
              AND COALESCE(origem,'') <> 'parcela_pagamento'
              AND (_inicio IS NULL OR dt >= _inicio) AND (_fim IS NULL OR dt <= _fim)), 0),
    -- vencidos (qtd)
    (COALESCE((SELECT COUNT(*) FROM parc, hoje WHERE parc.status = 'pendente' AND parc.data_prevista < hoje.d), 0)
     + COALESCE((SELECT COUNT(*) FROM lanc, hoje WHERE lanc.tipo = 'despesa' AND lanc.status = 'previsto'
                 AND COALESCE(lanc.origem,'') <> 'parcela_pagamento' AND lanc.data_vencimento < hoje.d), 0))::int,
    -- vencidos (valor)
    COALESCE((SELECT SUM(parc.valor) FROM parc, hoje WHERE parc.status = 'pendente' AND parc.data_prevista < hoje.d), 0)
    + COALESCE((SELECT SUM(lanc.valor) FROM lanc, hoje WHERE lanc.tipo = 'despesa' AND lanc.status = 'previsto'
                AND COALESCE(lanc.origem,'') <> 'parcela_pagamento' AND lanc.data_vencimento < hoje.d), 0);
$$;

REVOKE EXECUTE ON FUNCTION public.get_financeiro_kpis(date, date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_financeiro_kpis(date, date) TO authenticated, service_role;

-- 2) DRE consolidada com a mesma regra do resumo por obra
CREATE OR REPLACE FUNCTION public.get_dre_obra(_empresa_id uuid, _obra_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(obra_id uuid, obra_codigo text, receita_contratada numeric, receita_medida numeric, receita_recebida numeric, custo_subcontratado numeric, custo_materiais numeric, custo_total_real numeric, margem_bruta numeric, margem_pct numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR _empresa_id = public.get_user_empresa_id()) THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;
  RETURN QUERY
  WITH base AS (
    SELECT
      o.id,
      o.codigo_chamado,
      COALESCE((SELECT SUM(valor_orcamento) FROM orcamentos WHERE obra_id = o.id AND status = 'aprovado'), 0)
        + COALESCE((SELECT SUM(valor_total) FROM obra_adendos WHERE obra_id = o.id AND status IN ('assinado','em_execucao','concluido')), 0) AS receita_contratada,
      COALESCE((SELECT SUM(valor_medido) FROM medicoes WHERE obra_id = o.id AND status = 'aprovada'), 0) AS receita_medida,
      COALESCE((SELECT SUM(valor) FROM recebimentos WHERE obra_id = o.id AND status = 'recebido'), 0)
        + COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros
                    WHERE obra_id = o.id AND tipo = 'receita' AND status = 'realizado'
                      AND COALESCE(origem,'') <> 'recebimento'), 0) AS receita_recebida,
      COALESCE((SELECT SUM(pp.valor) FROM parcelas_pagamento pp
                JOIN contratacoes_terceirizado ct ON ct.id = pp.contratacao_id
                WHERE ct.obra_id = o.id AND pp.status = 'pago'), 0) AS custo_subcontratado,
      COALESCE((SELECT SUM(valor_total) FROM materiais_obra WHERE obra_id = o.id), 0) AS custo_materiais,
      COALESCE((SELECT SUM(valor) FROM cartao_despesas WHERE obra_id = o.id), 0) AS custo_cartao,
      COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros
                WHERE obra_id = o.id AND tipo = 'despesa' AND status = 'realizado'
                  AND COALESCE(origem,'') <> 'parcela_pagamento'), 0) AS outras_despesas,
      o.created_at
    FROM obras o
    WHERE o.empresa_id = _empresa_id AND (_obra_id IS NULL OR o.id = _obra_id)
  )
  SELECT b.id, b.codigo_chamado, b.receita_contratada, b.receita_medida, b.receita_recebida,
         b.custo_subcontratado, b.custo_materiais,
         (b.custo_subcontratado + b.custo_materiais + b.custo_cartao + b.outras_despesas) AS custo_total_real,
         (b.receita_recebida - (b.custo_subcontratado + b.custo_materiais + b.custo_cartao + b.outras_despesas)) AS margem_bruta,
         CASE WHEN b.receita_contratada = 0 THEN 0
              ELSE ROUND(((b.receita_recebida - (b.custo_subcontratado + b.custo_materiais + b.custo_cartao + b.outras_despesas))
                   / NULLIF(b.receita_contratada, 0)) * 100, 2) END AS margem_pct
  FROM base b
  ORDER BY b.created_at DESC;
END; $function$;

-- 3) Bloqueia edição/exclusão manual de lançamentos gerados automaticamente
CREATE OR REPLACE FUNCTION public.fn_protect_lancamentos_origem()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF COALESCE(current_setting('app.sync', true), '') = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF OLD.origem IS NOT NULL THEN
    RAISE EXCEPTION 'Lançamento gerado automaticamente (%). Altere na origem.', OLD.origem;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_protect_lancamentos_origem ON public.lancamentos_financeiros;
CREATE TRIGGER trg_protect_lancamentos_origem
BEFORE UPDATE OR DELETE ON public.lancamentos_financeiros
FOR EACH ROW EXECUTE FUNCTION public.fn_protect_lancamentos_origem();

-- 4) Categoria correta para recebimentos
CREATE OR REPLACE FUNCTION public.fn_recebimento_to_lancamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_cat uuid;
BEGIN
  PERFORM set_config('app.sync', 'on', true);

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lancamentos_financeiros
      WHERE origem = 'recebimento' AND origem_id = OLD.id;
    RETURN OLD;
  END IF;

  SELECT id INTO v_cat FROM public.categorias_financeiras
    WHERE empresa_id = NEW.empresa_id AND grupo = 'receita_servico'
    ORDER BY nome LIMIT 1;

  IF v_cat IS NULL THEN
    SELECT id INTO v_cat FROM public.categorias_financeiras
      WHERE empresa_id = NEW.empresa_id AND tipo = 'receita'
      ORDER BY nome LIMIT 1;
  END IF;

  INSERT INTO public.lancamentos_financeiros (
    empresa_id, obra_id, categoria_id, tipo, status, descricao, valor,
    data_competencia, data_vencimento, data_realizado, origem, origem_id
  ) VALUES (
    NEW.empresa_id, NEW.obra_id, v_cat, 'receita'::public.lancamento_tipo,
    (CASE WHEN NEW.status = 'recebido' THEN 'realizado' ELSE 'previsto' END)::public.lancamento_status,
    COALESCE(NEW.descricao, 'Recebimento de obra'),
    NEW.valor,
    COALESCE(NEW.data_recebido, NEW.data_prevista, CURRENT_DATE),
    NEW.data_prevista,
    NEW.data_recebido,
    'recebimento', NEW.id
  )
  ON CONFLICT (origem, origem_id) DO UPDATE SET
    obra_id          = EXCLUDED.obra_id,
    categoria_id     = EXCLUDED.categoria_id,
    status           = EXCLUDED.status,
    descricao        = EXCLUDED.descricao,
    valor            = EXCLUDED.valor,
    data_competencia = EXCLUDED.data_competencia,
    data_vencimento  = EXCLUDED.data_vencimento,
    data_realizado   = EXCLUDED.data_realizado,
    updated_at       = now();

  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.fn_parcela_to_lancamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cat uuid;
  v_empresa uuid;
  v_obra uuid;
BEGIN
  PERFORM set_config('app.sync', 'on', true);

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lancamentos_financeiros
      WHERE origem = 'parcela_pagamento' AND origem_id = OLD.id;
    RETURN OLD;
  END IF;

  SELECT ct.empresa_id, ct.obra_id INTO v_empresa, v_obra
    FROM public.contratacoes_terceirizado ct
   WHERE ct.id = NEW.contratacao_id;

  v_empresa := COALESCE(v_empresa, NEW.empresa_id);

  SELECT id INTO v_cat FROM public.categorias_financeiras
    WHERE empresa_id = v_empresa AND grupo = 'custo_subcontratado'
    ORDER BY nome LIMIT 1;

  IF v_cat IS NULL THEN
    SELECT id INTO v_cat FROM public.categorias_financeiras
      WHERE empresa_id = v_empresa AND tipo = 'despesa'
      ORDER BY nome LIMIT 1;
  END IF;

  INSERT INTO public.lancamentos_financeiros (
    empresa_id, obra_id, categoria_id, tipo, status, descricao, valor,
    data_competencia, data_vencimento, data_realizado, forma_pagamento, origem, origem_id
  ) VALUES (
    v_empresa, v_obra, v_cat, 'despesa'::public.lancamento_tipo,
    (CASE WHEN NEW.status = 'pago' THEN 'realizado' ELSE 'previsto' END)::public.lancamento_status,
    'Parcela ' || NEW.numero_parcela || ' - contratação',
    NEW.valor,
    COALESCE(NEW.data_pagamento, NEW.data_prevista, CURRENT_DATE),
    NEW.data_prevista,
    NEW.data_pagamento,
    NEW.forma_pagamento,
    'parcela_pagamento', NEW.id
  )
  ON CONFLICT (origem, origem_id) DO UPDATE SET
    empresa_id       = EXCLUDED.empresa_id,
    obra_id          = EXCLUDED.obra_id,
    categoria_id     = EXCLUDED.categoria_id,
    status           = EXCLUDED.status,
    descricao        = EXCLUDED.descricao,
    valor            = EXCLUDED.valor,
    data_competencia = EXCLUDED.data_competencia,
    data_vencimento  = EXCLUDED.data_vencimento,
    data_realizado   = EXCLUDED.data_realizado,
    forma_pagamento  = EXCLUDED.forma_pagamento,
    updated_at       = now();

  RETURN NEW;
END; $function$;
