
-- 1) Fechamento da fatura (mesma lógica de calc_fatura_vencimento)
CREATE OR REPLACE FUNCTION public.calc_fatura_fechamento(_data_compra date, _dia_fech integer, _offset integer DEFAULT 0)
RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE mc date; fd int; mf date;
BEGIN
  IF _data_compra IS NULL OR _dia_fech IS NULL THEN RETURN NULL; END IF;
  mc := date_trunc('month', _data_compra)::date;
  fd := LEAST(_dia_fech, EXTRACT(day FROM (mc + interval '1 month - 1 day'))::int);
  IF EXTRACT(day FROM _data_compra)::int >= fd THEN mf := (mc + interval '1 month')::date; ELSE mf := mc; END IF;
  mf := (mf + (COALESCE(_offset,0) || ' month')::interval)::date;
  RETURN mf + (LEAST(_dia_fech, EXTRACT(day FROM (mf + interval '1 month - 1 day'))::int) - 1);
END $$;
REVOKE EXECUTE ON FUNCTION public.calc_fatura_fechamento(date,integer,integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.calc_fatura_fechamento(date,integer,integer) TO authenticated, service_role;

-- 2) Trigger: sempre a partir de data_compra + (parcela_num - 1) faturas
CREATE OR REPLACE FUNCTION public.fn_cartao_set_fatura()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_f int; v_v int; v_emp uuid; v_off int;
BEGIN
  SELECT empresa_id, dia_fechamento, dia_vencimento INTO v_emp, v_f, v_v
    FROM public.cartoes_credito WHERE id = NEW.cartao_id;
  IF v_emp IS NULL OR v_emp IS DISTINCT FROM NEW.empresa_id THEN
    RAISE EXCEPTION 'Registro de outra empresa';
  END IF;
  v_off := GREATEST(COALESCE(NEW.parcela_num, 1), 1) - 1;
  NEW.fatura_vencimento := COALESCE(public.calc_fatura_vencimento(NEW.data_compra, v_f, v_v, v_off), NEW.data_compra);
  NEW.competencia_fatura := public.calc_fatura_fechamento(NEW.data_compra, v_f, v_off);
  IF NOT NEW.fatura_paga THEN NEW.fatura_paga_em := NULL; END IF;
  IF NEW.fatura_paga AND NEW.fatura_paga_em IS NULL THEN
    NEW.fatura_paga_em := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  END IF;
  RETURN NEW;
END $$;

-- 3) Reagrupamento das parcelas antigas mal agrupadas + data_compra real
DO $$
DECLARE r record; v_novo uuid; v_base date;
BEGIN
  FOR r IN
    SELECT d.grupo_parcelamento AS g,
           d.empresa_id, d.cartao_id, COALESCE(d.obra_id::text,'-') AS obra,
           regexp_replace(d.descricao, '\s*\(\d+/\d+\)$', '') AS base_desc,
           (d.data_compra - ((COALESCE(d.parcela_num,1)-1) || ' month')::interval)::date AS orig,
           round(d.valor)::numeric AS vr
    FROM public.cartao_despesas d
    WHERE d.grupo_parcelamento IN (
      SELECT grupo_parcelamento FROM public.cartao_despesas
      WHERE grupo_parcelamento IS NOT NULL
      GROUP BY grupo_parcelamento HAVING count(*) <> max(total_parcelas)
    )
    GROUP BY 1,2,3,4,5,6,7
  LOOP
    v_novo := gen_random_uuid();
    SELECT min(data_compra) INTO v_base
      FROM public.cartao_despesas d
      WHERE d.grupo_parcelamento = r.g AND d.empresa_id = r.empresa_id
        AND d.cartao_id = r.cartao_id AND COALESCE(d.obra_id::text,'-') = r.obra
        AND regexp_replace(d.descricao, '\s*\(\d+/\d+\)$', '') = r.base_desc
        AND round(d.valor)::numeric = r.vr
        AND (d.data_compra - ((COALESCE(d.parcela_num,1)-1) || ' month')::interval)::date = r.orig;

    UPDATE public.cartao_despesas d
       SET grupo_parcelamento = v_novo,
           data_compra = v_base
     WHERE d.grupo_parcelamento = r.g AND d.empresa_id = r.empresa_id
       AND d.cartao_id = r.cartao_id AND COALESCE(d.obra_id::text,'-') = r.obra
       AND regexp_replace(d.descricao, '\s*\(\d+/\d+\)$', '') = r.base_desc
       AND round(d.valor)::numeric = r.vr
       AND (d.data_compra - ((COALESCE(d.parcela_num,1)-1) || ' month')::interval)::date = r.orig;
  END LOOP;
END $$;

-- 4) Parcelas antigas (grupos já corretos): data_compra = data da parcela 1
UPDATE public.cartao_despesas d
   SET data_compra = b.base
  FROM (
    SELECT grupo_parcelamento, min(data_compra) AS base
      FROM public.cartao_despesas
     WHERE grupo_parcelamento IS NOT NULL
     GROUP BY grupo_parcelamento
  ) b
 WHERE d.grupo_parcelamento = b.grupo_parcelamento
   AND d.empresa_id = d.empresa_id
   AND d.data_compra <> b.base;

-- 5) Recalcula vencimentos (trigger faz o cálculo); fatura_paga intocada
UPDATE public.cartao_despesas SET data_compra = data_compra
 WHERE total_parcelas IS NOT NULL AND total_parcelas > 1;
