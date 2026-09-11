-- 1) Nova regra de vencimento
DROP FUNCTION IF EXISTS public.calc_fatura_vencimento(date, integer, integer);

CREATE OR REPLACE FUNCTION public.calc_fatura_vencimento(_data_compra date, _dia_fech integer, _dia_venc integer, _offset integer DEFAULT 0)
RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE mc date; fd int; mf date; mv date; vd int;
BEGIN
  IF _data_compra IS NULL OR _dia_fech IS NULL OR _dia_venc IS NULL THEN RETURN NULL; END IF;
  mc := date_trunc('month', _data_compra)::date;
  fd := LEAST(_dia_fech, EXTRACT(day FROM (mc + interval '1 month - 1 day'))::int);
  IF EXTRACT(day FROM _data_compra)::int >= fd THEN mf := (mc + interval '1 month')::date; ELSE mf := mc; END IF;
  mf := (mf + (COALESCE(_offset,0) || ' month')::interval)::date;
  IF _dia_venc > _dia_fech THEN mv := mf; ELSE mv := (mf + interval '1 month')::date; END IF;
  vd := LEAST(_dia_venc, EXTRACT(day FROM (mv + interval '1 month - 1 day'))::int);
  RETURN mv + (vd - 1);
END; $$;

REVOKE EXECUTE ON FUNCTION public.calc_fatura_vencimento(date,integer,integer,integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.calc_fatura_vencimento(date,integer,integer,integer) TO authenticated, service_role;

-- 2) Colunas de parcelamento e competência da fatura
ALTER TABLE public.cartao_despesas
  ADD COLUMN IF NOT EXISTS grupo_parcelamento uuid,
  ADD COLUMN IF NOT EXISTS parcela_num integer,
  ADD COLUMN IF NOT EXISTS total_parcelas integer,
  ADD COLUMN IF NOT EXISTS competencia_fatura date;

CREATE INDEX IF NOT EXISTS idx_cartao_despesas_grupo ON public.cartao_despesas(grupo_parcelamento);

-- 3) Trigger usa a competência da fatura (parcela) quando informada
CREATE OR REPLACE FUNCTION public.fn_cartao_set_fatura()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_f int; v_v int; v_ref date;
BEGIN
  SELECT dia_fechamento, dia_vencimento INTO v_f, v_v FROM public.cartoes_credito WHERE id = NEW.cartao_id;
  v_ref := COALESCE(NEW.competencia_fatura, NEW.data_compra);
  NEW.fatura_vencimento := COALESCE(public.calc_fatura_vencimento(v_ref, v_f, v_v, 0), NEW.data_compra);
  IF NOT NEW.fatura_paga THEN NEW.fatura_paga_em := NULL; END IF;
  IF NEW.fatura_paga AND NEW.fatura_paga_em IS NULL THEN
    NEW.fatura_paga_em := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  END IF;
  RETURN NEW;
END; $$;

-- 4) Backfill do parcelamento a partir da descrição "(i/N)"
WITH p AS (
  SELECT id, cartao_id, obra_id,
         regexp_replace(descricao, '\s*\((\d+)/(\d+)\)$', '') AS base_desc,
         ((regexp_match(descricao, '\((\d+)/(\d+)\)$'))[1])::int AS pn,
         ((regexp_match(descricao, '\((\d+)/(\d+)\)$'))[2])::int AS tp
  FROM public.cartao_despesas WHERE descricao ~ '\(\d+/\d+\)$'
), g AS (
  SELECT p.*, md5(cartao_id::text || COALESCE(obra_id::text,'') || base_desc || tp::text)::uuid AS grp FROM p
)
UPDATE public.cartao_despesas d
   SET parcela_num = g.pn, total_parcelas = g.tp, grupo_parcelamento = g.grp
  FROM g WHERE d.id = g.id;

-- 5) Recalcula vencimentos existentes (dispara o trigger, sem alterar fatura_paga)
UPDATE public.cartao_despesas SET updated_at = now();

-- 6) Regime de competência: custo de cartão pela data da compra
CREATE OR REPLACE FUNCTION public.get_obra_financeiro_resumo(_obra_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(obra_id uuid, codigo_chamado text, receita_orcada numeric, receita_faturada numeric, receita_recebida numeric, custo_materiais numeric, custo_terceirizados_pago numeric, custo_terceirizados_previsto numeric, custo_cartao numeric, despesas_realizadas numeric, custo_total numeric, saldo numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
WITH e AS (SELECT public.get_user_empresa_id() eid), base AS (
 SELECT o.id,o.codigo_chamado,
  COALESCE((SELECT SUM(COALESCE(valor_total,valor_orcamento)) FROM orcamentos WHERE obra_id=o.id AND status='aprovado'),0)
   +COALESCE((SELECT SUM(valor_total) FROM obra_adendos WHERE obra_id=o.id AND status IN('assinado','em_execucao','concluido')),0) receita_orcada,
  COALESCE((SELECT SUM(valor_bruto) FROM notas_fiscais WHERE obra_id=o.id),0) receita_faturada,
  COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND tipo='receita' AND status='realizado' AND impacto_caixa),0) receita_recebida,
  COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND tipo='despesa' AND status='realizado' AND origem='material' AND impacto_caixa),0) mat,
  COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND tipo='despesa' AND status='realizado' AND origem='parcela_pagamento' AND impacto_caixa),0) terc,
  COALESCE((SELECT SUM(valor_total) FROM contratacoes_terceirizado WHERE obra_id=o.id AND status_financeiro<>'cancelado'),0) terc_prev,
  COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND tipo='despesa' AND status<>'cancelado' AND origem='cartao' AND impacto_caixa),0) cartao,
  COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND tipo='despesa' AND status='realizado' AND impacto_caixa AND COALESCE(origem,'manual') NOT IN('material','cartao','parcela_pagamento')),0) despesas
 FROM obras o,e WHERE o.empresa_id=e.eid AND (_obra_id IS NULL OR o.id=_obra_id)
)
SELECT id,codigo_chamado,receita_orcada,receita_faturada,receita_recebida,mat,terc,terc_prev,cartao,despesas,
 mat+terc+cartao+despesas,receita_recebida-(mat+terc+cartao+despesas) FROM base;
$$;

CREATE OR REPLACE FUNCTION public.get_dre_obra(_empresa_id uuid, _obra_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(obra_id uuid, obra_codigo text, receita_contratada numeric, receita_medida numeric, receita_recebida numeric, custo_subcontratado numeric, custo_materiais numeric, custo_total_real numeric, margem_bruta numeric, margem_pct numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
 IF NOT(public.is_super_admin(auth.uid()) OR _empresa_id=public.get_user_empresa_id()) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
 RETURN QUERY WITH base AS(
  SELECT o.id,o.codigo_chamado,
   COALESCE((SELECT SUM(COALESCE(valor_total,valor_orcamento)) FROM orcamentos WHERE obra_id=o.id AND status='aprovado'),0)
   +COALESCE((SELECT SUM(valor_total) FROM obra_adendos WHERE obra_id=o.id AND status IN('assinado','em_execucao','concluido')),0) receita_contratada,
   COALESCE((SELECT SUM(valor_medido) FROM medicoes WHERE obra_id=o.id AND status='aprovada'),0) receita_medida,
   COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND tipo='receita' AND status='realizado' AND impacto_caixa),0) receita_recebida,
   COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND tipo='despesa' AND status='realizado' AND origem='parcela_pagamento' AND impacto_caixa),0) custo_subcontratado,
   COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND tipo='despesa' AND status='realizado' AND origem='material' AND impacto_caixa),0) custo_materiais,
   COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND tipo='despesa' AND status='realizado' AND impacto_caixa AND COALESCE(origem,'manual') NOT IN('material','parcela_pagamento','cartao')),0)
   +COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND tipo='despesa' AND status<>'cancelado' AND origem='cartao' AND impacto_caixa),0) outras_despesas,
   o.created_at FROM obras o WHERE o.empresa_id=_empresa_id AND(_obra_id IS NULL OR o.id=_obra_id)
 )
 SELECT b.id,b.codigo_chamado,b.receita_contratada,b.receita_medida,b.receita_recebida,b.custo_subcontratado,b.custo_materiais,
  b.custo_subcontratado+b.custo_materiais+b.outras_despesas,
  b.receita_recebida-(b.custo_subcontratado+b.custo_materiais+b.outras_despesas),
  CASE WHEN b.receita_contratada=0 THEN 0 ELSE round(((b.receita_recebida-(b.custo_subcontratado+b.custo_materiais+b.outras_despesas))/NULLIF(b.receita_contratada,0))*100,2) END
 FROM base b ORDER BY b.created_at DESC;
END;$$;