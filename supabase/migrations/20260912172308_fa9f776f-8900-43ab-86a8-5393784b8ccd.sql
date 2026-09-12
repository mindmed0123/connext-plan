-- ============ configuração ============
ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS usa_estoque boolean NOT NULL DEFAULT false;

-- ============ depositos ============
CREATE TABLE IF NOT EXISTS public.depositos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_user_empresa_id(),
  nome text NOT NULL,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  padrao boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS depositos_empresa_nome_key ON public.depositos (empresa_id, lower(nome));
CREATE INDEX IF NOT EXISTS depositos_empresa_idx ON public.depositos (empresa_id, ativo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.depositos TO authenticated;
GRANT ALL ON public.depositos TO service_role;
ALTER TABLE public.depositos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS depositos_select ON public.depositos;
CREATE POLICY depositos_select ON public.depositos FOR SELECT TO authenticated
USING (public.tenant_match(empresa_id));

DROP POLICY IF EXISTS depositos_insert ON public.depositos;
CREATE POLICY depositos_insert ON public.depositos FOR INSERT TO authenticated
WITH CHECK (
  public.tenant_can_write(empresa_id)
  AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','create'))
  AND (obra_id IS NULL OR public.mesmo_tenant('public.obras', obra_id, empresa_id))
);

DROP POLICY IF EXISTS depositos_update ON public.depositos;
CREATE POLICY depositos_update ON public.depositos FOR UPDATE TO authenticated
USING (
  public.tenant_can_write(empresa_id)
  AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','edit'))
  AND (obra_id IS NULL OR public.mesmo_tenant('public.obras', obra_id, empresa_id))
)
WITH CHECK (
  public.tenant_can_write(empresa_id)
  AND (obra_id IS NULL OR public.mesmo_tenant('public.obras', obra_id, empresa_id))
);

DROP POLICY IF EXISTS depositos_delete ON public.depositos;
CREATE POLICY depositos_delete ON public.depositos FOR DELETE TO authenticated
USING (
  public.tenant_can_write(empresa_id)
  AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','delete'))
);

DROP TRIGGER IF EXISTS trg_depositos_updated ON public.depositos;
CREATE TRIGGER trg_depositos_updated BEFORE UPDATE ON public.depositos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ movimentos ============
CREATE TABLE IF NOT EXISTS public.estoque_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_user_empresa_id(),
  deposito_id uuid NOT NULL REFERENCES public.depositos(id) ON DELETE RESTRICT,
  material text NOT NULL,
  unidade text NOT NULL DEFAULT 'un',
  quantidade numeric(14,4) NOT NULL CHECK (quantidade > 0),
  sentido text NOT NULL CHECK (sentido IN ('entrada','saida')),
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida','transferencia','ajuste')),
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('ordem_compra','requisicao','transferencia','manual')),
  custo_unitario numeric(14,4) NOT NULL DEFAULT 0,
  valor_total numeric(14,2) NOT NULL DEFAULT 0,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  etapa_id uuid REFERENCES public.obra_etapas(id) ON DELETE SET NULL,
  ordem_compra_id uuid REFERENCES public.ordens_compra(id) ON DELETE SET NULL,
  material_obra_id uuid REFERENCES public.materiais_obra(id) ON DELETE SET NULL,
  transferencia_id uuid,
  data date NOT NULL DEFAULT CURRENT_DATE,
  responsavel_id uuid REFERENCES public.pessoas(id) ON DELETE SET NULL,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS estoque_mov_empresa_idx ON public.estoque_movimentos (empresa_id, data DESC);
CREATE INDEX IF NOT EXISTS estoque_mov_deposito_idx ON public.estoque_movimentos (empresa_id, deposito_id, lower(material));
CREATE INDEX IF NOT EXISTS estoque_mov_obra_idx ON public.estoque_movimentos (empresa_id, obra_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_movimentos TO authenticated;
GRANT ALL ON public.estoque_movimentos TO service_role;
ALTER TABLE public.estoque_movimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS estoque_mov_select ON public.estoque_movimentos;
CREATE POLICY estoque_mov_select ON public.estoque_movimentos FOR SELECT TO authenticated
USING (public.tenant_match(empresa_id));

DROP POLICY IF EXISTS estoque_mov_insert ON public.estoque_movimentos;
CREATE POLICY estoque_mov_insert ON public.estoque_movimentos FOR INSERT TO authenticated
WITH CHECK (
  public.tenant_can_write(empresa_id)
  AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','create'))
  AND public.mesmo_tenant('public.depositos', deposito_id, empresa_id)
  AND (obra_id IS NULL OR public.mesmo_tenant('public.obras', obra_id, empresa_id))
  AND (etapa_id IS NULL OR public.mesmo_tenant('public.obra_etapas', etapa_id, empresa_id))
  AND (ordem_compra_id IS NULL OR public.mesmo_tenant('public.ordens_compra', ordem_compra_id, empresa_id))
  AND (material_obra_id IS NULL OR public.mesmo_tenant('public.materiais_obra', material_obra_id, empresa_id))
  AND (responsavel_id IS NULL OR public.mesmo_tenant('public.pessoas', responsavel_id, empresa_id))
);

DROP POLICY IF EXISTS estoque_mov_update ON public.estoque_movimentos;
CREATE POLICY estoque_mov_update ON public.estoque_movimentos FOR UPDATE TO authenticated
USING (
  public.tenant_can_write(empresa_id)
  AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','edit'))
  AND public.mesmo_tenant('public.depositos', deposito_id, empresa_id)
  AND (obra_id IS NULL OR public.mesmo_tenant('public.obras', obra_id, empresa_id))
  AND (etapa_id IS NULL OR public.mesmo_tenant('public.obra_etapas', etapa_id, empresa_id))
  AND (ordem_compra_id IS NULL OR public.mesmo_tenant('public.ordens_compra', ordem_compra_id, empresa_id))
  AND (material_obra_id IS NULL OR public.mesmo_tenant('public.materiais_obra', material_obra_id, empresa_id))
  AND (responsavel_id IS NULL OR public.mesmo_tenant('public.pessoas', responsavel_id, empresa_id))
)
WITH CHECK (
  public.tenant_can_write(empresa_id)
  AND public.mesmo_tenant('public.depositos', deposito_id, empresa_id)
  AND (obra_id IS NULL OR public.mesmo_tenant('public.obras', obra_id, empresa_id))
  AND (etapa_id IS NULL OR public.mesmo_tenant('public.obra_etapas', etapa_id, empresa_id))
  AND (ordem_compra_id IS NULL OR public.mesmo_tenant('public.ordens_compra', ordem_compra_id, empresa_id))
  AND (material_obra_id IS NULL OR public.mesmo_tenant('public.materiais_obra', material_obra_id, empresa_id))
  AND (responsavel_id IS NULL OR public.mesmo_tenant('public.pessoas', responsavel_id, empresa_id))
);

DROP POLICY IF EXISTS estoque_mov_delete ON public.estoque_movimentos;
CREATE POLICY estoque_mov_delete ON public.estoque_movimentos FOR DELETE TO authenticated
USING (
  public.tenant_can_write(empresa_id)
  AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','delete'))
);

DROP TRIGGER IF EXISTS trg_estoque_mov_updated ON public.estoque_movimentos;
CREATE TRIGGER trg_estoque_mov_updated BEFORE UPDATE ON public.estoque_movimentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- valor e coerência de empresa (regra 5: nunca derivar empresa do pai)
CREATE OR REPLACE FUNCTION public.fn_estoque_mov_before()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.empresa_id IS NULL THEN RAISE EXCEPTION 'Empresa não identificada'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.depositos d WHERE d.id = NEW.deposito_id AND d.empresa_id = NEW.empresa_id) THEN
    RAISE EXCEPTION 'Depósito pertence a outra empresa';
  END IF;
  IF NEW.obra_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.obras o WHERE o.id = NEW.obra_id AND o.empresa_id = NEW.empresa_id) THEN
    RAISE EXCEPTION 'Obra pertence a outra empresa';
  END IF;
  IF NEW.tipo = 'entrada' THEN NEW.sentido := 'entrada'; END IF;
  IF NEW.tipo = 'saida' THEN NEW.sentido := 'saida'; END IF;
  NEW.valor_total := ROUND(NEW.quantidade * COALESCE(NEW.custo_unitario,0), 2);
  NEW.material := btrim(NEW.material);
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.fn_estoque_mov_before() FROM anon, public;

DROP TRIGGER IF EXISTS trg_estoque_mov_before ON public.estoque_movimentos;
CREATE TRIGGER trg_estoque_mov_before BEFORE INSERT OR UPDATE ON public.estoque_movimentos
FOR EACH ROW EXECUTE FUNCTION public.fn_estoque_mov_before();

-- ============ saldos ============
CREATE OR REPLACE FUNCTION public.get_estoque_saldos(_deposito_id uuid DEFAULT NULL)
RETURNS TABLE (
  deposito_id uuid, deposito_nome text, material text, unidade text,
  entradas numeric, saidas numeric, saldo numeric, custo_medio numeric, valor_saldo numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_user_empresa_id();
BEGIN
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Empresa não identificada'; END IF;
  RETURN QUERY
  SELECT d.id, d.nome, m.material, MIN(m.unidade) AS unidade,
         COALESCE(SUM(m.quantidade) FILTER (WHERE m.sentido='entrada'),0) AS entradas,
         COALESCE(SUM(m.quantidade) FILTER (WHERE m.sentido='saida'),0) AS saidas,
         COALESCE(SUM(CASE WHEN m.sentido='entrada' THEN m.quantidade ELSE -m.quantidade END),0) AS saldo,
         CASE WHEN COALESCE(SUM(m.quantidade) FILTER (WHERE m.sentido='entrada'),0) > 0
              THEN ROUND(COALESCE(SUM(m.valor_total) FILTER (WHERE m.sentido='entrada'),0)
                         / SUM(m.quantidade) FILTER (WHERE m.sentido='entrada'), 4)
              ELSE 0 END AS custo_medio,
         ROUND(
           COALESCE(SUM(CASE WHEN m.sentido='entrada' THEN m.quantidade ELSE -m.quantidade END),0)
           * CASE WHEN COALESCE(SUM(m.quantidade) FILTER (WHERE m.sentido='entrada'),0) > 0
                  THEN COALESCE(SUM(m.valor_total) FILTER (WHERE m.sentido='entrada'),0)
                       / SUM(m.quantidade) FILTER (WHERE m.sentido='entrada')
                  ELSE 0 END, 2) AS valor_saldo
    FROM public.estoque_movimentos m
    JOIN public.depositos d ON d.id = m.deposito_id AND d.empresa_id = v_emp
   WHERE m.empresa_id = v_emp
     AND (_deposito_id IS NULL OR m.deposito_id = _deposito_id)
   GROUP BY d.id, d.nome, m.material
   ORDER BY d.nome, m.material;
END $$;
REVOKE EXECUTE ON FUNCTION public.get_estoque_saldos(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_estoque_saldos(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.estoque_custo_medio(_deposito_id uuid, _material text)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN COALESCE(SUM(m.quantidade) FILTER (WHERE m.sentido='entrada'),0) > 0
              THEN ROUND(COALESCE(SUM(m.valor_total) FILTER (WHERE m.sentido='entrada'),0)
                         / SUM(m.quantidade) FILTER (WHERE m.sentido='entrada'), 4)
              ELSE 0 END
    FROM public.estoque_movimentos m
   WHERE m.empresa_id = public.get_user_empresa_id()
     AND m.deposito_id = _deposito_id
     AND lower(m.material) = lower(btrim(_material));
$$;
REVOKE EXECUTE ON FUNCTION public.estoque_custo_medio(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.estoque_custo_medio(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.estoque_saldo_item(_deposito_id uuid, _material text)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(CASE WHEN m.sentido='entrada' THEN m.quantidade ELSE -m.quantidade END),0)
    FROM public.estoque_movimentos m
   WHERE m.empresa_id = public.get_user_empresa_id()
     AND m.deposito_id = _deposito_id
     AND lower(m.material) = lower(btrim(_material));
$$;
REVOKE EXECUTE ON FUNCTION public.estoque_saldo_item(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.estoque_saldo_item(uuid, text) TO authenticated;

-- ============ movimentação ============
CREATE OR REPLACE FUNCTION public.registrar_movimento_estoque(
  _tipo text,
  _deposito_id uuid,
  _material text,
  _unidade text,
  _quantidade numeric,
  _custo_unitario numeric DEFAULT NULL,
  _deposito_destino_id uuid DEFAULT NULL,
  _obra_id uuid DEFAULT NULL,
  _etapa_id uuid DEFAULT NULL,
  _data date DEFAULT NULL,
  _responsavel_id uuid DEFAULT NULL,
  _observacoes text DEFAULT NULL,
  _sentido text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp uuid := public.get_user_empresa_id();
  v_data date := COALESCE(_data, CURRENT_DATE);
  v_custo numeric;
  v_saldo numeric;
  v_id uuid;
  v_par uuid;
  v_mat_id uuid;
  v_sentido text;
BEGIN
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Empresa não identificada'; END IF;
  IF NOT public.tenant_can_write(v_emp) THEN RAISE EXCEPTION 'Sem permissão de escrita'; END IF;
  IF NOT (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','create')) THEN
    RAISE EXCEPTION 'Sem permissão para movimentar estoque';
  END IF;
  IF _tipo NOT IN ('entrada','saida','transferencia','ajuste') THEN RAISE EXCEPTION 'Tipo inválido'; END IF;
  IF COALESCE(_quantidade,0) <= 0 THEN RAISE EXCEPTION 'Informe uma quantidade maior que zero'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.depositos d WHERE d.id = _deposito_id AND d.empresa_id = v_emp) THEN
    RAISE EXCEPTION 'Depósito não encontrado nesta empresa';
  END IF;
  IF _obra_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.obras o WHERE o.id = _obra_id AND o.empresa_id = v_emp) THEN
    RAISE EXCEPTION 'Obra não encontrada nesta empresa';
  END IF;
  IF _etapa_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.obra_etapas e WHERE e.id = _etapa_id AND e.empresa_id = v_emp) THEN
    RAISE EXCEPTION 'Etapa não encontrada nesta empresa';
  END IF;
  IF _responsavel_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.pessoas p WHERE p.id = _responsavel_id AND p.empresa_id = v_emp) THEN
    RAISE EXCEPTION 'Responsável não encontrado nesta empresa';
  END IF;

  v_custo := COALESCE(_custo_unitario, public.estoque_custo_medio(_deposito_id, _material));
  v_sentido := CASE _tipo
                 WHEN 'entrada' THEN 'entrada'
                 WHEN 'saida' THEN 'saida'
                 WHEN 'transferencia' THEN 'saida'
                 ELSE COALESCE(_sentido,'entrada') END;

  IF v_sentido = 'saida' THEN
    v_saldo := public.estoque_saldo_item(_deposito_id, _material);
    IF v_saldo < _quantidade - 0.0001 THEN
      RAISE EXCEPTION 'Saldo insuficiente de % neste depósito (disponível: %)', btrim(_material), v_saldo;
    END IF;
  END IF;

  IF _tipo = 'transferencia' THEN
    IF _deposito_destino_id IS NULL THEN RAISE EXCEPTION 'Informe o depósito de destino'; END IF;
    IF _deposito_destino_id = _deposito_id THEN RAISE EXCEPTION 'O destino deve ser outro depósito'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.depositos d WHERE d.id = _deposito_destino_id AND d.empresa_id = v_emp) THEN
      RAISE EXCEPTION 'Depósito de destino não encontrado nesta empresa';
    END IF;
    v_par := gen_random_uuid();
  END IF;

  -- saída para a obra: o custo do material entra na obra AQUI (não na compra)
  IF _tipo = 'saida' AND _obra_id IS NOT NULL THEN
    INSERT INTO public.materiais_obra
      (empresa_id, obra_id, etapa_id, descricao, unidade, quantidade, valor_unitario, valor_total,
       data_compra, observacoes, created_by)
    VALUES (v_emp, _obra_id, _etapa_id, btrim(_material), COALESCE(_unidade,'un'), _quantidade,
            v_custo, ROUND(_quantidade * v_custo, 2), v_data,
            'Saída de estoque para a obra', auth.uid())
    RETURNING id INTO v_mat_id;
  END IF;

  INSERT INTO public.estoque_movimentos
    (empresa_id, deposito_id, material, unidade, quantidade, sentido, tipo, origem,
     custo_unitario, obra_id, etapa_id, material_obra_id, transferencia_id, data, responsavel_id,
     observacoes, created_by)
  VALUES (v_emp, _deposito_id, btrim(_material), COALESCE(_unidade,'un'), _quantidade, v_sentido, _tipo,
          CASE WHEN _tipo='transferencia' THEN 'transferencia'
               WHEN _tipo='saida' AND _obra_id IS NOT NULL THEN 'requisicao'
               ELSE 'manual' END,
          v_custo, _obra_id, _etapa_id, v_mat_id, v_par, v_data, _responsavel_id, _observacoes, auth.uid())
  RETURNING id INTO v_id;

  IF _tipo = 'transferencia' THEN
    INSERT INTO public.estoque_movimentos
      (empresa_id, deposito_id, material, unidade, quantidade, sentido, tipo, origem,
       custo_unitario, obra_id, transferencia_id, data, responsavel_id, observacoes, created_by)
    SELECT v_emp, _deposito_destino_id, btrim(_material), COALESCE(_unidade,'un'), _quantidade, 'entrada',
           'transferencia', 'transferencia', v_custo, d.obra_id, v_par, v_data, _responsavel_id,
           _observacoes, auth.uid()
      FROM public.depositos d WHERE d.id = _deposito_destino_id AND d.empresa_id = v_emp;
  END IF;

  RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.registrar_movimento_estoque(text,uuid,text,text,numeric,numeric,uuid,uuid,uuid,date,uuid,text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.registrar_movimento_estoque(text,uuid,text,text,numeric,numeric,uuid,uuid,uuid,date,uuid,text,text) TO authenticated;

-- ============ recebimento da OC alimenta o estoque ============
CREATE OR REPLACE FUNCTION public.receber_ordem_compra(
  _ordem_id uuid, _data date, _numero_nf text, _itens jsonb, _observacoes text DEFAULT NULL::text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp uuid := public.get_user_empresa_id();
  v_oc public.ordens_compra%ROWTYPE;
  v_receb_id uuid;
  v_conta_id uuid;
  v_total numeric := 0;
  v_item jsonb;
  v_oci public.ordem_compra_itens%ROWTYPE;
  v_qtd numeric;
  v_recebido numeric;
  v_prazo int;
  v_i int;
  v_falta numeric;
  v_usa_estoque boolean := false;
  v_dep uuid;
BEGIN
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Empresa não identificada'; END IF;
  IF NOT (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','create')) THEN
    RAISE EXCEPTION 'Sem permissão para receber ordens de compra';
  END IF;
  IF NOT public.tenant_can_write(v_emp) THEN RAISE EXCEPTION 'Sem permissão de escrita'; END IF;

  SELECT * INTO v_oc FROM public.ordens_compra WHERE id = _ordem_id AND empresa_id = v_emp;
  IF v_oc.id IS NULL THEN RAISE EXCEPTION 'Ordem de compra não encontrada'; END IF;
  IF v_oc.status = 'cancelada' THEN RAISE EXCEPTION 'Ordem de compra cancelada'; END IF;
  IF v_oc.status = 'aguardando_aprovacao' THEN RAISE EXCEPTION 'Esta ordem de compra ainda aguarda aprovação'; END IF;
  IF _itens IS NULL OR jsonb_array_length(_itens) = 0 THEN RAISE EXCEPTION 'Informe ao menos um item recebido'; END IF;

  SELECT COALESCE(c.usa_estoque,false) INTO v_usa_estoque
    FROM public.empresa_config c WHERE c.empresa_id = v_emp;
  v_usa_estoque := COALESCE(v_usa_estoque,false);

  IF v_usa_estoque THEN
    SELECT d.id INTO v_dep FROM public.depositos d
     WHERE d.empresa_id = v_emp AND d.ativo AND d.obra_id = v_oc.obra_id
     ORDER BY d.padrao DESC, d.created_at LIMIT 1;
    IF v_dep IS NULL THEN
      SELECT d.id INTO v_dep FROM public.depositos d
       WHERE d.empresa_id = v_emp AND d.ativo AND d.obra_id IS NULL
       ORDER BY d.padrao DESC, d.created_at LIMIT 1;
    END IF;
    IF v_dep IS NULL THEN
      INSERT INTO public.depositos (empresa_id, nome, padrao, created_by)
      VALUES (v_emp, 'Depósito geral', true, auth.uid()) RETURNING id INTO v_dep;
    END IF;
  END IF;

  INSERT INTO public.ordem_compra_recebimentos (empresa_id, ordem_compra_id, data, numero_nf, observacoes)
  VALUES (v_emp, _ordem_id, COALESCE(_data, CURRENT_DATE), _numero_nf, _observacoes)
  RETURNING id INTO v_receb_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_itens) LOOP
    SELECT * INTO v_oci FROM public.ordem_compra_itens
     WHERE id = (v_item->>'ordem_compra_item_id')::uuid
       AND ordem_compra_id = _ordem_id AND empresa_id = v_emp;
    IF v_oci.id IS NULL THEN RAISE EXCEPTION 'Item não pertence a esta ordem de compra'; END IF;

    v_qtd := COALESCE((v_item->>'quantidade')::numeric, 0);
    IF v_qtd <= 0 THEN CONTINUE; END IF;

    SELECT COALESCE(SUM(ri.quantidade),0) INTO v_recebido
      FROM public.ordem_compra_recebimento_itens ri
     WHERE ri.ordem_compra_item_id = v_oci.id AND ri.empresa_id = v_emp;
    IF v_recebido + v_qtd > v_oci.quantidade + 0.0001 THEN
      RAISE EXCEPTION 'Quantidade recebida acima do pedido no item %', v_oci.descricao;
    END IF;

    INSERT INTO public.ordem_compra_recebimento_itens
      (empresa_id, recebimento_id, ordem_compra_item_id, quantidade, preco_unitario, subtotal)
    VALUES (v_emp, v_receb_id, v_oci.id, v_qtd, v_oci.preco_unitario, ROUND(v_qtd * v_oci.preco_unitario, 2));

    v_total := v_total + ROUND(v_qtd * v_oci.preco_unitario, 2);

    IF v_usa_estoque THEN
      -- com estoque: entra no depósito; o custo vai para a obra só na saída
      INSERT INTO public.estoque_movimentos
        (empresa_id, deposito_id, material, unidade, quantidade, sentido, tipo, origem,
         custo_unitario, obra_id, etapa_id, ordem_compra_id, data, observacoes, created_by)
      VALUES (v_emp, v_dep, v_oci.descricao, COALESCE(v_oci.unidade,'un'), v_qtd, 'entrada', 'entrada',
              'ordem_compra', v_oci.preco_unitario, NULL, NULL, _ordem_id,
              COALESCE(_data, CURRENT_DATE),
              'Recebimento da OC ' || COALESCE(v_oc.numero,''), auth.uid());
    ELSE
      -- sem estoque: o custo da obra entra pelo recebido
      INSERT INTO public.materiais_obra
        (empresa_id, obra_id, etapa_id, orcamento_item_id, descricao, unidade, quantidade,
         valor_unitario, valor_total, data_compra, numero_nf, fornecedor, observacoes, created_by)
      SELECT v_emp, v_oc.obra_id, v_oci.etapa_id, v_oci.orcamento_item_id, v_oci.descricao, v_oci.unidade,
             v_qtd, v_oci.preco_unitario, ROUND(v_qtd * v_oci.preco_unitario, 2),
             COALESCE(_data, CURRENT_DATE), _numero_nf, f.nome,
             'Recebimento da OC ' || COALESCE(v_oc.numero,''), auth.uid()
        FROM public.fornecedores f
       WHERE f.id = v_oc.fornecedor_id AND f.empresa_id = v_emp;
    END IF;
  END LOOP;

  IF v_total <= 0 THEN RAISE EXCEPTION 'Nenhuma quantidade informada'; END IF;

  INSERT INTO public.contas_pagar
    (empresa_id, fornecedor_id, obra_id, descricao, numero_documento, valor_total, data_emissao, status, observacoes, created_by)
  VALUES (v_emp, v_oc.fornecedor_id, v_oc.obra_id,
          'OC ' || COALESCE(v_oc.numero,'') || ' - recebimento',
          _numero_nf, v_total, COALESCE(_data, CURRENT_DATE), 'aberto',
          'Gerado pelo recebimento da ordem de compra', auth.uid())
  RETURNING id INTO v_conta_id;

  SELECT COALESCE(c.prazo_pagamento_padrao, 30) INTO v_prazo
    FROM public.empresa_config c WHERE c.empresa_id = v_emp;
  v_prazo := COALESCE(v_prazo, 30);

  FOR v_i IN 1..GREATEST(v_oc.numero_parcelas,1) LOOP
    INSERT INTO public.contas_pagar_parcelas (empresa_id, conta_id, numero, valor, data_vencimento, status)
    VALUES (v_emp, v_conta_id, v_i,
            CASE WHEN v_i = GREATEST(v_oc.numero_parcelas,1)
                 THEN ROUND(v_total - ROUND(v_total / GREATEST(v_oc.numero_parcelas,1), 2) * (GREATEST(v_oc.numero_parcelas,1) - 1), 2)
                 ELSE ROUND(v_total / GREATEST(v_oc.numero_parcelas,1), 2) END,
            COALESCE(_data, CURRENT_DATE) + (v_prazo * v_i),
            'pendente');
  END LOOP;

  SELECT COALESCE(SUM(i.quantidade),0) - COALESCE((
           SELECT SUM(ri.quantidade) FROM public.ordem_compra_recebimento_itens ri
            WHERE ri.empresa_id = v_emp
              AND ri.ordem_compra_item_id IN (SELECT id FROM public.ordem_compra_itens
                                               WHERE ordem_compra_id = _ordem_id AND empresa_id = v_emp)),0)
    INTO v_falta
    FROM public.ordem_compra_itens i
   WHERE i.ordem_compra_id = _ordem_id AND i.empresa_id = v_emp;

  UPDATE public.ordens_compra
     SET status = CASE WHEN v_falta <= 0.0001 THEN 'recebida' ELSE 'parcial' END
   WHERE id = _ordem_id AND empresa_id = v_emp;

  IF v_oc.solicitacao_id IS NOT NULL AND v_falta <= 0.0001 THEN
    UPDATE public.solicitacoes_compra SET status = 'atendida'
     WHERE id = v_oc.solicitacao_id AND empresa_id = v_emp;
  END IF;

  RETURN v_receb_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.receber_ordem_compra(uuid, date, text, jsonb, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.receber_ordem_compra(uuid, date, text, jsonb, text) TO authenticated;