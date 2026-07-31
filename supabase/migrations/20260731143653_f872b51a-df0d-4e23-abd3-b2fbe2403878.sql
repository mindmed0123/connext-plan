CREATE OR REPLACE FUNCTION public.get_fluxo_caixa_mensal(_empresa_id uuid, _meses_atras integer DEFAULT 6, _meses_frente integer DEFAULT 3)
 RETURNS TABLE(mes text, ano integer, mes_num integer, receitas_prev numeric, receitas_real numeric, despesas_prev numeric, despesas_real numeric, saldo_prev numeric, saldo_real numeric, saldo_acumulado numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inicio date := date_trunc('month', CURRENT_DATE - (_meses_atras || ' months')::interval)::date;
  v_fim date := date_trunc('month', CURRENT_DATE + (_meses_frente || ' months')::interval)::date;
  v_saldo_ini numeric := 0;
  v_data_ini date;
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR _empresa_id = public.get_user_empresa_id()) THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;

  SELECT COALESCE(e.saldo_inicial, 0), e.data_saldo_inicial
    INTO v_saldo_ini, v_data_ini
    FROM public.empresas e WHERE e.id = _empresa_id;

  RETURN QUERY
  WITH serie AS (
    SELECT generate_series(v_inicio, v_fim, '1 month'::interval)::date AS mes_inicio
  ),
  prev AS (
    SELECT date_trunc('month', COALESCE(lf.data_vencimento, lf.data_competencia))::date AS mes_ref,
      SUM(CASE WHEN lf.tipo = 'receita' THEN lf.valor ELSE 0 END) AS rec_prev,
      SUM(CASE WHEN lf.tipo = 'despesa' THEN lf.valor ELSE 0 END) AS dep_prev
    FROM public.lancamentos_financeiros lf
    WHERE lf.empresa_id = _empresa_id
      AND lf.status IN ('previsto','realizado')
    GROUP BY 1
  ),
  real AS (
    SELECT date_trunc('month', COALESCE(lf.data_realizado, lf.data_competencia))::date AS mes_ref,
      SUM(CASE WHEN lf.tipo = 'receita' THEN lf.valor ELSE 0 END) AS rec_real,
      SUM(CASE WHEN lf.tipo = 'despesa' THEN lf.valor ELSE 0 END) AS dep_real
    FROM public.lancamentos_financeiros lf
    WHERE lf.empresa_id = _empresa_id
      AND lf.status = 'realizado'
    GROUP BY 1
  ),
  base AS (
    SELECT s.mes_inicio,
      COALESCE(p.rec_prev, 0) AS rec_prev,
      COALESCE(r.rec_real, 0) AS rec_real,
      COALESCE(p.dep_prev, 0) AS dep_prev,
      COALESCE(r.dep_real, 0) AS dep_real
    FROM serie s
    LEFT JOIN prev p ON p.mes_ref = s.mes_inicio
    LEFT JOIN real r ON r.mes_ref = s.mes_inicio
  )
  SELECT to_char(b.mes_inicio, 'Mon/YY'),
    EXTRACT(YEAR FROM b.mes_inicio)::integer,
    EXTRACT(MONTH FROM b.mes_inicio)::integer,
    b.rec_prev, b.rec_real, b.dep_prev, b.dep_real,
    b.rec_prev - b.dep_prev,
    b.rec_real - b.dep_real,
    v_saldo_ini + SUM(
      CASE WHEN v_data_ini IS NULL OR b.mes_inicio >= date_trunc('month', v_data_ini)::date
           THEN b.rec_real - b.dep_real ELSE 0 END
    ) OVER (ORDER BY b.mes_inicio ROWS UNBOUNDED PRECEDING)
  FROM base b
  ORDER BY b.mes_inicio;
END; $function$;