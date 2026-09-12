
REVOKE EXECUTE ON FUNCTION public.fn_conta_pagar_to_lancamento() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.fn_cpp_status() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.fn_cp_recalc() FROM anon, authenticated, public;

-- saldo por conta bancária
CREATE OR REPLACE FUNCTION public.get_saldos_contas(_empresa_id uuid)
RETURNS TABLE(conta_id uuid, nome text, banco text, saldo_inicial numeric, movimento numeric, saldo_atual numeric, nao_conciliado numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR _empresa_id = public.get_user_empresa_id()) THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;
  RETURN QUERY
  SELECT b.id, b.nome, b.banco, b.saldo_inicial,
    COALESCE(mv.mov,0),
    b.saldo_inicial + COALESCE(mv.mov,0),
    COALESCE(nc.total,0)
  FROM public.contas_bancarias b
  LEFT JOIN LATERAL (
    SELECT SUM(CASE WHEN lf.tipo='receita' THEN lf.valor ELSE -lf.valor END) AS mov
      FROM public.lancamentos_financeiros lf
     WHERE lf.empresa_id = b.empresa_id AND lf.conta_bancaria_id = b.id
       AND lf.status = 'realizado' AND lf.impacto_caixa
       AND (b.data_saldo_inicial IS NULL OR COALESCE(lf.data_realizado, lf.data_competencia) >= b.data_saldo_inicial)
  ) mv ON true
  LEFT JOIN LATERAL (
    SELECT SUM(ABS(eb.valor)) AS total FROM public.extrato_bancario eb
     WHERE eb.empresa_id = b.empresa_id AND eb.conta_id = b.id AND eb.conciliado = false
  ) nc ON true
  WHERE b.empresa_id = _empresa_id AND b.ativo
  ORDER BY b.nome;
END; $$;
REVOKE EXECUTE ON FUNCTION public.get_saldos_contas(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_saldos_contas(uuid) TO authenticated;

-- fluxo de caixa com filtro por conta
DROP FUNCTION IF EXISTS public.get_fluxo_caixa_mensal(uuid, integer, integer);
CREATE OR REPLACE FUNCTION public.get_fluxo_caixa_mensal(_empresa_id uuid, _meses_atras integer DEFAULT 6, _meses_frente integer DEFAULT 3, _conta_id uuid DEFAULT NULL)
RETURNS TABLE(mes text, ano integer, mes_num integer, receitas_prev numeric, receitas_real numeric, despesas_prev numeric, despesas_real numeric, saldo_prev numeric, saldo_real numeric, saldo_acumulado numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inicio date := date_trunc('month',CURRENT_DATE-(_meses_atras||' months')::interval)::date;
  v_fim date := date_trunc('month',CURRENT_DATE+(_meses_frente||' months')::interval)::date;
  v_saldo_ini numeric := 0; v_data_ini date; v_abertura numeric := 0;
BEGIN
  IF NOT(public.is_super_admin(auth.uid()) OR _empresa_id=public.get_user_empresa_id()) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  IF _conta_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM contas_bancarias b WHERE b.id=_conta_id AND b.empresa_id=_empresa_id) THEN
    RAISE EXCEPTION 'conta_invalida';
  END IF;

  SELECT COALESCE(SUM(b.saldo_inicial),0), MIN(b.data_saldo_inicial)
    INTO v_saldo_ini, v_data_ini
    FROM contas_bancarias b
   WHERE b.empresa_id=_empresa_id AND (_conta_id IS NULL OR b.id=_conta_id);

  IF NOT EXISTS (SELECT 1 FROM contas_bancarias b WHERE b.empresa_id=_empresa_id) THEN
    SELECT COALESCE(e.saldo_inicial,0), e.data_saldo_inicial INTO v_saldo_ini, v_data_ini
      FROM empresas e WHERE e.id=_empresa_id;
  END IF;

  SELECT v_saldo_ini + COALESCE(SUM(CASE WHEN lf.tipo='receita' THEN lf.valor ELSE -lf.valor END),0)
    INTO v_abertura
    FROM lancamentos_financeiros lf
   WHERE lf.empresa_id=_empresa_id AND lf.status='realizado' AND lf.impacto_caixa
     AND (_conta_id IS NULL OR lf.conta_bancaria_id=_conta_id)
     AND COALESCE(lf.data_realizado,lf.data_competencia) < v_inicio
     AND (v_data_ini IS NULL OR COALESCE(lf.data_realizado,lf.data_competencia) >= v_data_ini);

  RETURN QUERY
  WITH serie AS (SELECT generate_series(v_inicio,v_fim,'1 month')::date mes_inicio),
  prev AS (SELECT date_trunc('month',COALESCE(lf.data_vencimento,lf.data_competencia))::date mes_ref,
    SUM(CASE WHEN lf.tipo='receita' THEN lf.valor ELSE 0 END) rec_prev,
    SUM(CASE WHEN lf.tipo='despesa' THEN lf.valor ELSE 0 END) dep_prev
    FROM lancamentos_financeiros lf
   WHERE lf.empresa_id=_empresa_id AND lf.status IN('previsto','realizado') AND lf.impacto_caixa
     AND (_conta_id IS NULL OR lf.conta_bancaria_id=_conta_id) GROUP BY 1),
  realiz AS (SELECT date_trunc('month',COALESCE(lf.data_realizado,lf.data_competencia))::date mes_ref,
    SUM(CASE WHEN lf.tipo='receita' THEN lf.valor ELSE 0 END) rec_real,
    SUM(CASE WHEN lf.tipo='despesa' THEN lf.valor ELSE 0 END) dep_real,
    SUM(CASE WHEN (v_data_ini IS NULL OR COALESCE(lf.data_realizado,lf.data_competencia) >= v_data_ini)
             THEN (CASE WHEN lf.tipo='receita' THEN lf.valor ELSE -lf.valor END) ELSE 0 END) mov_pos
    FROM lancamentos_financeiros lf
   WHERE lf.empresa_id=_empresa_id AND lf.status='realizado' AND lf.impacto_caixa
     AND (_conta_id IS NULL OR lf.conta_bancaria_id=_conta_id) GROUP BY 1),
  base AS (SELECT s.mes_inicio, COALESCE(p.rec_prev,0) rec_prev, COALESCE(r.rec_real,0) rec_real,
    COALESCE(p.dep_prev,0) dep_prev, COALESCE(r.dep_real,0) dep_real, COALESCE(r.mov_pos,0) mov_pos
    FROM serie s LEFT JOIN prev p ON p.mes_ref=s.mes_inicio LEFT JOIN realiz r ON r.mes_ref=s.mes_inicio)
  SELECT to_char(b.mes_inicio,'Mon/YY'), EXTRACT(YEAR FROM b.mes_inicio)::int, EXTRACT(MONTH FROM b.mes_inicio)::int,
    b.rec_prev, b.rec_real, b.dep_prev, b.dep_real, b.rec_prev-b.dep_prev, b.rec_real-b.dep_real,
    CASE WHEN v_data_ini IS NOT NULL AND (b.mes_inicio + interval '1 month - 1 day')::date < v_data_ini
         THEN NULL ELSE v_abertura + SUM(b.mov_pos) OVER (ORDER BY b.mes_inicio ROWS UNBOUNDED PRECEDING) END
  FROM base b ORDER BY b.mes_inicio;
END; $$;
REVOKE EXECUTE ON FUNCTION public.get_fluxo_caixa_mensal(uuid,integer,integer,uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_fluxo_caixa_mensal(uuid,integer,integer,uuid) TO authenticated;

-- conferência do razão inclui contas a pagar
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
    UNION ALL
    SELECT cp.obra_id, 'conta_pagar', SUM(COALESCE(p.valor_pago, p.valor))
      FROM contas_pagar_parcelas p JOIN contas_pagar cp ON cp.id = p.conta_id, e
     WHERE p.empresa_id = e.eid GROUP BY 1
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
REVOKE EXECUTE ON FUNCTION public.verificar_razao() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.verificar_razao() TO authenticated;
