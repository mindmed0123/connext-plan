-- 1) Função de gravação por tenant + assinatura ativa
CREATE OR REPLACE FUNCTION public.tenant_can_write(_empresa_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin(auth.uid())
      OR (public.tenant_match(_empresa_id) AND public.empresa_assinatura_ativa(_empresa_id));
$$;
REVOKE ALL ON FUNCTION public.tenant_can_write(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tenant_can_write(uuid) TO authenticated, service_role;

-- 2) Troca tenant_match -> tenant_can_write em todas as policies de escrita
DO $$
DECLARE r record; v_using text; v_check text;
BEGIN
  FOR r IN
    SELECT tablename, policyname, cmd, permissive, roles, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
       AND cmd IN ('INSERT','UPDATE','DELETE')
       AND (COALESCE(qual,'') || COALESCE(with_check,'')) LIKE '%tenant_match(%'
  LOOP
    v_using := replace(COALESCE(r.qual,''), 'tenant_match(', 'tenant_can_write(');
    v_check := replace(COALESCE(r.with_check,''), 'tenant_match(', 'tenant_can_write(');
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
    EXECUTE format('CREATE POLICY %I ON public.%I AS %s FOR %s TO %s %s %s',
      r.policyname, r.tablename, r.permissive, r.cmd, array_to_string(r.roles, ','),
      CASE WHEN r.qual IS NOT NULL THEN 'USING (' || v_using || ')' ELSE '' END,
      CASE WHEN r.with_check IS NOT NULL THEN 'WITH CHECK (' || v_check || ')' ELSE '' END);
  END LOOP;
END $$;

-- 3) RPCs que gravam
CREATE OR REPLACE FUNCTION public.salvar_orcamento(_orcamento jsonb, _itens jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
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

  UPDATE public.orcamentos SET updated_at = now() WHERE id = v_id;
  RETURN v_id;
END $function$;

CREATE OR REPLACE FUNCTION public.aprovar_orcamento(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_orc public.orcamentos;
BEGIN
  SELECT * INTO v_orc FROM public.orcamentos WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado'; END IF;
  IF NOT public.tenant_can_write(v_orc.empresa_id) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar este orçamento';
  END IF;
  IF NOT (public.is_admin_or_super(auth.uid())
          OR public.has_role(auth.uid(),'gestor')
          OR public.has_permission(auth.uid(),'orcamentos','edit')) THEN
    RAISE EXCEPTION 'Sem permissão no módulo de orçamentos';
  END IF;

  IF v_orc.obra_id IS NOT NULL THEN
    UPDATE public.orcamentos SET status = 'reprovado', updated_at = now()
     WHERE obra_id = v_orc.obra_id AND status = 'aprovado' AND id <> _id;
  END IF;
  UPDATE public.orcamentos SET status = 'aprovado', updated_at = now() WHERE id = _id;
END $function$;

CREATE OR REPLACE FUNCTION public.confirmar_recebimento(_id uuid, _valor numeric, _data date DEFAULT CURRENT_DATE)
RETURNS recebimentos LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_rec public.recebimentos;
BEGIN
  SELECT * INTO v_rec FROM public.recebimentos WHERE id=_id;
  IF NOT FOUND OR NOT public.tenant_can_write(v_rec.empresa_id) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  IF COALESCE(_valor,0) <= 0 THEN RAISE EXCEPTION 'Informe um valor recebido maior que zero'; END IF;
  UPDATE public.recebimentos
     SET valor_recebido=LEAST(valor,valor_recebido+_valor), data_recebido=COALESCE(_data,CURRENT_DATE)
   WHERE id=_id RETURNING * INTO v_rec;
  RETURN v_rec;
END; $function$;

CREATE OR REPLACE FUNCTION public.pagar_fatura_cartao(_cartao_id uuid, _vencimento date, _data_pagamento date DEFAULT NULL::date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_emp uuid; v_n integer;
BEGIN
  SELECT empresa_id INTO v_emp FROM public.cartoes_credito WHERE id = _cartao_id;
  IF v_emp IS NULL OR NOT public.tenant_can_write(v_emp) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  UPDATE public.cartao_despesas
     SET fatura_paga = true,
         fatura_paga_em = COALESCE(_data_pagamento, (now() AT TIME ZONE 'America/Sao_Paulo')::date)
   WHERE cartao_id = _cartao_id AND fatura_vencimento = _vencimento;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END; $function$;

CREATE OR REPLACE FUNCTION public.reabrir_fatura_cartao(_cartao_id uuid, _vencimento date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_emp uuid; v_n integer;
BEGIN
  SELECT empresa_id INTO v_emp FROM public.cartoes_credito WHERE id = _cartao_id;
  IF v_emp IS NULL OR NOT public.tenant_can_write(v_emp) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  UPDATE public.cartao_despesas SET fatura_paga = false, fatura_paga_em = NULL
   WHERE cartao_id = _cartao_id AND fatura_vencimento = _vencimento;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END; $function$;

-- 4) Triggers: conferem empresa da obra referenciada
CREATE OR REPLACE FUNCTION public.sync_obra_status_from_orcamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_obra_emp uuid;
BEGIN
  IF NEW.obra_id IS NULL THEN RETURN NEW; END IF;
  SELECT empresa_id INTO v_obra_emp FROM public.obras WHERE id = NEW.obra_id;
  IF v_obra_emp IS NULL OR v_obra_emp IS DISTINCT FROM NEW.empresa_id THEN
    RAISE EXCEPTION 'Obra de outra empresa';
  END IF;

  IF NEW.status = 'enviado' AND OLD.status IS DISTINCT FROM 'enviado' THEN
    UPDATE public.obras SET status = 'em_aprovacao', updated_at = now()
     WHERE id = NEW.obra_id
       AND status NOT IN ('em_execucao','finalizado','aguardando_rc','aguardando_pedido_compra',
                          'aguardando_nf','aguardando_pagamento','pago');
  END IF;

  IF NEW.status = 'aprovado' AND OLD.status IS DISTINCT FROM 'aprovado' THEN
    UPDATE public.obras SET status = 'em_execucao', updated_at = now()
     WHERE id = NEW.obra_id
       AND status NOT IN ('em_execucao','finalizado','aguardando_rc','aguardando_pedido_compra',
                          'aguardando_nf','aguardando_pagamento','pago');
    INSERT INTO public.obra_timeline (obra_id, evento, detalhes, empresa_id)
    VALUES (NEW.obra_id, 'Orçamento aprovado',
            'Orçamento aprovado no valor de ' || COALESCE(NEW.valor_total, NEW.valor_orcamento, 0),
            v_obra_emp);
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.fn_material_to_lancamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_cat uuid; v_obra_emp uuid;
BEGIN
  PERFORM set_config('app.sync', 'on', true);
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lancamentos_financeiros WHERE origem = 'material' AND origem_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.obra_id IS NOT NULL THEN
    SELECT empresa_id INTO v_obra_emp FROM public.obras WHERE id = NEW.obra_id;
    IF v_obra_emp IS NULL OR v_obra_emp IS DISTINCT FROM NEW.empresa_id THEN
      RAISE EXCEPTION 'Obra de outra empresa';
    END IF;
  END IF;

  SELECT id INTO v_cat FROM public.categorias_financeiras
    WHERE empresa_id = NEW.empresa_id AND grupo = 'custo_material' ORDER BY nome LIMIT 1;
  IF v_cat IS NULL THEN
    SELECT id INTO v_cat FROM public.categorias_financeiras
      WHERE empresa_id = NEW.empresa_id AND tipo = 'despesa' ORDER BY nome LIMIT 1;
  END IF;

  INSERT INTO public.lancamentos_financeiros (
    empresa_id, obra_id, categoria_id, tipo, status, descricao, valor,
    data_competencia, data_vencimento, data_realizado, forma_pagamento, fornecedor_nome, origem, origem_id
  ) VALUES (
    NEW.empresa_id, NEW.obra_id, v_cat, 'despesa'::public.lancamento_tipo, 'realizado'::public.lancamento_status,
    COALESCE(NULLIF(NEW.descricao, ''), 'Material'), NEW.valor_total,
    NEW.data_compra, NEW.data_compra, NEW.data_compra, NEW.forma_pagamento, NEW.fornecedor,
    'material', NEW.id
  )
  ON CONFLICT (origem, origem_id) DO UPDATE SET
    empresa_id = EXCLUDED.empresa_id, obra_id = EXCLUDED.obra_id, categoria_id = EXCLUDED.categoria_id,
    status = EXCLUDED.status, descricao = EXCLUDED.descricao, valor = EXCLUDED.valor,
    data_competencia = EXCLUDED.data_competencia, data_vencimento = EXCLUDED.data_vencimento,
    data_realizado = EXCLUDED.data_realizado, forma_pagamento = EXCLUDED.forma_pagamento,
    fornecedor_nome = EXCLUDED.fornecedor_nome, updated_at = now();
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.fn_cartao_to_lancamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_cat uuid; v_apelido text; v_obra_emp uuid;
BEGIN
  PERFORM set_config('app.sync', 'on', true);
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lancamentos_financeiros WHERE origem = 'cartao' AND origem_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.obra_id IS NOT NULL THEN
    SELECT empresa_id INTO v_obra_emp FROM public.obras WHERE id = NEW.obra_id;
    IF v_obra_emp IS NULL OR v_obra_emp IS DISTINCT FROM NEW.empresa_id THEN
      RAISE EXCEPTION 'Obra de outra empresa';
    END IF;
  END IF;

  SELECT id INTO v_cat FROM public.categorias_financeiras
    WHERE empresa_id = NEW.empresa_id AND grupo = 'custo_outro' ORDER BY nome LIMIT 1;
  IF v_cat IS NULL THEN
    SELECT id INTO v_cat FROM public.categorias_financeiras
      WHERE empresa_id = NEW.empresa_id AND tipo = 'despesa' ORDER BY nome LIMIT 1;
  END IF;

  SELECT apelido INTO v_apelido FROM public.cartoes_credito WHERE id = NEW.cartao_id;

  INSERT INTO public.lancamentos_financeiros (
    empresa_id, obra_id, categoria_id, tipo, status, descricao, valor,
    data_competencia, data_vencimento, data_realizado, fornecedor_nome, origem, origem_id
  ) VALUES (
    NEW.empresa_id, NEW.obra_id, v_cat, 'despesa'::public.lancamento_tipo,
    (CASE WHEN NEW.fatura_paga THEN 'realizado' ELSE 'previsto' END)::public.lancamento_status,
    COALESCE(NULLIF(NEW.descricao, ''), NEW.categoria, 'Despesa de cartão'), NEW.valor,
    NEW.data_compra, COALESCE(NEW.fatura_vencimento, NEW.data_compra),
    CASE WHEN NEW.fatura_paga THEN COALESCE(NEW.fatura_paga_em, NEW.fatura_vencimento, NEW.data_compra) END,
    COALESCE(v_apelido, 'Cartão'), 'cartao', NEW.id
  )
  ON CONFLICT (origem, origem_id) DO UPDATE SET
    empresa_id = EXCLUDED.empresa_id, obra_id = EXCLUDED.obra_id, categoria_id = EXCLUDED.categoria_id,
    status = EXCLUDED.status, descricao = EXCLUDED.descricao, valor = EXCLUDED.valor,
    data_competencia = EXCLUDED.data_competencia, data_vencimento = EXCLUDED.data_vencimento,
    data_realizado = EXCLUDED.data_realizado, fornecedor_nome = EXCLUDED.fornecedor_nome, updated_at = now();
  RETURN NEW;
END; $function$;

-- 5) Relatórios: filtram lançamentos também por empresa
CREATE OR REPLACE FUNCTION public.get_dre_obra(_empresa_id uuid, _obra_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(obra_id uuid, obra_codigo text, receita_contratada numeric, receita_medida numeric, receita_recebida numeric, custo_subcontratado numeric, custo_materiais numeric, custo_total_real numeric, margem_bruta numeric, margem_pct numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $function$
BEGIN
 IF NOT(public.is_super_admin(auth.uid()) OR _empresa_id=public.get_user_empresa_id()) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
 RETURN QUERY WITH base AS(
  SELECT o.id,o.codigo_chamado,
   COALESCE((SELECT SUM(COALESCE(valor_total,valor_orcamento)) FROM orcamentos WHERE obra_id=o.id AND empresa_id=_empresa_id AND status='aprovado'),0)
   +COALESCE((SELECT SUM(valor_total) FROM obra_adendos WHERE obra_id=o.id AND empresa_id=_empresa_id AND status IN('assinado','em_execucao','concluido')),0) receita_contratada,
   COALESCE((SELECT SUM(valor_medido) FROM medicoes WHERE obra_id=o.id AND empresa_id=_empresa_id AND status='aprovada'),0) receita_medida,
   COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND empresa_id=_empresa_id AND tipo='receita' AND status='realizado' AND impacto_caixa),0) receita_recebida,
   COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND empresa_id=_empresa_id AND tipo='despesa' AND status='realizado' AND origem='parcela_pagamento' AND impacto_caixa),0) custo_subcontratado,
   COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND empresa_id=_empresa_id AND tipo='despesa' AND status='realizado' AND origem='material' AND impacto_caixa),0) custo_materiais,
   COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND empresa_id=_empresa_id AND tipo='despesa' AND status='realizado' AND impacto_caixa AND COALESCE(origem,'manual') NOT IN('material','parcela_pagamento','cartao')),0)
   +COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND empresa_id=_empresa_id AND tipo='despesa' AND status<>'cancelado' AND origem='cartao' AND impacto_caixa),0) outras_despesas,
   o.created_at FROM obras o WHERE o.empresa_id=_empresa_id AND(_obra_id IS NULL OR o.id=_obra_id)
 )
 SELECT b.id,b.codigo_chamado,b.receita_contratada,b.receita_medida,b.receita_recebida,b.custo_subcontratado,b.custo_materiais,
  b.custo_subcontratado+b.custo_materiais+b.outras_despesas,
  b.receita_recebida-(b.custo_subcontratado+b.custo_materiais+b.outras_despesas),
  CASE WHEN b.receita_contratada=0 THEN 0 ELSE round(((b.receita_recebida-(b.custo_subcontratado+b.custo_materiais+b.outras_despesas))/NULLIF(b.receita_contratada,0))*100,2) END
 FROM base b ORDER BY b.created_at DESC;
END;$function$;

CREATE OR REPLACE FUNCTION public.get_obra_financeiro_resumo(_obra_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(obra_id uuid, codigo_chamado text, receita_orcada numeric, receita_faturada numeric, receita_recebida numeric, custo_materiais numeric, custo_terceirizados_pago numeric, custo_terceirizados_previsto numeric, custo_cartao numeric, despesas_realizadas numeric, custo_total numeric, saldo numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $function$
WITH e AS (SELECT public.get_user_empresa_id() eid), base AS (
 SELECT o.id,o.codigo_chamado,
  COALESCE((SELECT SUM(COALESCE(valor_total,valor_orcamento)) FROM orcamentos WHERE obra_id=o.id AND empresa_id=e.eid AND status='aprovado'),0)
   +COALESCE((SELECT SUM(valor_total) FROM obra_adendos WHERE obra_id=o.id AND empresa_id=e.eid AND status IN('assinado','em_execucao','concluido')),0) receita_orcada,
  COALESCE((SELECT SUM(valor_bruto) FROM notas_fiscais WHERE obra_id=o.id AND empresa_id=e.eid),0) receita_faturada,
  COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND empresa_id=e.eid AND tipo='receita' AND status='realizado' AND impacto_caixa),0) receita_recebida,
  COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND empresa_id=e.eid AND tipo='despesa' AND status='realizado' AND origem='material' AND impacto_caixa),0) mat,
  COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND empresa_id=e.eid AND tipo='despesa' AND status='realizado' AND origem='parcela_pagamento' AND impacto_caixa),0) terc,
  COALESCE((SELECT SUM(valor_total) FROM contratacoes_terceirizado WHERE obra_id=o.id AND empresa_id=e.eid AND status_financeiro<>'cancelado'),0) terc_prev,
  COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND empresa_id=e.eid AND tipo='despesa' AND status<>'cancelado' AND origem='cartao' AND impacto_caixa),0) cartao,
  COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id=o.id AND empresa_id=e.eid AND tipo='despesa' AND status='realizado' AND impacto_caixa AND COALESCE(origem,'manual') NOT IN('material','cartao','parcela_pagamento')),0) despesas
 FROM obras o,e WHERE o.empresa_id=e.eid AND (_obra_id IS NULL OR o.id=_obra_id)
)
SELECT id,codigo_chamado,receita_orcada,receita_faturada,receita_recebida,mat,terc,terc_prev,cartao,despesas,
 mat+terc+cartao+despesas,receita_recebida-(mat+terc+cartao+despesas) FROM base;
$function$;

-- 6) Planos: gestão só para autenticados super_admin; leitura pública dos planos ativos
DROP POLICY IF EXISTS "Apenas super_admin gerencia planos" ON public.planos;
CREATE POLICY "Apenas super_admin gerencia planos" ON public.planos
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "Planos ativos visíveis publicamente" ON public.planos;
CREATE POLICY "Planos ativos visíveis publicamente" ON public.planos
  FOR SELECT TO anon USING (ativo = true);
GRANT SELECT ON public.planos TO anon;

-- 7) Storage de documentos de pessoas exige permissão de Equipes
DROP POLICY IF EXISTS pessoas_docs_all ON storage.objects;
CREATE POLICY pessoas_docs_all ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'pessoas-documentos'
    AND (
      public.is_super_admin(auth.uid())
      OR ((storage.foldername(name))[1] = (public.get_user_empresa_id())::text
          AND (public.is_admin_or_super(auth.uid())
               OR public.has_permission(auth.uid(),'equipes','view')))
    )
  )
  WITH CHECK (
    bucket_id = 'pessoas-documentos'
    AND (
      public.is_super_admin(auth.uid())
      OR ((storage.foldername(name))[1] = (public.get_user_empresa_id())::text
          AND (public.is_admin_or_super(auth.uid())
               OR public.has_permission(auth.uid(),'equipes','view')))
    )
  );