-- ============ SOLICITAÇÕES DE COMPRA ============
CREATE TABLE public.solicitacoes_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) DEFAULT public.get_user_empresa_id(),
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  etapa_id uuid REFERENCES public.obra_etapas(id) ON DELETE SET NULL,
  solicitante_id uuid REFERENCES public.pessoas(id) ON DELETE SET NULL,
  numero text,
  data date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','aberta','cotando','aprovada','reprovada','atendida')),
  observacoes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_solicitacoes_compra_empresa ON public.solicitacoes_compra(empresa_id, data DESC);
CREATE UNIQUE INDEX uq_solicitacoes_compra_numero ON public.solicitacoes_compra(empresa_id, numero) WHERE numero IS NOT NULL;

CREATE TABLE public.solicitacao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) DEFAULT public.get_user_empresa_id(),
  solicitacao_id uuid NOT NULL REFERENCES public.solicitacoes_compra(id) ON DELETE CASCADE,
  orcamento_item_id uuid REFERENCES public.orcamento_itens(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  unidade text NOT NULL DEFAULT 'un',
  quantidade numeric NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  observacao text,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_solicitacao_itens_sol ON public.solicitacao_itens(empresa_id, solicitacao_id);

-- ============ COTAÇÕES ============
CREATE TABLE public.cotacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) DEFAULT public.get_user_empresa_id(),
  solicitacao_id uuid NOT NULL REFERENCES public.solicitacoes_compra(id) ON DELETE CASCADE,
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
  data date NOT NULL DEFAULT CURRENT_DATE,
  validade date,
  condicao_pagamento text,
  prazo_entrega text,
  frete numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'recebida' CHECK (status IN ('solicitada','recebida','escolhida','descartada')),
  observacoes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cotacoes_sol ON public.cotacoes(empresa_id, solicitacao_id);
CREATE UNIQUE INDEX uq_cotacoes_sol_forn ON public.cotacoes(empresa_id, solicitacao_id, fornecedor_id);

CREATE TABLE public.cotacao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) DEFAULT public.get_user_empresa_id(),
  cotacao_id uuid NOT NULL REFERENCES public.cotacoes(id) ON DELETE CASCADE,
  solicitacao_item_id uuid NOT NULL REFERENCES public.solicitacao_itens(id) ON DELETE CASCADE,
  preco_unitario numeric NOT NULL DEFAULT 0 CHECK (preco_unitario >= 0),
  marca text,
  prazo text,
  disponivel boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cotacao_itens_cot ON public.cotacao_itens(empresa_id, cotacao_id);
CREATE UNIQUE INDEX uq_cotacao_itens ON public.cotacao_itens(empresa_id, cotacao_id, solicitacao_item_id);

-- ============ ORDENS DE COMPRA ============
CREATE TABLE public.ordens_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) DEFAULT public.get_user_empresa_id(),
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE RESTRICT,
  solicitacao_id uuid REFERENCES public.solicitacoes_compra(id) ON DELETE SET NULL,
  numero text,
  data date NOT NULL DEFAULT CURRENT_DATE,
  condicao_pagamento text,
  numero_parcelas integer NOT NULL DEFAULT 1 CHECK (numero_parcelas >= 1),
  intervalo_parcelas integer NOT NULL DEFAULT 30 CHECK (intervalo_parcelas >= 0),
  prazo_entrega text,
  frete numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'emitida' CHECK (status IN ('emitida','parcial','recebida','cancelada')),
  observacoes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ordens_compra_empresa ON public.ordens_compra(empresa_id, data DESC);
CREATE UNIQUE INDEX uq_ordens_compra_numero ON public.ordens_compra(empresa_id, numero) WHERE numero IS NOT NULL;

CREATE TABLE public.ordem_compra_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) DEFAULT public.get_user_empresa_id(),
  ordem_compra_id uuid NOT NULL REFERENCES public.ordens_compra(id) ON DELETE CASCADE,
  solicitacao_item_id uuid REFERENCES public.solicitacao_itens(id) ON DELETE SET NULL,
  etapa_id uuid REFERENCES public.obra_etapas(id) ON DELETE SET NULL,
  orcamento_item_id uuid REFERENCES public.orcamento_itens(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  unidade text NOT NULL DEFAULT 'un',
  quantidade numeric NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  preco_unitario numeric NOT NULL DEFAULT 0 CHECK (preco_unitario >= 0),
  subtotal numeric NOT NULL DEFAULT 0,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_oc_itens_oc ON public.ordem_compra_itens(empresa_id, ordem_compra_id);

-- ============ RECEBIMENTOS ============
CREATE TABLE public.ordem_compra_recebimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) DEFAULT public.get_user_empresa_id(),
  ordem_compra_id uuid NOT NULL REFERENCES public.ordens_compra(id) ON DELETE CASCADE,
  conta_pagar_id uuid REFERENCES public.contas_pagar(id) ON DELETE SET NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  numero_nf text,
  valor_total numeric NOT NULL DEFAULT 0,
  observacoes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_oc_receb_oc ON public.ordem_compra_recebimentos(empresa_id, ordem_compra_id);

CREATE TABLE public.ordem_compra_recebimento_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) DEFAULT public.get_user_empresa_id(),
  recebimento_id uuid NOT NULL REFERENCES public.ordem_compra_recebimentos(id) ON DELETE CASCADE,
  ordem_compra_item_id uuid NOT NULL REFERENCES public.ordem_compra_itens(id) ON DELETE CASCADE,
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  preco_unitario numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_oc_receb_itens ON public.ordem_compra_recebimento_itens(empresa_id, recebimento_id);

-- ============ GRANTS ============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitacoes_compra TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitacao_itens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cotacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cotacao_itens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordens_compra TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordem_compra_itens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordem_compra_recebimentos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordem_compra_recebimento_itens TO authenticated;
GRANT ALL ON public.solicitacoes_compra TO service_role;
GRANT ALL ON public.solicitacao_itens TO service_role;
GRANT ALL ON public.cotacoes TO service_role;
GRANT ALL ON public.cotacao_itens TO service_role;
GRANT ALL ON public.ordens_compra TO service_role;
GRANT ALL ON public.ordem_compra_itens TO service_role;
GRANT ALL ON public.ordem_compra_recebimentos TO service_role;
GRANT ALL ON public.ordem_compra_recebimento_itens TO service_role;

ALTER TABLE public.solicitacoes_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordem_compra_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordem_compra_recebimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordem_compra_recebimento_itens ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES ============
-- solicitacoes_compra
CREATE POLICY "sc_select" ON public.solicitacoes_compra FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY "sc_insert" ON public.solicitacoes_compra FOR INSERT TO authenticated
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','create'))
    AND public.mesmo_tenant('public.obras', obra_id, empresa_id)
    AND public.mesmo_tenant('public.obra_etapas', etapa_id, empresa_id)
    AND public.mesmo_tenant('public.pessoas', solicitante_id, empresa_id));
CREATE POLICY "sc_update" ON public.solicitacoes_compra FOR UPDATE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','edit'))
    AND public.mesmo_tenant('public.obras', obra_id, empresa_id)
    AND public.mesmo_tenant('public.obra_etapas', etapa_id, empresa_id)
    AND public.mesmo_tenant('public.pessoas', solicitante_id, empresa_id))
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND public.mesmo_tenant('public.obras', obra_id, empresa_id)
    AND public.mesmo_tenant('public.obra_etapas', etapa_id, empresa_id)
    AND public.mesmo_tenant('public.pessoas', solicitante_id, empresa_id));
CREATE POLICY "sc_delete" ON public.solicitacoes_compra FOR DELETE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','delete')));

-- solicitacao_itens
CREATE POLICY "si_select" ON public.solicitacao_itens FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY "si_insert" ON public.solicitacao_itens FOR INSERT TO authenticated
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','create'))
    AND public.mesmo_tenant('public.solicitacoes_compra', solicitacao_id, empresa_id)
    AND public.mesmo_tenant('public.orcamento_itens', orcamento_item_id, empresa_id));
CREATE POLICY "si_update" ON public.solicitacao_itens FOR UPDATE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','edit'))
    AND public.mesmo_tenant('public.solicitacoes_compra', solicitacao_id, empresa_id)
    AND public.mesmo_tenant('public.orcamento_itens', orcamento_item_id, empresa_id))
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND public.mesmo_tenant('public.solicitacoes_compra', solicitacao_id, empresa_id)
    AND public.mesmo_tenant('public.orcamento_itens', orcamento_item_id, empresa_id));
CREATE POLICY "si_delete" ON public.solicitacao_itens FOR DELETE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','delete')));

-- cotacoes
CREATE POLICY "cot_select" ON public.cotacoes FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY "cot_insert" ON public.cotacoes FOR INSERT TO authenticated
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','create'))
    AND public.mesmo_tenant('public.solicitacoes_compra', solicitacao_id, empresa_id)
    AND public.mesmo_tenant('public.fornecedores', fornecedor_id, empresa_id));
CREATE POLICY "cot_update" ON public.cotacoes FOR UPDATE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','edit'))
    AND public.mesmo_tenant('public.solicitacoes_compra', solicitacao_id, empresa_id)
    AND public.mesmo_tenant('public.fornecedores', fornecedor_id, empresa_id))
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND public.mesmo_tenant('public.solicitacoes_compra', solicitacao_id, empresa_id)
    AND public.mesmo_tenant('public.fornecedores', fornecedor_id, empresa_id));
CREATE POLICY "cot_delete" ON public.cotacoes FOR DELETE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','delete')));

-- cotacao_itens
CREATE POLICY "coti_select" ON public.cotacao_itens FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY "coti_insert" ON public.cotacao_itens FOR INSERT TO authenticated
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','create'))
    AND public.mesmo_tenant('public.cotacoes', cotacao_id, empresa_id)
    AND public.mesmo_tenant('public.solicitacao_itens', solicitacao_item_id, empresa_id));
CREATE POLICY "coti_update" ON public.cotacao_itens FOR UPDATE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','edit'))
    AND public.mesmo_tenant('public.cotacoes', cotacao_id, empresa_id)
    AND public.mesmo_tenant('public.solicitacao_itens', solicitacao_item_id, empresa_id))
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND public.mesmo_tenant('public.cotacoes', cotacao_id, empresa_id)
    AND public.mesmo_tenant('public.solicitacao_itens', solicitacao_item_id, empresa_id));
CREATE POLICY "coti_delete" ON public.cotacao_itens FOR DELETE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','delete')));

-- ordens_compra
CREATE POLICY "oc_select" ON public.ordens_compra FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY "oc_insert" ON public.ordens_compra FOR INSERT TO authenticated
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','create'))
    AND public.mesmo_tenant('public.fornecedores', fornecedor_id, empresa_id)
    AND public.mesmo_tenant('public.obras', obra_id, empresa_id)
    AND public.mesmo_tenant('public.solicitacoes_compra', solicitacao_id, empresa_id));
CREATE POLICY "oc_update" ON public.ordens_compra FOR UPDATE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','edit'))
    AND public.mesmo_tenant('public.fornecedores', fornecedor_id, empresa_id)
    AND public.mesmo_tenant('public.obras', obra_id, empresa_id)
    AND public.mesmo_tenant('public.solicitacoes_compra', solicitacao_id, empresa_id))
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND public.mesmo_tenant('public.fornecedores', fornecedor_id, empresa_id)
    AND public.mesmo_tenant('public.obras', obra_id, empresa_id)
    AND public.mesmo_tenant('public.solicitacoes_compra', solicitacao_id, empresa_id));
CREATE POLICY "oc_delete" ON public.ordens_compra FOR DELETE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','delete')));

-- ordem_compra_itens
CREATE POLICY "oci_select" ON public.ordem_compra_itens FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY "oci_insert" ON public.ordem_compra_itens FOR INSERT TO authenticated
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','create'))
    AND public.mesmo_tenant('public.ordens_compra', ordem_compra_id, empresa_id)
    AND public.mesmo_tenant('public.solicitacao_itens', solicitacao_item_id, empresa_id)
    AND public.mesmo_tenant('public.obra_etapas', etapa_id, empresa_id)
    AND public.mesmo_tenant('public.orcamento_itens', orcamento_item_id, empresa_id));
CREATE POLICY "oci_update" ON public.ordem_compra_itens FOR UPDATE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','edit'))
    AND public.mesmo_tenant('public.ordens_compra', ordem_compra_id, empresa_id)
    AND public.mesmo_tenant('public.solicitacao_itens', solicitacao_item_id, empresa_id)
    AND public.mesmo_tenant('public.obra_etapas', etapa_id, empresa_id)
    AND public.mesmo_tenant('public.orcamento_itens', orcamento_item_id, empresa_id))
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND public.mesmo_tenant('public.ordens_compra', ordem_compra_id, empresa_id)
    AND public.mesmo_tenant('public.solicitacao_itens', solicitacao_item_id, empresa_id)
    AND public.mesmo_tenant('public.obra_etapas', etapa_id, empresa_id)
    AND public.mesmo_tenant('public.orcamento_itens', orcamento_item_id, empresa_id));
CREATE POLICY "oci_delete" ON public.ordem_compra_itens FOR DELETE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','delete')));

-- ordem_compra_recebimentos
CREATE POLICY "ocr_select" ON public.ordem_compra_recebimentos FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY "ocr_insert" ON public.ordem_compra_recebimentos FOR INSERT TO authenticated
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','create'))
    AND public.mesmo_tenant('public.ordens_compra', ordem_compra_id, empresa_id)
    AND public.mesmo_tenant('public.contas_pagar', conta_pagar_id, empresa_id));
CREATE POLICY "ocr_update" ON public.ordem_compra_recebimentos FOR UPDATE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','edit'))
    AND public.mesmo_tenant('public.ordens_compra', ordem_compra_id, empresa_id)
    AND public.mesmo_tenant('public.contas_pagar', conta_pagar_id, empresa_id))
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND public.mesmo_tenant('public.ordens_compra', ordem_compra_id, empresa_id)
    AND public.mesmo_tenant('public.contas_pagar', conta_pagar_id, empresa_id));
CREATE POLICY "ocr_delete" ON public.ordem_compra_recebimentos FOR DELETE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','delete')));

-- ordem_compra_recebimento_itens
CREATE POLICY "ocri_select" ON public.ordem_compra_recebimento_itens FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY "ocri_insert" ON public.ordem_compra_recebimento_itens FOR INSERT TO authenticated
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','create'))
    AND public.mesmo_tenant('public.ordem_compra_recebimentos', recebimento_id, empresa_id)
    AND public.mesmo_tenant('public.ordem_compra_itens', ordem_compra_item_id, empresa_id));
CREATE POLICY "ocri_update" ON public.ordem_compra_recebimento_itens FOR UPDATE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','edit'))
    AND public.mesmo_tenant('public.ordem_compra_recebimentos', recebimento_id, empresa_id)
    AND public.mesmo_tenant('public.ordem_compra_itens', ordem_compra_item_id, empresa_id))
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND public.mesmo_tenant('public.ordem_compra_recebimentos', recebimento_id, empresa_id)
    AND public.mesmo_tenant('public.ordem_compra_itens', ordem_compra_item_id, empresa_id));
CREATE POLICY "ocri_delete" ON public.ordem_compra_recebimento_itens FOR DELETE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','delete')));

-- ============ TRIGGERS ============
CREATE TRIGGER trg_sc_updated BEFORE UPDATE ON public.solicitacoes_compra FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_si_updated BEFORE UPDATE ON public.solicitacao_itens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cot_updated BEFORE UPDATE ON public.cotacoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_coti_updated BEFORE UPDATE ON public.cotacao_itens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_oc_updated BEFORE UPDATE ON public.ordens_compra FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_oci_updated BEFORE UPDATE ON public.ordem_compra_itens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ocr_updated BEFORE UPDATE ON public.ordem_compra_recebimentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- numeração por empresa
CREATE OR REPLACE FUNCTION public.fn_compras_set_numero()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.empresa_id IS NULL THEN RAISE EXCEPTION 'Empresa não informada'; END IF;
  IF NEW.numero IS NULL OR btrim(NEW.numero) = '' THEN
    NEW.numero := public.proximo_numero_documento(NEW.empresa_id, TG_ARGV[0], NEW.data);
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.fn_compras_set_numero() FROM anon, public;

CREATE TRIGGER trg_sc_numero BEFORE INSERT ON public.solicitacoes_compra
  FOR EACH ROW EXECUTE FUNCTION public.fn_compras_set_numero('sc');
CREATE TRIGGER trg_oc_numero BEFORE INSERT ON public.ordens_compra
  FOR EACH ROW EXECUTE FUNCTION public.fn_compras_set_numero('oc');

-- subtotal e total da OC
CREATE OR REPLACE FUNCTION public.fn_oc_item_subtotal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid;
BEGIN
  SELECT empresa_id INTO v_emp FROM public.ordens_compra WHERE id = NEW.ordem_compra_id;
  IF v_emp IS NULL OR v_emp IS DISTINCT FROM NEW.empresa_id THEN
    RAISE EXCEPTION 'Ordem de compra de outra empresa';
  END IF;
  NEW.subtotal := ROUND(COALESCE(NEW.quantidade,0) * COALESCE(NEW.preco_unitario,0), 2);
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.fn_oc_item_subtotal() FROM anon, public;
CREATE TRIGGER trg_oci_subtotal BEFORE INSERT OR UPDATE ON public.ordem_compra_itens
  FOR EACH ROW EXECUTE FUNCTION public.fn_oc_item_subtotal();

CREATE OR REPLACE FUNCTION public.fn_oc_recalc_total()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_oc uuid; v_emp uuid;
BEGIN
  v_oc := COALESCE(NEW.ordem_compra_id, OLD.ordem_compra_id);
  v_emp := COALESCE(NEW.empresa_id, OLD.empresa_id);
  UPDATE public.ordens_compra o
     SET valor_total = COALESCE((SELECT SUM(i.subtotal) FROM public.ordem_compra_itens i
                                  WHERE i.ordem_compra_id = v_oc AND i.empresa_id = v_emp), 0) + COALESCE(o.frete, 0),
         updated_at = now()
   WHERE o.id = v_oc AND o.empresa_id = v_emp;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.fn_oc_recalc_total() FROM anon, public;
CREATE TRIGGER trg_oci_total AFTER INSERT OR UPDATE OR DELETE ON public.ordem_compra_itens
  FOR EACH ROW EXECUTE FUNCTION public.fn_oc_recalc_total();

-- ============ RECEBIMENTO (gera contas a pagar + custo da obra) ============
CREATE OR REPLACE FUNCTION public.receber_ordem_compra(
  _ordem_id uuid,
  _data date,
  _numero_nf text,
  _itens jsonb,
  _observacoes text DEFAULT NULL
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
BEGIN
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Empresa não identificada'; END IF;
  IF NOT (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','create')) THEN
    RAISE EXCEPTION 'Sem permissão para receber ordens de compra';
  END IF;
  IF NOT public.tenant_can_write(v_emp) THEN RAISE EXCEPTION 'Sem permissão de escrita'; END IF;

  SELECT * INTO v_oc FROM public.ordens_compra WHERE id = _ordem_id AND empresa_id = v_emp;
  IF v_oc.id IS NULL THEN RAISE EXCEPTION 'Ordem de compra não encontrada'; END IF;
  IF v_oc.status = 'cancelada' THEN RAISE EXCEPTION 'Ordem de compra cancelada'; END IF;
  IF _itens IS NULL OR jsonb_array_length(_itens) = 0 THEN RAISE EXCEPTION 'Informe ao menos um item recebido'; END IF;

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

    -- custo da obra entra apenas pelo recebido
    INSERT INTO public.materiais_obra
      (empresa_id, obra_id, etapa_id, orcamento_item_id, descricao, unidade, quantidade,
       valor_unitario, valor_total, data_compra, numero_nf, fornecedor, observacoes, created_by)
    SELECT v_emp, v_oc.obra_id, v_oci.etapa_id, v_oci.orcamento_item_id, v_oci.descricao, v_oci.unidade,
           v_qtd, v_oci.preco_unitario, ROUND(v_qtd * v_oci.preco_unitario, 2),
           COALESCE(_data, CURRENT_DATE), _numero_nf, f.nome,
           'Recebimento da OC ' || COALESCE(v_oc.numero,''), auth.uid()
      FROM public.fornecedores f
     WHERE f.id = v_oc.fornecedor_id AND f.empresa_id = v_emp;
  END LOOP;

  IF v_total <= 0 THEN RAISE EXCEPTION 'Nenhuma quantidade informada'; END IF;

  -- título em contas a pagar
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
            CASE WHEN v_i = v_oc.numero_parcelas
                 THEN ROUND(v_total - ROUND(v_total / v_oc.numero_parcelas, 2) * (v_oc.numero_parcelas - 1), 2)
                 ELSE ROUND(v_total / v_oc.numero_parcelas, 2) END,
            COALESCE(_data, CURRENT_DATE) + ((v_i - 1) * v_oc.intervalo_parcelas + v_prazo),
            'pendente');
  END LOOP;

  UPDATE public.ordem_compra_recebimentos
     SET valor_total = v_total, conta_pagar_id = v_conta_id, updated_at = now()
   WHERE id = v_receb_id AND empresa_id = v_emp;

  SELECT COALESCE(SUM(i.quantidade),0) - COALESCE((
           SELECT SUM(ri.quantidade) FROM public.ordem_compra_recebimento_itens ri
            JOIN public.ordem_compra_itens oi ON oi.id = ri.ordem_compra_item_id
            WHERE oi.ordem_compra_id = _ordem_id AND ri.empresa_id = v_emp), 0)
    INTO v_falta
    FROM public.ordem_compra_itens i
   WHERE i.ordem_compra_id = _ordem_id AND i.empresa_id = v_emp;

  UPDATE public.ordens_compra
     SET status = CASE WHEN v_falta <= 0.0001 THEN 'recebida' ELSE 'parcial' END,
         updated_at = now()
   WHERE id = _ordem_id AND empresa_id = v_emp;

  IF v_oc.solicitacao_id IS NOT NULL AND v_falta <= 0.0001 THEN
    UPDATE public.solicitacoes_compra SET status = 'atendida', updated_at = now()
     WHERE id = v_oc.solicitacao_id AND empresa_id = v_emp;
  END IF;

  RETURN v_receb_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.receber_ordem_compra(uuid, date, text, jsonb, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.receber_ordem_compra(uuid, date, text, jsonb, text) TO authenticated;