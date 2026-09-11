CREATE OR REPLACE FUNCTION public.salvar_orcamento(_orcamento jsonb, _itens jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID := NULLIF(_orcamento->>'id','')::UUID;
  v_empresa UUID := NULLIF(_orcamento->>'empresa_id','')::UUID;
  v_obra UUID := NULLIF(_orcamento->>'obra_id','')::UUID;
  v_status TEXT;
  v_novo_status TEXT := NULLIF(_orcamento->>'status','');
BEGIN
  IF v_empresa IS NULL OR NOT public.tenant_can_write(v_empresa) THEN
    RAISE EXCEPTION 'Sem permissão para gravar este orçamento';
  END IF;
  IF NOT (public.is_admin_or_super(auth.uid())
          OR public.has_role(auth.uid(),'gestor')
          OR public.has_permission(auth.uid(),'orcamentos','edit')) THEN
    RAISE EXCEPTION 'Sem permissão no módulo de orçamentos';
  END IF;
  IF v_obra IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.obras WHERE id = v_obra AND empresa_id = v_empresa) THEN
    RAISE EXCEPTION 'Obra não pertence a esta empresa';
  END IF;
  IF v_novo_status = 'aprovado' THEN
    RAISE EXCEPTION 'A aprovação só pode ser feita pelo botão Aprovar orçamento';
  END IF;

  IF v_id IS NOT NULL THEN
    SELECT status::text INTO v_status FROM public.orcamentos WHERE id = v_id AND empresa_id = v_empresa;
    IF v_status IS NULL THEN RAISE EXCEPTION 'Orçamento não encontrado'; END IF;
    IF v_status = 'aprovado' THEN
      RAISE EXCEPTION 'Orçamento aprovado é somente leitura. Crie uma nova versão ou um adendo.';
    END IF;

    UPDATE public.orcamentos SET
      obra_id = v_obra,
      codigo_chamado = _orcamento->>'codigo_chamado',
      titulo = _orcamento->>'titulo',
      data_orcamento = (_orcamento->>'data_orcamento')::DATE,
      data_emissao = NULLIF(_orcamento->>'data_emissao','')::DATE,
      validade_dias = COALESCE((_orcamento->>'validade_dias')::INT, 30),
      cliente_nome = _orcamento->>'cliente_nome',
      cliente_cnpj = _orcamento->>'cliente_cnpj',
      cliente_inscricao_estadual = _orcamento->>'cliente_inscricao_estadual',
      cliente_endereco = _orcamento->>'cliente_endereco',
      cliente_email = _orcamento->>'cliente_email',
      cliente_telefone = _orcamento->>'cliente_telefone',
      observacoes = _orcamento->>'observacoes',
      observacoes_internas = _orcamento->>'observacoes_internas',
      objeto = _orcamento->>'objeto',
      prazo_execucao = _orcamento->>'prazo_execucao',
      local_execucao = _orcamento->>'local_execucao',
      desconto_global_pct = COALESCE((_orcamento->>'desconto_global_pct')::NUMERIC, 0),
      condicao_pagamento = COALESCE(_orcamento->>'condicao_pagamento','a_vista'),
      numero_parcelas = COALESCE((_orcamento->>'numero_parcelas')::INT, 1),
      intervalo_parcelas = COALESCE((_orcamento->>'intervalo_parcelas')::INT, 30),
      percentual_entrada = COALESCE((_orcamento->>'percentual_entrada')::NUMERIC, 0),
      status = COALESCE(v_novo_status::orcamento_status, status),
      data_envio = NULLIF(_orcamento->>'data_envio','')::DATE,
      updated_at = now()
    WHERE id = v_id;
  ELSE
    INSERT INTO public.orcamentos (
      empresa_id, obra_id, codigo_chamado, titulo, data_orcamento, data_emissao, validade_dias,
      cliente_nome, cliente_cnpj, cliente_inscricao_estadual, cliente_endereco, cliente_email,
      cliente_telefone, observacoes, observacoes_internas, objeto, prazo_execucao, local_execucao,
      desconto_global_pct, condicao_pagamento, numero_parcelas, intervalo_parcelas,
      percentual_entrada, status, data_envio
    ) VALUES (
      v_empresa, v_obra,
      _orcamento->>'codigo_chamado', _orcamento->>'titulo',
      (_orcamento->>'data_orcamento')::DATE,
      NULLIF(_orcamento->>'data_emissao','')::DATE,
      COALESCE((_orcamento->>'validade_dias')::INT, 30),
      _orcamento->>'cliente_nome', _orcamento->>'cliente_cnpj',
      _orcamento->>'cliente_inscricao_estadual', _orcamento->>'cliente_endereco',
      _orcamento->>'cliente_email', _orcamento->>'cliente_telefone',
      _orcamento->>'observacoes', _orcamento->>'observacoes_internas',
      _orcamento->>'objeto', _orcamento->>'prazo_execucao', _orcamento->>'local_execucao',
      COALESCE((_orcamento->>'desconto_global_pct')::NUMERIC, 0),
      COALESCE(_orcamento->>'condicao_pagamento','a_vista'),
      COALESCE((_orcamento->>'numero_parcelas')::INT, 1),
      COALESCE((_orcamento->>'intervalo_parcelas')::INT, 30),
      COALESCE((_orcamento->>'percentual_entrada')::NUMERIC, 0),
      COALESCE(v_novo_status::orcamento_status, 'em_elaboracao'),
      NULLIF(_orcamento->>'data_envio','')::DATE
    ) RETURNING id INTO v_id;
  END IF;

  DELETE FROM public.orcamento_itens WHERE orcamento_id = v_id;

  INSERT INTO public.orcamento_itens (
    orcamento_id, empresa_id, servico_id, codigo, tipo, descricao, descricao_detalhada,
    unidade, quantidade, preco_unitario, desconto_pct, aliquota_iss, ordem
  )
  SELECT v_id, v_empresa,
    NULLIF(it->>'servico_id','')::UUID,
    NULLIF(it->>'codigo',''),
    COALESCE(NULLIF(it->>'tipo',''),'servico'),
    COALESCE(it->>'descricao',''),
    NULLIF(it->>'descricao_detalhada',''),
    COALESCE(NULLIF(it->>'unidade',''),'un'),
    COALESCE((it->>'quantidade')::NUMERIC, 0),
    COALESCE((it->>'preco_unitario')::NUMERIC, 0),
    COALESCE((it->>'desconto_pct')::NUMERIC, 0),
    COALESCE((it->>'aliquota_iss')::NUMERIC, 0),
    COALESCE((it->>'ordem')::INT, ord::INT - 1)
  FROM jsonb_array_elements(COALESCE(_itens,'[]'::jsonb)) WITH ORDINALITY AS t(it, ord);

  UPDATE public.orcamentos SET
    bdi_ac = COALESCE((_orcamento->>'bdi_ac')::NUMERIC, bdi_ac),
    bdi_s  = COALESCE((_orcamento->>'bdi_s')::NUMERIC, bdi_s),
    bdi_r  = COALESCE((_orcamento->>'bdi_r')::NUMERIC, bdi_r),
    bdi_df = COALESCE((_orcamento->>'bdi_df')::NUMERIC, bdi_df),
    bdi_l  = COALESCE((_orcamento->>'bdi_l')::NUMERIC, bdi_l),
    bdi_i  = COALESCE((_orcamento->>'bdi_i')::NUMERIC, bdi_i),
    updated_at = now()
  WHERE id = v_id;
  RETURN v_id;
END $function$;