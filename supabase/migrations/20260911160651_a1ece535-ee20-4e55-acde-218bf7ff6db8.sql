-- 1) Tabela de pagamentos de recebimento
CREATE TABLE IF NOT EXISTS public.recebimento_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  recebimento_id uuid NOT NULL REFERENCES public.recebimentos(id) ON DELETE CASCADE,
  valor numeric(14,2) NOT NULL CHECK (valor > 0),
  data date NOT NULL DEFAULT CURRENT_DATE,
  forma_pagamento public.forma_pagamento,
  observacao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rec_pag_recebimento ON public.recebimento_pagamentos(recebimento_id);
CREATE INDEX IF NOT EXISTS idx_rec_pag_empresa_data ON public.recebimento_pagamentos(empresa_id, data);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recebimento_pagamentos TO authenticated;
GRANT ALL ON public.recebimento_pagamentos TO service_role;

ALTER TABLE public.recebimento_pagamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rec_pag_sel ON public.recebimento_pagamentos;
CREATE POLICY rec_pag_sel ON public.recebimento_pagamentos FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.tenant_match(empresa_id));
DROP POLICY IF EXISTS rec_pag_ins ON public.recebimento_pagamentos;
CREATE POLICY rec_pag_ins ON public.recebimento_pagamentos FOR INSERT TO authenticated
  WITH CHECK (public.tenant_can_write(empresa_id));
DROP POLICY IF EXISTS rec_pag_upd ON public.recebimento_pagamentos;
CREATE POLICY rec_pag_upd ON public.recebimento_pagamentos FOR UPDATE TO authenticated
  USING (public.tenant_can_write(empresa_id)) WITH CHECK (public.tenant_can_write(empresa_id));
DROP POLICY IF EXISTS rec_pag_del ON public.recebimento_pagamentos;
CREATE POLICY rec_pag_del ON public.recebimento_pagamentos FOR DELETE TO authenticated
  USING (public.tenant_can_write(empresa_id));

DROP TRIGGER IF EXISTS trg_rec_pag_empresa ON public.recebimento_pagamentos;
CREATE TRIGGER trg_rec_pag_empresa BEFORE INSERT ON public.recebimento_pagamentos
FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_from_user();

DROP TRIGGER IF EXISTS trg_rec_pag_updated ON public.recebimento_pagamentos;
CREATE TRIGGER trg_rec_pag_updated BEFORE UPDATE ON public.recebimento_pagamentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Cada pagamento vira um lançamento realizado no razão
CREATE OR REPLACE FUNCTION public.fn_pagamento_to_lancamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rec public.recebimentos%ROWTYPE; v_cat uuid;
BEGIN
  PERFORM set_config('app.sync','on',true);
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lancamentos_financeiros WHERE origem='recebimento_pagamento' AND origem_id=OLD.id;
    RETURN OLD;
  END IF;

  SELECT * INTO v_rec FROM public.recebimentos WHERE id = NEW.recebimento_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recebimento não encontrado'; END IF;
  IF v_rec.empresa_id IS DISTINCT FROM NEW.empresa_id THEN
    RAISE EXCEPTION 'Recebimento de outra empresa';
  END IF;

  SELECT id INTO v_cat FROM public.categorias_financeiras
   WHERE empresa_id=NEW.empresa_id AND grupo='receita_servico' ORDER BY nome LIMIT 1;
  IF v_cat IS NULL THEN
    SELECT id INTO v_cat FROM public.categorias_financeiras
     WHERE empresa_id=NEW.empresa_id AND tipo='receita' ORDER BY nome LIMIT 1;
  END IF;

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
END; $$;

DROP TRIGGER IF EXISTS trg_pagamento_lancamento ON public.recebimento_pagamentos;
CREATE TRIGGER trg_pagamento_lancamento
AFTER INSERT OR UPDATE OR DELETE ON public.recebimento_pagamentos
FOR EACH ROW EXECUTE FUNCTION public.fn_pagamento_to_lancamento();

-- 3) Recalcula valor_recebido/status do recebimento a partir dos pagamentos
CREATE OR REPLACE FUNCTION public.fn_recalc_recebimento_pagamentos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_soma numeric(14,2); v_data date;
BEGIN
  v_id := COALESCE(NEW.recebimento_id, OLD.recebimento_id);
  SELECT COALESCE(SUM(valor),0), MAX(data) INTO v_soma, v_data
    FROM public.recebimento_pagamentos WHERE recebimento_id = v_id;
  UPDATE public.recebimentos
     SET valor_recebido = v_soma, data_recebido = v_data, updated_at = now()
   WHERE id = v_id;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_recalc_recebimento ON public.recebimento_pagamentos;
CREATE TRIGGER trg_recalc_recebimento
AFTER INSERT OR UPDATE OR DELETE ON public.recebimento_pagamentos
FOR EACH ROW EXECUTE FUNCTION public.fn_recalc_recebimento_pagamentos();

-- 4) Recebimento no razão passa a representar apenas o saldo em aberto
CREATE OR REPLACE FUNCTION public.fn_recebimento_to_lancamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cat uuid; v_saldo numeric(14,2);
BEGIN
  PERFORM set_config('app.sync','on',true);
  IF TG_OP='DELETE' THEN
    DELETE FROM public.lancamentos_financeiros
     WHERE origem IN ('recebimento','recebimento_saldo') AND origem_id=OLD.id;
    RETURN OLD;
  END IF;

  SELECT id INTO v_cat FROM public.categorias_financeiras
   WHERE empresa_id=NEW.empresa_id AND grupo='receita_servico' ORDER BY nome LIMIT 1;
  IF v_cat IS NULL THEN
    SELECT id INTO v_cat FROM public.categorias_financeiras
     WHERE empresa_id=NEW.empresa_id AND tipo='receita' ORDER BY nome LIMIT 1;
  END IF;

  DELETE FROM public.lancamentos_financeiros WHERE origem='recebimento_saldo' AND origem_id=NEW.id;
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
    DELETE FROM public.lancamentos_financeiros WHERE origem='recebimento' AND origem_id=NEW.id;
  END IF;
  RETURN NEW;
END; $$;

-- 5) confirmar_recebimento grava um pagamento
CREATE OR REPLACE FUNCTION public.confirmar_recebimento(_id uuid, _valor numeric, _data date DEFAULT CURRENT_DATE)
RETURNS recebimentos LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rec public.recebimentos; v_saldo numeric(14,2);
BEGIN
  SELECT * INTO v_rec FROM public.recebimentos WHERE id=_id;
  IF NOT FOUND OR NOT public.tenant_can_write(v_rec.empresa_id) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  IF COALESCE(_valor,0) <= 0 THEN RAISE EXCEPTION 'Informe um valor recebido maior que zero'; END IF;
  v_saldo := GREATEST(COALESCE(v_rec.valor,0) - COALESCE(v_rec.valor_recebido,0), 0);
  IF v_saldo <= 0 THEN RAISE EXCEPTION 'Este recebimento já está quitado'; END IF;

  INSERT INTO public.recebimento_pagamentos(empresa_id, recebimento_id, valor, data, created_by)
  VALUES (v_rec.empresa_id, _id, LEAST(round(_valor,2), v_saldo), COALESCE(_data, CURRENT_DATE), auth.uid());

  SELECT * INTO v_rec FROM public.recebimentos WHERE id=_id;
  RETURN v_rec;
END; $$;
REVOKE ALL ON FUNCTION public.confirmar_recebimento(uuid,numeric,date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.confirmar_recebimento(uuid,numeric,date) TO authenticated, service_role;

-- 6) Recebimento com pagamento não pode ser excluído
CREATE OR REPLACE FUNCTION public.fn_block_delete_recebimento_pago()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.recebimento_pagamentos WHERE recebimento_id = OLD.id) THEN
    RAISE EXCEPTION 'Este recebimento tem pagamentos registrados. Estorne os pagamentos antes de excluir.';
  END IF;
  RETURN OLD;
END; $$;
DROP TRIGGER IF EXISTS trg_block_delete_recebimento ON public.recebimentos;
CREATE TRIGGER trg_block_delete_recebimento BEFORE DELETE ON public.recebimentos
FOR EACH ROW EXECUTE FUNCTION public.fn_block_delete_recebimento_pago();

-- 7) Migração dos recebimentos já pagos
INSERT INTO public.recebimento_pagamentos (empresa_id, recebimento_id, valor, data)
SELECT r.empresa_id, r.id, round(LEAST(r.valor_recebido, r.valor),2),
       COALESCE(r.data_recebido, r.data_prevista, CURRENT_DATE)
  FROM public.recebimentos r
 WHERE COALESCE(r.valor_recebido,0) > 0
   AND NOT EXISTS (SELECT 1 FROM public.recebimento_pagamentos p WHERE p.recebimento_id = r.id);

-- garante que os recebimentos sem pagamento também recalculem o razão
UPDATE public.recebimentos SET updated_at = now() WHERE COALESCE(valor_recebido,0) = 0;

-- 8) Fluxo de caixa: saldo acumulado a partir da data do saldo inicial
CREATE OR REPLACE FUNCTION public.get_fluxo_caixa_mensal(_empresa_id uuid, _meses_atras integer DEFAULT 6, _meses_frente integer DEFAULT 3)
RETURNS TABLE(mes text, ano integer, mes_num integer, receitas_prev numeric, receitas_real numeric, despesas_prev numeric, despesas_real numeric, saldo_prev numeric, saldo_real numeric, saldo_acumulado numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inicio date := date_trunc('month',CURRENT_DATE-(_meses_atras||' months')::interval)::date;
  v_fim date := date_trunc('month',CURRENT_DATE+(_meses_frente||' months')::interval)::date;
  v_saldo_ini numeric := 0; v_data_ini date; v_abertura numeric := 0;
BEGIN
  IF NOT(public.is_super_admin(auth.uid()) OR _empresa_id=public.get_user_empresa_id()) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  SELECT COALESCE(e.saldo_inicial,0), e.data_saldo_inicial INTO v_saldo_ini, v_data_ini
    FROM empresas e WHERE e.id=_empresa_id;

  -- abertura = saldo inicial + movimento realizado entre a data do saldo inicial e o início da série
  SELECT v_saldo_ini + COALESCE(SUM(CASE WHEN lf.tipo='receita' THEN lf.valor ELSE -lf.valor END),0)
    INTO v_abertura
    FROM lancamentos_financeiros lf
   WHERE lf.empresa_id=_empresa_id AND lf.status='realizado' AND lf.impacto_caixa
     AND COALESCE(lf.data_realizado,lf.data_competencia) < v_inicio
     AND (v_data_ini IS NULL OR COALESCE(lf.data_realizado,lf.data_competencia) >= v_data_ini);

  RETURN QUERY
  WITH serie AS (SELECT generate_series(v_inicio,v_fim,'1 month')::date mes_inicio),
  prev AS (SELECT date_trunc('month',COALESCE(lf.data_vencimento,lf.data_competencia))::date mes_ref,
    SUM(CASE WHEN lf.tipo='receita' THEN lf.valor ELSE 0 END) rec_prev,
    SUM(CASE WHEN lf.tipo='despesa' THEN lf.valor ELSE 0 END) dep_prev
    FROM lancamentos_financeiros lf
   WHERE lf.empresa_id=_empresa_id AND lf.status IN('previsto','realizado') AND lf.impacto_caixa GROUP BY 1),
  realiz AS (SELECT date_trunc('month',COALESCE(lf.data_realizado,lf.data_competencia))::date mes_ref,
    SUM(CASE WHEN lf.tipo='receita' THEN lf.valor ELSE 0 END) rec_real,
    SUM(CASE WHEN lf.tipo='despesa' THEN lf.valor ELSE 0 END) dep_real,
    SUM(CASE WHEN (v_data_ini IS NULL OR COALESCE(lf.data_realizado,lf.data_competencia) >= v_data_ini)
             THEN (CASE WHEN lf.tipo='receita' THEN lf.valor ELSE -lf.valor END) ELSE 0 END) mov_pos
    FROM lancamentos_financeiros lf
   WHERE lf.empresa_id=_empresa_id AND lf.status='realizado' AND lf.impacto_caixa GROUP BY 1),
  base AS (SELECT s.mes_inicio, COALESCE(p.rec_prev,0) rec_prev, COALESCE(r.rec_real,0) rec_real,
    COALESCE(p.dep_prev,0) dep_prev, COALESCE(r.dep_real,0) dep_real, COALESCE(r.mov_pos,0) mov_pos
    FROM serie s LEFT JOIN prev p ON p.mes_ref=s.mes_inicio LEFT JOIN realiz r ON r.mes_ref=s.mes_inicio)
  SELECT to_char(b.mes_inicio,'Mon/YY'), EXTRACT(YEAR FROM b.mes_inicio)::int, EXTRACT(MONTH FROM b.mes_inicio)::int,
    b.rec_prev, b.rec_real, b.dep_prev, b.dep_real, b.rec_prev-b.dep_prev, b.rec_real-b.dep_real,
    CASE WHEN v_data_ini IS NOT NULL
              AND (b.mes_inicio + interval '1 month - 1 day')::date < v_data_ini
         THEN NULL
         ELSE v_abertura + SUM(b.mov_pos) OVER (ORDER BY b.mes_inicio ROWS UNBOUNDED PRECEDING)
    END
  FROM base b ORDER BY b.mes_inicio;
END; $$;

-- 9) verificar_razao com as origens novas
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
    UNION ALL
    SELECT nf.obra_id, 'retencao_nf',
           SUM(nf.ret_inss + nf.ret_iss + nf.ret_irrf + nf.ret_pcc)
      FROM notas_fiscais nf, e WHERE nf.empresa_id = e.eid GROUP BY 1
  ),
  razao AS (
    SELECT lf.obra_id,
           CASE WHEN lf.origem IN ('recebimento','recebimento_saldo','recebimento_pagamento')
                THEN 'recebimento' ELSE lf.origem END AS origem,
           SUM(lf.valor) AS total
      FROM lancamentos_financeiros lf, e
     WHERE lf.empresa_id = e.eid AND lf.origem IS NOT NULL
     GROUP BY 1,2
  )
  SELECT COALESCE(o.obra_id, r.obra_id), COALESCE(o.origem, r.origem),
         COALESCE(o.total,0), COALESCE(r.total,0), COALESCE(o.total,0) - COALESCE(r.total,0)
    FROM origem_vals o
    FULL JOIN razao r ON r.obra_id IS NOT DISTINCT FROM o.obra_id AND r.origem = o.origem;
$$;

-- 10) Trigger que faltava para recalcular o orçamento no desconto global
DROP TRIGGER IF EXISTS trg_recalc_desc_global ON public.orcamentos;
CREATE TRIGGER trg_recalc_desc_global
BEFORE UPDATE OF desconto_global_pct ON public.orcamentos
FOR EACH ROW EXECUTE FUNCTION public.recalc_totais_apos_desc_global();