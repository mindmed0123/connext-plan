-- 1. Regra única de cálculo: ISS após o desconto global -------------------
CREATE OR REPLACE FUNCTION public.recalc_totais_orcamento()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_orc_id UUID := COALESCE(NEW.orcamento_id, OLD.orcamento_id);
  v_subtotal NUMERIC(14,2);
  v_impostos NUMERIC(14,2);
  v_desc_pct NUMERIC(5,2);
  v_desc_valor NUMERIC(14,2);
BEGIN
  IF TG_OP <> 'DELETE' THEN
    NEW.subtotal := ROUND(COALESCE(NEW.quantidade,0) * COALESCE(NEW.preco_unitario,0) * (1 - COALESCE(NEW.desconto_pct,0)/100.0), 2);
  END IF;

  SELECT COALESCE(desconto_global_pct,0) INTO v_desc_pct FROM public.orcamentos WHERE id = v_orc_id;
  v_desc_pct := COALESCE(v_desc_pct, 0);

  SELECT
    COALESCE(SUM(subtotal), 0),
    COALESCE(SUM(ROUND(subtotal * (1 - v_desc_pct/100.0) * COALESCE(aliquota_iss,0) / 100.0, 2)), 0)
    INTO v_subtotal, v_impostos
    FROM public.orcamento_itens
   WHERE orcamento_id = v_orc_id;

  v_desc_valor := ROUND(v_subtotal * v_desc_pct / 100.0, 2);

  UPDATE public.orcamentos
     SET subtotal = v_subtotal,
         desconto_global_valor = v_desc_valor,
         valor_impostos = v_impostos,
         valor_total = v_subtotal - v_desc_valor + v_impostos,
         valor_orcamento = v_subtotal - v_desc_valor + v_impostos,
         updated_at = now()
   WHERE id = v_orc_id;

  RETURN COALESCE(NEW, OLD);
END $$;

CREATE OR REPLACE FUNCTION public.recalc_totais_apos_desc_global()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_subtotal NUMERIC(14,2);
  v_impostos NUMERIC(14,2);
  v_desc_pct NUMERIC(5,2) := COALESCE(NEW.desconto_global_pct, 0);
  v_desc_valor NUMERIC(14,2);
BEGIN
  SELECT
    COALESCE(SUM(subtotal),0),
    COALESCE(SUM(ROUND(subtotal * (1 - v_desc_pct/100.0) * COALESCE(aliquota_iss,0)/100.0, 2)),0)
    INTO v_subtotal, v_impostos
    FROM public.orcamento_itens WHERE orcamento_id = NEW.id;

  v_desc_valor := ROUND(v_subtotal * v_desc_pct / 100.0, 2);
  NEW.subtotal := v_subtotal;
  NEW.desconto_global_valor := v_desc_valor;
  NEW.valor_impostos := v_impostos;
  NEW.valor_total := v_subtotal - v_desc_valor + v_impostos;
  NEW.valor_orcamento := NEW.valor_total;
  RETURN NEW;
END $$;

-- 2. Orçamento aprovado é somente leitura ---------------------------------
CREATE OR REPLACE FUNCTION public.fn_orcamento_aprovado_readonly()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_super_admin(auth.uid()) THEN RETURN NEW; END IF;
  IF OLD.status = 'aprovado' AND NEW.status = 'aprovado' THEN
    IF (to_jsonb(NEW) - 'updated_at' - 'last_updated_at' - 'last_updated_by')
       IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at' - 'last_updated_at' - 'last_updated_by') THEN
      RAISE EXCEPTION 'Orçamento aprovado é somente leitura. Crie uma nova versão ou um adendo.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_orcamento_aprovado_readonly ON public.orcamentos;
CREATE TRIGGER trg_orcamento_aprovado_readonly
  BEFORE UPDATE ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_orcamento_aprovado_readonly();

CREATE OR REPLACE FUNCTION public.fn_orcamento_itens_readonly()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status TEXT;
BEGIN
  IF public.is_super_admin(auth.uid()) THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT status::text INTO v_status FROM public.orcamentos
   WHERE id = COALESCE(NEW.orcamento_id, OLD.orcamento_id);
  IF v_status = 'aprovado' THEN
    RAISE EXCEPTION 'Orçamento aprovado é somente leitura. Crie uma nova versão ou um adendo.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_orcamento_itens_readonly ON public.orcamento_itens;
CREATE TRIGGER trg_orcamento_itens_readonly
  BEFORE INSERT OR UPDATE OR DELETE ON public.orcamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.fn_orcamento_itens_readonly();

-- 3. Um único orçamento aprovado por obra ---------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_orcamento_aprovado_por_obra
  ON public.orcamentos(obra_id) WHERE status = 'aprovado' AND obra_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.aprovar_orcamento(_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_orc public.orcamentos;
BEGIN
  SELECT * INTO v_orc FROM public.orcamentos WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado'; END IF;
  IF NOT public.tenant_match(v_orc.empresa_id) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar este orçamento';
  END IF;

  IF v_orc.obra_id IS NOT NULL THEN
    UPDATE public.orcamentos
       SET status = 'reprovado', updated_at = now()
     WHERE obra_id = v_orc.obra_id AND status = 'aprovado' AND id <> _id;
  END IF;

  UPDATE public.orcamentos SET status = 'aprovado', updated_at = now() WHERE id = _id;
END $$;

REVOKE EXECUTE ON FUNCTION public.aprovar_orcamento(UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.aprovar_orcamento(UUID) TO authenticated;

-- 4. Salvar orçamento + itens em uma única transação ----------------------
CREATE OR REPLACE FUNCTION public.salvar_orcamento(_orcamento JSONB, _itens JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID := NULLIF(_orcamento->>'id','')::UUID;
  v_empresa UUID := NULLIF(_orcamento->>'empresa_id','')::UUID;
  v_status TEXT;
BEGIN
  IF v_empresa IS NULL OR NOT public.tenant_match(v_empresa) THEN
    RAISE EXCEPTION 'Sem permissão para gravar este orçamento';
  END IF;

  IF v_id IS NOT NULL THEN
    SELECT status::text INTO v_status FROM public.orcamentos WHERE id = v_id AND empresa_id = v_empresa;
    IF v_status IS NULL THEN RAISE EXCEPTION 'Orçamento não encontrado'; END IF;
    IF v_status = 'aprovado' THEN
      RAISE EXCEPTION 'Orçamento aprovado é somente leitura. Crie uma nova versão ou um adendo.';
    END IF;

    UPDATE public.orcamentos SET
      obra_id = NULLIF(_orcamento->>'obra_id','')::UUID,
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
      status = COALESCE((_orcamento->>'status')::orcamento_status, status),
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
      v_empresa,
      NULLIF(_orcamento->>'obra_id','')::UUID,
      _orcamento->>'codigo_chamado',
      _orcamento->>'titulo',
      (_orcamento->>'data_orcamento')::DATE,
      NULLIF(_orcamento->>'data_emissao','')::DATE,
      COALESCE((_orcamento->>'validade_dias')::INT, 30),
      _orcamento->>'cliente_nome',
      _orcamento->>'cliente_cnpj',
      _orcamento->>'cliente_inscricao_estadual',
      _orcamento->>'cliente_endereco',
      _orcamento->>'cliente_email',
      _orcamento->>'cliente_telefone',
      _orcamento->>'observacoes',
      _orcamento->>'observacoes_internas',
      _orcamento->>'objeto',
      _orcamento->>'prazo_execucao',
      _orcamento->>'local_execucao',
      COALESCE((_orcamento->>'desconto_global_pct')::NUMERIC, 0),
      COALESCE(_orcamento->>'condicao_pagamento','a_vista'),
      COALESCE((_orcamento->>'numero_parcelas')::INT, 1),
      COALESCE((_orcamento->>'intervalo_parcelas')::INT, 30),
      COALESCE((_orcamento->>'percentual_entrada')::NUMERIC, 0),
      COALESCE((_orcamento->>'status')::orcamento_status, 'em_elaboracao'),
      NULLIF(_orcamento->>'data_envio','')::DATE
    ) RETURNING id INTO v_id;
  END IF;

  DELETE FROM public.orcamento_itens WHERE orcamento_id = v_id;

  INSERT INTO public.orcamento_itens (
    orcamento_id, empresa_id, servico_id, codigo, tipo, descricao, descricao_detalhada,
    unidade, quantidade, preco_unitario, desconto_pct, aliquota_iss, ordem
  )
  SELECT
    v_id, v_empresa,
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

  -- garante recálculo mesmo sem itens
  UPDATE public.orcamentos SET updated_at = now() WHERE id = v_id;

  RETURN v_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.salvar_orcamento(JSONB, JSONB) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.salvar_orcamento(JSONB, JSONB) TO authenticated;

-- 5. Não rebaixar obra já paga/concluída ao reaprovar orçamento -----------
CREATE OR REPLACE FUNCTION public.sync_obra_status_from_orcamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.obra_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.status = 'enviado' AND OLD.status IS DISTINCT FROM 'enviado' THEN
    UPDATE public.obras SET status = 'em_aprovacao', updated_at = now()
    WHERE id = NEW.obra_id
      AND status NOT IN ('em_execucao','finalizado','aguardando_rc',
                         'aguardando_pedido_compra','aguardando_nf',
                         'aguardando_pagamento','pago');
  END IF;

  IF NEW.status = 'aprovado' AND OLD.status IS DISTINCT FROM 'aprovado' THEN
    UPDATE public.obras SET status = 'em_execucao', updated_at = now()
    WHERE id = NEW.obra_id
      AND status NOT IN ('em_execucao','finalizado','aguardando_rc',
                         'aguardando_pedido_compra','aguardando_nf',
                         'aguardando_pagamento','pago');
    INSERT INTO public.obra_timeline (obra_id, evento, detalhes, empresa_id)
    VALUES (NEW.obra_id, 'Orçamento aprovado',
            'Orçamento aprovado no valor de ' || COALESCE(NEW.valor_total, NEW.valor_orcamento, 0),
            (SELECT empresa_id FROM public.obras WHERE id = NEW.obra_id));
  END IF;

  RETURN NEW;
END $$;

-- 6. Reprocessa totais dos orçamentos existentes pela nova regra ----------
UPDATE public.orcamentos o SET
  subtotal = t.subtotal,
  desconto_global_valor = ROUND(t.subtotal * COALESCE(o.desconto_global_pct,0)/100.0, 2),
  valor_impostos = t.impostos,
  valor_total = t.subtotal - ROUND(t.subtotal * COALESCE(o.desconto_global_pct,0)/100.0, 2) + t.impostos,
  valor_orcamento = t.subtotal - ROUND(t.subtotal * COALESCE(o.desconto_global_pct,0)/100.0, 2) + t.impostos
FROM (
  SELECT i.orcamento_id,
         COALESCE(SUM(i.subtotal),0) AS subtotal,
         COALESCE(SUM(ROUND(i.subtotal * (1 - COALESCE(oo.desconto_global_pct,0)/100.0) * COALESCE(i.aliquota_iss,0)/100.0, 2)),0) AS impostos
    FROM public.orcamento_itens i
    JOIN public.orcamentos oo ON oo.id = i.orcamento_id
   GROUP BY i.orcamento_id
) t
WHERE t.orcamento_id = o.id;