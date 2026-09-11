ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS cprb boolean NOT NULL DEFAULT false;

ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS valor_bruto numeric(14,2),
  ADD COLUMN IF NOT EXISTS valor_deducoes_inss numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_inss numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aliquota_inss numeric(5,2) NOT NULL DEFAULT 11,
  ADD COLUMN IF NOT EXISTS ret_inss numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aliquota_iss numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ret_iss numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ret_irrf numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ret_pcc numeric(14,2) NOT NULL DEFAULT 0;

UPDATE public.notas_fiscais SET valor_bruto = valor WHERE valor_bruto IS NULL;
ALTER TABLE public.notas_fiscais ALTER COLUMN valor_bruto SET NOT NULL;
ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS valor_liquido numeric(14,2)
  GENERATED ALWAYS AS (
    round(valor_bruto - ret_inss - ret_iss - ret_irrf - ret_pcc, 2)
  ) STORED;

ALTER TABLE public.recebimentos
  ADD COLUMN IF NOT EXISTS nota_fiscal_id uuid,
  ADD COLUMN IF NOT EXISTS valor_recebido numeric(14,2) NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE public.recebimentos
    ADD CONSTRAINT recebimentos_nota_fiscal_id_fkey
    FOREIGN KEY (nota_fiscal_id) REFERENCES public.notas_fiscais(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS recebimentos_nota_fiscal_uidx
  ON public.recebimentos(nota_fiscal_id) WHERE nota_fiscal_id IS NOT NULL;

ALTER TYPE public.recebimento_status ADD VALUE IF NOT EXISTS 'parcial';

ALTER TABLE public.lancamentos_financeiros
  ADD COLUMN IF NOT EXISTS impacto_caixa boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.fn_nf_normalize_values()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.valor_bruto := round(COALESCE(NEW.valor_bruto, NEW.valor, 0), 2);
  NEW.valor := NEW.valor_bruto;
  NEW.valor_deducoes_inss := round(GREATEST(COALESCE(NEW.valor_deducoes_inss, 0), 0), 2);
  NEW.base_inss := round(GREATEST(COALESCE(NEW.base_inss, NEW.valor_bruto - NEW.valor_deducoes_inss), 0), 2);
  NEW.aliquota_inss := round(GREATEST(COALESCE(NEW.aliquota_inss, 0), 0), 2);
  NEW.aliquota_iss := round(GREATEST(COALESCE(NEW.aliquota_iss, 0), 0), 2);
  NEW.ret_inss := round(GREATEST(COALESCE(NEW.ret_inss, 0), 0), 2);
  NEW.ret_iss := round(GREATEST(COALESCE(NEW.ret_iss, 0), 0), 2);
  NEW.ret_irrf := round(GREATEST(COALESCE(NEW.ret_irrf, 0), 0), 2);
  NEW.ret_pcc := round(GREATEST(COALESCE(NEW.ret_pcc, 0), 0), 2);
  IF NEW.ret_inss + NEW.ret_iss + NEW.ret_irrf + NEW.ret_pcc > NEW.valor_bruto THEN
    RAISE EXCEPTION 'As retenções não podem superar o valor bruto da nota fiscal';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nf_normalize_values ON public.notas_fiscais;
CREATE TRIGGER trg_nf_normalize_values
BEFORE INSERT OR UPDATE OF valor, valor_bruto, valor_deducoes_inss, base_inss, aliquota_inss,
  ret_inss, aliquota_iss, ret_iss, ret_irrf, ret_pcc
ON public.notas_fiscais
FOR EACH ROW EXECUTE FUNCTION public.fn_nf_normalize_values();

CREATE OR REPLACE FUNCTION public.fn_normalize_recebimento_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.valor := round(GREATEST(COALESCE(NEW.valor, 0), 0), 2);
  NEW.valor_recebido := round(GREATEST(COALESCE(NEW.valor_recebido, 0), 0), 2);
  IF NEW.valor_recebido > NEW.valor THEN NEW.valor_recebido := NEW.valor; END IF;
  IF NEW.valor_recebido <= 0 THEN
    NEW.status := 'a_receber'::public.recebimento_status;
    NEW.data_recebido := NULL;
  ELSIF NEW.valor_recebido < NEW.valor THEN
    NEW.status := 'parcial'::public.recebimento_status;
  ELSE
    NEW.status := 'recebido'::public.recebimento_status;
  END IF;
  RETURN NEW;
END;
$$;

UPDATE public.recebimentos
SET valor_recebido = CASE WHEN status = 'recebido' THEN valor ELSE 0 END;

DROP TRIGGER IF EXISTS trg_normalize_recebimento_status ON public.recebimentos;
CREATE TRIGGER trg_normalize_recebimento_status
BEFORE INSERT OR UPDATE OF valor, valor_recebido, status, data_recebido
ON public.recebimentos
FOR EACH ROW EXECUTE FUNCTION public.fn_normalize_recebimento_status();

CREATE OR REPLACE FUNCTION public.fn_recebimento_to_lancamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cat uuid;
  v_pago numeric(14,2);
  v_saldo numeric(14,2);
BEGIN
  PERFORM set_config('app.sync', 'on', true);
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lancamentos_financeiros
    WHERE origem IN ('recebimento','recebimento_saldo') AND origem_id = OLD.id;
    RETURN OLD;
  END IF;

  SELECT id INTO v_cat FROM public.categorias_financeiras
  WHERE empresa_id = NEW.empresa_id AND grupo = 'receita_servico'
  ORDER BY nome LIMIT 1;
  IF v_cat IS NULL THEN
    SELECT id INTO v_cat FROM public.categorias_financeiras
    WHERE empresa_id = NEW.empresa_id AND tipo = 'receita' ORDER BY nome LIMIT 1;
  END IF;

  v_pago := LEAST(COALESCE(NEW.valor_recebido, 0), NEW.valor);
  v_saldo := GREATEST(NEW.valor - v_pago, 0);

  IF v_pago > 0 THEN
    INSERT INTO public.lancamentos_financeiros (
      empresa_id, obra_id, categoria_id, tipo, status, descricao, valor,
      data_competencia, data_vencimento, data_realizado, origem, origem_id, impacto_caixa
    ) VALUES (
      NEW.empresa_id, NEW.obra_id, v_cat, 'receita', 'realizado',
      COALESCE(NEW.descricao, 'Recebimento de obra'), v_pago,
      COALESCE(NEW.data_recebido, NEW.data_prevista, CURRENT_DATE), NEW.data_prevista,
      COALESCE(NEW.data_recebido, CURRENT_DATE), 'recebimento', NEW.id, true
    )
    ON CONFLICT (origem, origem_id) DO UPDATE SET
      obra_id=EXCLUDED.obra_id, categoria_id=EXCLUDED.categoria_id, status=EXCLUDED.status,
      descricao=EXCLUDED.descricao, valor=EXCLUDED.valor, data_competencia=EXCLUDED.data_competencia,
      data_vencimento=EXCLUDED.data_vencimento, data_realizado=EXCLUDED.data_realizado,
      impacto_caixa=true, updated_at=now();
  ELSE
    INSERT INTO public.lancamentos_financeiros (
      empresa_id, obra_id, categoria_id, tipo, status, descricao, valor,
      data_competencia, data_vencimento, data_realizado, origem, origem_id, impacto_caixa
    ) VALUES (
      NEW.empresa_id, NEW.obra_id, v_cat, 'receita', 'previsto',
      COALESCE(NEW.descricao, 'Recebimento de obra'), NEW.valor,
      COALESCE(NEW.data_prevista, CURRENT_DATE), NEW.data_prevista, NULL,
      'recebimento', NEW.id, true
    )
    ON CONFLICT (origem, origem_id) DO UPDATE SET
      obra_id=EXCLUDED.obra_id, categoria_id=EXCLUDED.categoria_id, status=EXCLUDED.status,
      descricao=EXCLUDED.descricao, valor=EXCLUDED.valor, data_competencia=EXCLUDED.data_competencia,
      data_vencimento=EXCLUDED.data_vencimento, data_realizado=NULL,
      impacto_caixa=true, updated_at=now();
  END IF;

  IF v_saldo > 0 AND v_pago > 0 THEN
    INSERT INTO public.lancamentos_financeiros (
      empresa_id, obra_id, categoria_id, tipo, status, descricao, valor,
      data_competencia, data_vencimento, data_realizado, origem, origem_id, impacto_caixa
    ) VALUES (
      NEW.empresa_id, NEW.obra_id, v_cat, 'receita', 'previsto',
      COALESCE(NEW.descricao, 'Recebimento de obra') || ' — saldo', v_saldo,
      COALESCE(NEW.data_prevista, CURRENT_DATE), NEW.data_prevista, NULL,
      'recebimento_saldo', NEW.id, true
    )
    ON CONFLICT (origem, origem_id) DO UPDATE SET
      obra_id=EXCLUDED.obra_id, categoria_id=EXCLUDED.categoria_id, valor=EXCLUDED.valor,
      data_competencia=EXCLUDED.data_competencia, data_vencimento=EXCLUDED.data_vencimento,
      updated_at=now();
  ELSE
    DELETE FROM public.lancamentos_financeiros
    WHERE origem='recebimento_saldo' AND origem_id=NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_nf_to_recebimento_retencao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rec public.recebimentos%ROWTYPE;
  v_prazo integer := 30;
  v_cat uuid;
  v_ret numeric(14,2);
BEGIN
  PERFORM set_config('app.sync', 'on', true);
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lancamentos_financeiros WHERE origem='retencao_nf' AND origem_id=OLD.id;
    RETURN OLD;
  END IF;

  v_ret := NEW.ret_inss + NEW.ret_iss + NEW.ret_irrf + NEW.ret_pcc;
  SELECT c.prazo_pagamento_dias INTO v_prazo
  FROM public.obras o LEFT JOIN public.clientes c ON c.id=o.cliente_id
  WHERE o.id=NEW.obra_id;
  v_prazo := COALESCE(v_prazo, 30);

  SELECT * INTO v_rec FROM public.recebimentos WHERE nota_fiscal_id=NEW.id LIMIT 1;
  IF NOT FOUND AND NEW.pedido_compra_id IS NOT NULL THEN
    SELECT * INTO v_rec FROM public.recebimentos
    WHERE pedido_compra_id=NEW.pedido_compra_id AND nota_fiscal_id IS NULL LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    INSERT INTO public.recebimentos (
      empresa_id, obra_id, pedido_compra_id, nota_fiscal_id, valor, valor_recebido,
      data_prevista, status, descricao
    ) VALUES (
      NEW.empresa_id, NEW.obra_id, NEW.pedido_compra_id, NEW.id, NEW.valor_liquido, 0,
      NEW.data_emissao + v_prazo, 'a_receber', 'NF ' || NEW.numero_nf
    );
  ELSE
    UPDATE public.recebimentos SET
      nota_fiscal_id=NEW.id, obra_id=NEW.obra_id, valor=NEW.valor_liquido,
      data_prevista=CASE WHEN valor_recebido > 0 THEN data_prevista ELSE NEW.data_emissao + v_prazo END,
      descricao='NF ' || NEW.numero_nf, updated_at=now()
    WHERE id=v_rec.id;
  END IF;

  SELECT id INTO v_cat FROM public.categorias_financeiras
  WHERE empresa_id=NEW.empresa_id AND nome='Impostos retidos na fonte' LIMIT 1;
  IF v_cat IS NULL THEN
    INSERT INTO public.categorias_financeiras(empresa_id,nome,grupo,tipo,cor,ativo)
    VALUES(NEW.empresa_id,'Impostos retidos na fonte','custo_imposto','despesa','#64748b',true)
    ON CONFLICT DO NOTHING RETURNING id INTO v_cat;
    IF v_cat IS NULL THEN
      SELECT id INTO v_cat FROM public.categorias_financeiras
      WHERE empresa_id=NEW.empresa_id AND nome='Impostos retidos na fonte' LIMIT 1;
    END IF;
  END IF;

  IF v_ret > 0 THEN
    INSERT INTO public.lancamentos_financeiros(
      empresa_id,obra_id,categoria_id,tipo,status,descricao,valor,data_competencia,
      data_vencimento,data_realizado,origem,origem_id,impacto_caixa
    ) VALUES(
      NEW.empresa_id,NEW.obra_id,v_cat,'despesa','realizado','Retenções NF '||NEW.numero_nf,
      v_ret,NEW.data_emissao,NEW.data_emissao,NEW.data_emissao,'retencao_nf',NEW.id,false
    ) ON CONFLICT(origem,origem_id) DO UPDATE SET
      obra_id=EXCLUDED.obra_id,categoria_id=EXCLUDED.categoria_id,descricao=EXCLUDED.descricao,
      valor=EXCLUDED.valor,data_competencia=EXCLUDED.data_competencia,
      data_vencimento=EXCLUDED.data_vencimento,data_realizado=EXCLUDED.data_realizado,
      impacto_caixa=false,updated_at=now();
  ELSE
    DELETE FROM public.lancamentos_financeiros WHERE origem='retencao_nf' AND origem_id=NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nf_to_recebimento_retencao ON public.notas_fiscais;
CREATE TRIGGER trg_nf_to_recebimento_retencao
AFTER INSERT OR UPDATE OF obra_id, pedido_compra_id, numero_nf, data_emissao, valor_bruto,
  ret_inss, ret_iss, ret_irrf, ret_pcc
ON public.notas_fiscais
FOR EACH ROW EXECUTE FUNCTION public.fn_nf_to_recebimento_retencao();

CREATE OR REPLACE FUNCTION public.confirmar_recebimento(
  _id uuid, _valor numeric, _data date DEFAULT CURRENT_DATE
) RETURNS public.recebimentos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_rec public.recebimentos;
BEGIN
  SELECT * INTO v_rec FROM public.recebimentos WHERE id=_id;
  IF NOT FOUND OR NOT public.tenant_match(v_rec.empresa_id) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  IF COALESCE(_valor,0) <= 0 THEN RAISE EXCEPTION 'Informe um valor recebido maior que zero'; END IF;
  UPDATE public.recebimentos
  SET valor_recebido=LEAST(valor,valor_recebido+_valor), data_recebido=COALESCE(_data,CURRENT_DATE)
  WHERE id=_id RETURNING * INTO v_rec;
  RETURN v_rec;
END;
$$;
GRANT EXECUTE ON FUNCTION public.confirmar_recebimento(uuid,numeric,date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.confirmar_recebimento(uuid,numeric,date) FROM anon, public;

CREATE OR REPLACE FUNCTION public.get_retencoes_mensais(_inicio date, _fim date)
RETURNS TABLE(mes date, inss numeric, iss numeric, irrf numeric, pcc numeric, total numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT date_trunc('month', nf.data_emissao)::date,
    COALESCE(SUM(nf.ret_inss),0), COALESCE(SUM(nf.ret_iss),0),
    COALESCE(SUM(nf.ret_irrf),0), COALESCE(SUM(nf.ret_pcc),0),
    COALESCE(SUM(nf.ret_inss+nf.ret_iss+nf.ret_irrf+nf.ret_pcc),0)
  FROM public.notas_fiscais nf
  WHERE nf.empresa_id=public.get_user_empresa_id()
    AND nf.data_emissao>=_inicio AND nf.data_emissao<=_fim
  GROUP BY 1 ORDER BY 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_retencoes_mensais(date,date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_retencoes_mensais(date,date) FROM anon, public;

CREATE OR REPLACE FUNCTION public.get_obra_financeiro_resumo(_obra_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(obra_id uuid, codigo_chamado text, receita_orcada numeric, receita_faturada numeric,
  receita_recebida numeric, custo_materiais numeric, custo_terceirizados_pago numeric,
  custo_terceirizados_previsto numeric, custo_cartao numeric, despesas_realizadas numeric,
  custo_total numeric, saldo numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
WITH e AS (SELECT public.get_user_empresa_id() eid), base AS (
 SELECT o.id,o.codigo_chamado,
  COALESCE((SELECT SUM(COALESCE(valor_total,valor_orcamento)) FROM orcamentos WHERE obra_id=o.id AND status='aprovado'),0)
   +COALESCE((SELECT SUM(valor_total) FROM obra_adendos WHERE obra_id=o.id AND status IN('assinado','em_execucao','concluido')),0) receita_orcada,
  COALESCE((SELECT SUM(valor_bruto) FROM notas_fiscais WHERE obra_id=o.id),0) receita_faturada,
  COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND tipo='receita' AND status='realizado' AND impacto_caixa),0) receita_recebida,
  COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND tipo='despesa' AND status='realizado' AND origem='material' AND impacto_caixa),0) mat,
  COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND tipo='despesa' AND status='realizado' AND origem='parcela_pagamento' AND impacto_caixa),0) terc,
  COALESCE((SELECT SUM(valor_total) FROM contratacoes_terceirizado WHERE obra_id=o.id AND status_financeiro<>'cancelado'),0) terc_prev,
  COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND tipo='despesa' AND status='realizado' AND origem='cartao' AND impacto_caixa),0) cartao,
  COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND tipo='despesa' AND status='realizado' AND impacto_caixa AND COALESCE(origem,'manual') NOT IN('material','cartao','parcela_pagamento')),0) despesas
 FROM obras o,e WHERE o.empresa_id=e.eid AND (_obra_id IS NULL OR o.id=_obra_id)
)
SELECT id,codigo_chamado,receita_orcada,receita_faturada,receita_recebida,mat,terc,terc_prev,cartao,despesas,
 mat+terc+cartao+despesas,receita_recebida-(mat+terc+cartao+despesas) FROM base;
$$;

CREATE OR REPLACE FUNCTION public.get_financeiro_kpis(_inicio date DEFAULT NULL,_fim date DEFAULT NULL)
RETURNS TABLE(receita_realizada numeric,despesa_realizada numeric,receita_prevista numeric,
 despesa_prevista numeric,vencidos_qtd integer,vencidos_valor numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
WITH e AS(SELECT public.get_user_empresa_id() eid), hoje AS(SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date d),
lanc AS(SELECT lf.tipo,lf.status,lf.valor,lf.data_vencimento,COALESCE(lf.data_realizado,lf.data_vencimento,lf.data_competencia) dt
 FROM lancamentos_financeiros lf,e WHERE lf.empresa_id=e.eid AND lf.impacto_caixa)
SELECT
 COALESCE((SELECT SUM(valor) FROM lanc WHERE tipo='receita' AND status='realizado' AND (_inicio IS NULL OR dt>=_inicio) AND (_fim IS NULL OR dt<=_fim)),0),
 COALESCE((SELECT SUM(valor) FROM lanc WHERE tipo='despesa' AND status='realizado' AND (_inicio IS NULL OR dt>=_inicio) AND (_fim IS NULL OR dt<=_fim)),0),
 COALESCE((SELECT SUM(valor) FROM lanc WHERE tipo='receita' AND status='previsto' AND (_inicio IS NULL OR dt>=_inicio) AND (_fim IS NULL OR dt<=_fim)),0),
 COALESCE((SELECT SUM(valor) FROM lanc WHERE tipo='despesa' AND status='previsto' AND (_inicio IS NULL OR dt>=_inicio) AND (_fim IS NULL OR dt<=_fim)),0),
 COALESCE((SELECT COUNT(*) FROM lanc,hoje WHERE tipo='despesa' AND status='previsto' AND data_vencimento<hoje.d),0)::int,
 COALESCE((SELECT SUM(valor) FROM lanc,hoje WHERE tipo='despesa' AND status='previsto' AND data_vencimento<hoje.d),0);
$$;

CREATE OR REPLACE FUNCTION public.get_fluxo_caixa_mensal(_empresa_id uuid,_meses_atras integer DEFAULT 6,_meses_frente integer DEFAULT 3)
RETURNS TABLE(mes text,ano integer,mes_num integer,receitas_prev numeric,receitas_real numeric,
 despesas_prev numeric,despesas_real numeric,saldo_prev numeric,saldo_real numeric,saldo_acumulado numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_inicio date:=date_trunc('month',CURRENT_DATE-(_meses_atras||' months')::interval)::date;
v_fim date:=date_trunc('month',CURRENT_DATE+(_meses_frente||' months')::interval)::date;
v_saldo_ini numeric:=0;v_data_ini date;v_abertura numeric:=0;
BEGIN
 IF NOT(public.is_super_admin(auth.uid()) OR _empresa_id=public.get_user_empresa_id()) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
 SELECT COALESCE(e.saldo_inicial,0),e.data_saldo_inicial INTO v_saldo_ini,v_data_ini FROM empresas e WHERE e.id=_empresa_id;
 SELECT v_saldo_ini+COALESCE(SUM(CASE WHEN lf.tipo='receita' THEN lf.valor ELSE -lf.valor END),0) INTO v_abertura
 FROM lancamentos_financeiros lf WHERE lf.empresa_id=_empresa_id AND lf.status='realizado' AND lf.impacto_caixa
 AND COALESCE(lf.data_realizado,lf.data_competencia)<v_inicio
 AND(v_data_ini IS NULL OR COALESCE(lf.data_realizado,lf.data_competencia)>=v_data_ini);
 RETURN QUERY WITH serie AS(SELECT generate_series(v_inicio,v_fim,'1 month')::date mes_inicio),
 prev AS(SELECT date_trunc('month',COALESCE(lf.data_vencimento,lf.data_competencia))::date mes_ref,
 SUM(CASE WHEN lf.tipo='receita' THEN lf.valor ELSE 0 END) rec_prev,SUM(CASE WHEN lf.tipo='despesa' THEN lf.valor ELSE 0 END) dep_prev
 FROM lancamentos_financeiros lf WHERE lf.empresa_id=_empresa_id AND lf.status IN('previsto','realizado') AND lf.impacto_caixa GROUP BY 1),
 realiz AS(SELECT date_trunc('month',COALESCE(lf.data_realizado,lf.data_competencia))::date mes_ref,
 SUM(CASE WHEN lf.tipo='receita' THEN lf.valor ELSE 0 END) rec_real,SUM(CASE WHEN lf.tipo='despesa' THEN lf.valor ELSE 0 END) dep_real
 FROM lancamentos_financeiros lf WHERE lf.empresa_id=_empresa_id AND lf.status='realizado' AND lf.impacto_caixa GROUP BY 1),
 base AS(SELECT s.mes_inicio,COALESCE(p.rec_prev,0) rec_prev,COALESCE(r.rec_real,0) rec_real,
 COALESCE(p.dep_prev,0) dep_prev,COALESCE(r.dep_real,0) dep_real FROM serie s LEFT JOIN prev p ON p.mes_ref=s.mes_inicio LEFT JOIN realiz r ON r.mes_ref=s.mes_inicio)
 SELECT to_char(b.mes_inicio,'Mon/YY'),EXTRACT(YEAR FROM b.mes_inicio)::int,EXTRACT(MONTH FROM b.mes_inicio)::int,
 b.rec_prev,b.rec_real,b.dep_prev,b.dep_real,b.rec_prev-b.dep_prev,b.rec_real-b.dep_real,
 v_abertura+SUM(b.rec_real-b.dep_real) OVER(ORDER BY b.mes_inicio ROWS UNBOUNDED PRECEDING) FROM base b ORDER BY b.mes_inicio;
END;$$;

INSERT INTO public.categorias_financeiras(empresa_id,nome,grupo,tipo,cor,ativo)
SELECT e.id,'Impostos retidos na fonte','custo_imposto','despesa','#64748b',true
FROM public.empresas e
WHERE NOT EXISTS(SELECT 1 FROM public.categorias_financeiras c WHERE c.empresa_id=e.id AND c.nome='Impostos retidos na fonte');