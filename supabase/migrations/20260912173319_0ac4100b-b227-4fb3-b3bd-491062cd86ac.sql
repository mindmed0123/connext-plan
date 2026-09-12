CREATE OR REPLACE FUNCTION public.importar_insumos(_linhas jsonb, _tabela text DEFAULT '', _mes date DEFAULT NULL, _arquivo text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp uuid := public.get_user_empresa_id();
  v_novas integer := 0; v_atu integer := 0; v_i integer := 0;
  r jsonb; v_id uuid; v_existe uuid; v_origem text;
BEGIN
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Empresa não identificada'; END IF;
  IF NOT (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','create')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  v_origem := CASE WHEN COALESCE(_tabela,'') = '' THEN 'propria' ELSE 'referencia' END;

  FOR r IN SELECT * FROM jsonb_array_elements(_linhas) LOOP
    v_i := v_i + 1;
    IF COALESCE(r->>'codigo','') = '' OR COALESCE(r->>'descricao','') = '' THEN
      RAISE EXCEPTION 'Linha % sem código ou descrição', v_i;
    END IF;
    IF (r->>'preco_unitario') IS NULL OR (r->>'preco_unitario') !~ '^-?[0-9]+(\.[0-9]+)?$' THEN
      RAISE EXCEPTION 'Linha %: preço inválido', v_i;
    END IF;

    SELECT i.id INTO v_existe FROM public.insumos i
      WHERE i.empresa_id = v_emp AND i.codigo = r->>'codigo' AND i.tabela_referencia = COALESCE(_tabela,'');
    IF v_existe IS NULL THEN
      INSERT INTO public.insumos (empresa_id, codigo, descricao, unidade, preco_unitario, origem, tabela_referencia, data_referencia, created_by)
      VALUES (v_emp, r->>'codigo', r->>'descricao', COALESCE(NULLIF(r->>'unidade',''),'un'),
              (r->>'preco_unitario')::numeric, v_origem, COALESCE(_tabela,''), _mes, auth.uid())
      RETURNING id INTO v_id;
      v_novas := v_novas + 1;
    ELSE
      UPDATE public.insumos SET descricao = r->>'descricao',
             unidade = COALESCE(NULLIF(r->>'unidade',''), unidade),
             preco_unitario = (r->>'preco_unitario')::numeric,
             data_referencia = COALESCE(_mes, data_referencia), updated_at = now()
        WHERE id = v_existe AND empresa_id = v_emp;
      v_id := v_existe; v_atu := v_atu + 1;
    END IF;

    IF _mes IS NOT NULL THEN
      INSERT INTO public.insumo_precos (empresa_id, insumo_id, data_referencia, preco_unitario, fonte)
      VALUES (v_emp, v_id, _mes, (r->>'preco_unitario')::numeric, NULLIF(_tabela,''))
      ON CONFLICT (empresa_id, insumo_id, data_referencia)
      DO UPDATE SET preco_unitario = EXCLUDED.preco_unitario, updated_at = now();
    END IF;
  END LOOP;

  INSERT INTO public.importacoes_referencia (empresa_id, arquivo_nome, tabela_referencia, mes_referencia, tipo, linhas_novas, linhas_atualizadas, importado_por)
  VALUES (v_emp, COALESCE(NULLIF(_arquivo,''),'planilha'), COALESCE(_tabela,''), _mes, 'insumos', v_novas, v_atu, auth.uid());

  RETURN jsonb_build_object('novas', v_novas, 'atualizadas', v_atu);
END $$;
REVOKE EXECUTE ON FUNCTION public.importar_insumos(jsonb, text, date, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.importar_insumos(jsonb, text, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.importar_composicoes(_linhas jsonb, _tabela text DEFAULT '', _mes date DEFAULT NULL, _arquivo text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp uuid := public.get_user_empresa_id();
  v_novas integer := 0; v_atu integer := 0; v_i integer := 0;
  r jsonb; v_comp uuid; v_ins uuid; v_existe uuid; v_origem text; it jsonb;
BEGIN
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Empresa não identificada'; END IF;
  IF NOT (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','create')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  v_origem := CASE WHEN COALESCE(_tabela,'') = '' THEN 'propria' ELSE 'referencia' END;

  FOR r IN SELECT * FROM jsonb_array_elements(_linhas) LOOP
    v_i := v_i + 1;
    IF COALESCE(r->>'codigo','') = '' OR COALESCE(r->>'descricao','') = '' THEN
      RAISE EXCEPTION 'Linha % sem código ou descrição', v_i;
    END IF;

    SELECT c.id INTO v_existe FROM public.composicoes c
      WHERE c.empresa_id = v_emp AND c.codigo = r->>'codigo' AND c.tabela_referencia = COALESCE(_tabela,'');
    IF v_existe IS NULL THEN
      INSERT INTO public.composicoes (empresa_id, codigo, descricao, unidade, origem, tabela_referencia, data_referencia, created_by)
      VALUES (v_emp, r->>'codigo', r->>'descricao', COALESCE(NULLIF(r->>'unidade',''),'un'), v_origem, COALESCE(_tabela,''), _mes, auth.uid())
      RETURNING id INTO v_comp;
      v_novas := v_novas + 1;
    ELSE
      UPDATE public.composicoes SET descricao = r->>'descricao',
             unidade = COALESCE(NULLIF(r->>'unidade',''), unidade),
             data_referencia = COALESCE(_mes, data_referencia), updated_at = now()
        WHERE id = v_existe AND empresa_id = v_emp;
      v_comp := v_existe; v_atu := v_atu + 1;
      DELETE FROM public.composicao_itens WHERE composicao_id = v_comp AND empresa_id = v_emp;
    END IF;

    FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(r->'itens','[]'::jsonb)) LOOP
      SELECT i.id INTO v_ins FROM public.insumos i
        WHERE i.empresa_id = v_emp AND i.codigo = it->>'codigo_insumo' AND i.tabela_referencia = COALESCE(_tabela,'');
      IF v_ins IS NULL THEN
        RAISE EXCEPTION 'Composição %: insumo % não encontrado; importe os insumos antes', r->>'codigo', it->>'codigo_insumo';
      END IF;
      INSERT INTO public.composicao_itens (empresa_id, composicao_id, tipo, insumo_id, coeficiente)
      VALUES (v_emp, v_comp, 'insumo', v_ins, COALESCE((it->>'coeficiente')::numeric, 1));
    END LOOP;

    UPDATE public.composicoes SET preco_calculado = public.calc_preco_composicao(v_comp, _mes, 1, '{}')
      WHERE id = v_comp AND empresa_id = v_emp;
  END LOOP;

  INSERT INTO public.importacoes_referencia (empresa_id, arquivo_nome, tabela_referencia, mes_referencia, tipo, linhas_novas, linhas_atualizadas, importado_por)
  VALUES (v_emp, COALESCE(NULLIF(_arquivo,''),'planilha'), COALESCE(_tabela,''), _mes, 'composicoes', v_novas, v_atu, auth.uid());

  RETURN jsonb_build_object('novas', v_novas, 'atualizadas', v_atu);
END $$;
REVOKE EXECUTE ON FUNCTION public.importar_composicoes(jsonb, text, date, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.importar_composicoes(jsonb, text, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_curva_abc_base(_tipo text DEFAULT 'insumo', _obra_id uuid DEFAULT NULL, _etapa_id uuid DEFAULT NULL)
RETURNS TABLE (codigo text, descricao text, unidade text, quantidade numeric, valor numeric, pct numeric, acumulado numeric, classe text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_user_empresa_id();
BEGIN
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Empresa não identificada'; END IF;
  IF NOT (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','view')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  RETURN QUERY
  WITH itens AS (
    SELECT oi.quantidade, oi.subtotal, oi.insumo_id, oi.composicao_id
    FROM public.orcamento_itens oi
    JOIN public.orcamentos o ON o.id = oi.orcamento_id AND o.empresa_id = v_emp
    WHERE oi.empresa_id = v_emp
      AND (_obra_id IS NULL OR o.obra_id = _obra_id)
      AND (_etapa_id IS NULL OR oi.etapa_id = _etapa_id)
  ), agrupado AS (
    SELECT COALESCE(i.codigo, c.codigo) AS cod,
           COALESCE(i.descricao, c.descricao) AS desc_,
           COALESCE(i.unidade, c.unidade) AS un,
           SUM(t.quantidade) AS qtd, SUM(t.subtotal) AS val
    FROM itens t
    LEFT JOIN public.insumos i ON _tipo = 'insumo' AND i.id = t.insumo_id AND i.empresa_id = v_emp
    LEFT JOIN public.composicoes c ON _tipo = 'composicao' AND c.id = t.composicao_id AND c.empresa_id = v_emp
    WHERE (_tipo = 'insumo' AND t.insumo_id IS NOT NULL) OR (_tipo = 'composicao' AND t.composicao_id IS NOT NULL)
    GROUP BY 1,2,3
  ), total AS (SELECT NULLIF(SUM(val),0) t FROM agrupado),
  ord AS (
    SELECT a.*, (a.val / (SELECT t FROM total)) * 100 AS p,
           SUM(a.val) OVER (ORDER BY a.val DESC ROWS UNBOUNDED PRECEDING) / (SELECT t FROM total) * 100 AS ac
    FROM agrupado a
  )
  SELECT o.cod, o.desc_, o.un, ROUND(o.qtd,4), ROUND(o.val,2), ROUND(o.p,2), ROUND(o.ac,2),
         CASE WHEN o.ac <= 80 THEN 'A' WHEN o.ac <= 95 THEN 'B' ELSE 'C' END
  FROM ord o ORDER BY o.val DESC;
END $$;
REVOKE EXECUTE ON FUNCTION public.get_curva_abc_base(text, uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_curva_abc_base(text, uuid, uuid) TO authenticated;