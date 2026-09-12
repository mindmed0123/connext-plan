
-- ============ FORNECEDORES ============
CREATE TABLE public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT get_user_empresa_id() REFERENCES public.empresas(id),
  nome text NOT NULL,
  cnpj_cpf text,
  contato text,
  telefone text,
  email text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fornecedores TO authenticated;
GRANT ALL ON public.fornecedores TO service_role;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY forn_sel ON public.fornecedores FOR SELECT TO authenticated USING (tenant_match(empresa_id));
CREATE POLICY forn_ins ON public.fornecedores FOR INSERT TO authenticated
  WITH CHECK (tenant_can_write(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'financeiro','create')));
CREATE POLICY forn_upd ON public.fornecedores FOR UPDATE TO authenticated
  USING (tenant_can_write(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'financeiro','edit')))
  WITH CHECK (tenant_can_write(empresa_id));
CREATE POLICY forn_del ON public.fornecedores FOR DELETE TO authenticated
  USING (tenant_can_write(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'financeiro','delete')));
CREATE UNIQUE INDEX fornecedores_empresa_nome_uk ON public.fornecedores (empresa_id, lower(nome));
CREATE TRIGGER trg_fornecedores_updated BEFORE UPDATE ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CONTAS BANCÁRIAS ============
CREATE TABLE public.contas_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT get_user_empresa_id() REFERENCES public.empresas(id),
  nome text NOT NULL,
  banco text,
  agencia text,
  conta text,
  tipo text NOT NULL DEFAULT 'corrente',
  saldo_inicial numeric(14,2) NOT NULL DEFAULT 0,
  data_saldo_inicial date,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_bancarias TO authenticated;
GRANT ALL ON public.contas_bancarias TO service_role;
ALTER TABLE public.contas_bancarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY cb_sel ON public.contas_bancarias FOR SELECT TO authenticated USING (tenant_match(empresa_id));
CREATE POLICY cb_ins ON public.contas_bancarias FOR INSERT TO authenticated
  WITH CHECK (tenant_can_write(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'financeiro','create')));
CREATE POLICY cb_upd ON public.contas_bancarias FOR UPDATE TO authenticated
  USING (tenant_can_write(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'financeiro','edit')))
  WITH CHECK (tenant_can_write(empresa_id));
CREATE POLICY cb_del ON public.contas_bancarias FOR DELETE TO authenticated
  USING (tenant_can_write(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'financeiro','delete')));
CREATE UNIQUE INDEX contas_bancarias_empresa_nome_uk ON public.contas_bancarias (empresa_id, lower(nome));
CREATE TRIGGER trg_cb_updated BEFORE UPDATE ON public.contas_bancarias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- conta_bancaria_id nas tabelas de caixa
ALTER TABLE public.lancamentos_financeiros ADD COLUMN conta_bancaria_id uuid REFERENCES public.contas_bancarias(id) ON DELETE SET NULL;
ALTER TABLE public.recebimento_pagamentos ADD COLUMN conta_bancaria_id uuid REFERENCES public.contas_bancarias(id) ON DELETE SET NULL;
ALTER TABLE public.parcelas_pagamento ADD COLUMN conta_bancaria_id uuid REFERENCES public.contas_bancarias(id) ON DELETE SET NULL;
CREATE INDEX idx_lf_conta_bancaria ON public.lancamentos_financeiros (empresa_id, conta_bancaria_id);

-- migra saldo inicial da empresa para conta "Caixa"
INSERT INTO public.contas_bancarias (empresa_id, nome, banco, tipo, saldo_inicial, data_saldo_inicial)
SELECT e.id, 'Caixa', NULL, 'caixa', COALESCE(e.saldo_inicial,0), e.data_saldo_inicial
  FROM public.empresas e
 WHERE COALESCE(e.saldo_inicial,0) <> 0 OR e.data_saldo_inicial IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============ CONTAS A PAGAR ============
CREATE TABLE public.contas_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT get_user_empresa_id() REFERENCES public.empresas(id),
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  etapa_id uuid REFERENCES public.obra_etapas(id) ON DELETE SET NULL,
  categoria_id uuid REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  numero_documento text,
  valor_total numeric(14,2) NOT NULL DEFAULT 0,
  data_emissao date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'aberta',
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_pagar TO authenticated;
GRANT ALL ON public.contas_pagar TO service_role;
ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;
CREATE POLICY cp_sel ON public.contas_pagar FOR SELECT TO authenticated USING (tenant_match(empresa_id));
CREATE POLICY cp_ins ON public.contas_pagar FOR INSERT TO authenticated
  WITH CHECK (
    tenant_can_write(empresa_id)
    AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'financeiro','create'))
    AND (fornecedor_id IS NULL OR EXISTS (SELECT 1 FROM public.fornecedores f WHERE f.id = fornecedor_id AND f.empresa_id = empresa_id))
    AND (obra_id IS NULL OR EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_id AND o.empresa_id = empresa_id))
    AND (etapa_id IS NULL OR EXISTS (SELECT 1 FROM public.obra_etapas et WHERE et.id = etapa_id AND et.empresa_id = empresa_id))
    AND (categoria_id IS NULL OR EXISTS (SELECT 1 FROM public.categorias_financeiras c WHERE c.id = categoria_id AND c.empresa_id = empresa_id))
  );
CREATE POLICY cp_upd ON public.contas_pagar FOR UPDATE TO authenticated
  USING (
    tenant_can_write(empresa_id)
    AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'financeiro','edit'))
    AND (fornecedor_id IS NULL OR EXISTS (SELECT 1 FROM public.fornecedores f WHERE f.id = fornecedor_id AND f.empresa_id = empresa_id))
    AND (obra_id IS NULL OR EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_id AND o.empresa_id = empresa_id))
  )
  WITH CHECK (
    tenant_can_write(empresa_id)
    AND (fornecedor_id IS NULL OR EXISTS (SELECT 1 FROM public.fornecedores f WHERE f.id = fornecedor_id AND f.empresa_id = empresa_id))
    AND (obra_id IS NULL OR EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_id AND o.empresa_id = empresa_id))
    AND (etapa_id IS NULL OR EXISTS (SELECT 1 FROM public.obra_etapas et WHERE et.id = etapa_id AND et.empresa_id = empresa_id))
    AND (categoria_id IS NULL OR EXISTS (SELECT 1 FROM public.categorias_financeiras c WHERE c.id = categoria_id AND c.empresa_id = empresa_id))
  );
CREATE POLICY cp_del ON public.contas_pagar FOR DELETE TO authenticated
  USING (tenant_can_write(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'financeiro','delete')));
CREATE INDEX idx_cp_empresa ON public.contas_pagar (empresa_id, status);
CREATE TRIGGER trg_cp_updated BEFORE UPDATE ON public.contas_pagar
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.contas_pagar_parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT get_user_empresa_id() REFERENCES public.empresas(id),
  conta_id uuid NOT NULL REFERENCES public.contas_pagar(id) ON DELETE CASCADE,
  numero integer NOT NULL DEFAULT 1,
  valor numeric(14,2) NOT NULL CHECK (valor > 0),
  data_vencimento date NOT NULL,
  data_pagamento date,
  valor_pago numeric(14,2),
  forma_pagamento public.forma_pagamento,
  conta_bancaria_id uuid REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
  comprovante_url text,
  status text NOT NULL DEFAULT 'aberta',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_pagar_parcelas TO authenticated;
GRANT ALL ON public.contas_pagar_parcelas TO service_role;
ALTER TABLE public.contas_pagar_parcelas ENABLE ROW LEVEL SECURITY;
CREATE POLICY cpp_sel ON public.contas_pagar_parcelas FOR SELECT TO authenticated USING (tenant_match(empresa_id));
CREATE POLICY cpp_ins ON public.contas_pagar_parcelas FOR INSERT TO authenticated
  WITH CHECK (
    tenant_can_write(empresa_id)
    AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'financeiro','create'))
    AND EXISTS (SELECT 1 FROM public.contas_pagar cp WHERE cp.id = conta_id AND cp.empresa_id = empresa_id)
    AND (conta_bancaria_id IS NULL OR EXISTS (SELECT 1 FROM public.contas_bancarias b WHERE b.id = conta_bancaria_id AND b.empresa_id = empresa_id))
  );
CREATE POLICY cpp_upd ON public.contas_pagar_parcelas FOR UPDATE TO authenticated
  USING (
    tenant_can_write(empresa_id)
    AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'financeiro','edit'))
    AND EXISTS (SELECT 1 FROM public.contas_pagar cp WHERE cp.id = conta_id AND cp.empresa_id = empresa_id)
  )
  WITH CHECK (
    tenant_can_write(empresa_id)
    AND EXISTS (SELECT 1 FROM public.contas_pagar cp WHERE cp.id = conta_id AND cp.empresa_id = empresa_id)
    AND (conta_bancaria_id IS NULL OR EXISTS (SELECT 1 FROM public.contas_bancarias b WHERE b.id = conta_bancaria_id AND b.empresa_id = empresa_id))
  );
CREATE POLICY cpp_del ON public.contas_pagar_parcelas FOR DELETE TO authenticated
  USING (tenant_can_write(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'financeiro','delete')));
CREATE UNIQUE INDEX cpp_conta_numero_uk ON public.contas_pagar_parcelas (empresa_id, conta_id, numero);
CREATE INDEX idx_cpp_venc ON public.contas_pagar_parcelas (empresa_id, data_vencimento, status);
CREATE TRIGGER trg_cpp_updated BEFORE UPDATE ON public.contas_pagar_parcelas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- parcela -> razão (origem 'conta_pagar')
CREATE OR REPLACE FUNCTION public.fn_conta_pagar_to_lancamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cp record; v_forn text; v_cat uuid;
BEGIN
  PERFORM set_config('app.sync','on',true);
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lancamentos_financeiros
     WHERE origem = 'conta_pagar' AND origem_id = OLD.id AND empresa_id = OLD.empresa_id;
    RETURN OLD;
  END IF;

  SELECT * INTO v_cp FROM public.contas_pagar WHERE id = NEW.conta_id;
  IF v_cp.id IS NULL OR v_cp.empresa_id IS DISTINCT FROM NEW.empresa_id THEN
    RAISE EXCEPTION 'Conta a pagar de outra empresa';
  END IF;
  IF NEW.conta_bancaria_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.contas_bancarias b WHERE b.id = NEW.conta_bancaria_id AND b.empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Conta bancária de outra empresa';
  END IF;

  SELECT f.nome INTO v_forn FROM public.fornecedores f
   WHERE f.id = v_cp.fornecedor_id AND f.empresa_id = NEW.empresa_id;
  v_cat := COALESCE(v_cp.categoria_id, public.categoria_por_papel(NEW.empresa_id,'material'));

  INSERT INTO public.lancamentos_financeiros (
    empresa_id, obra_id, etapa_id, categoria_id, conta_bancaria_id, tipo, status, descricao, valor,
    data_competencia, data_vencimento, data_realizado, forma_pagamento, fornecedor_nome,
    documento_num, comprovante_url, origem, origem_id
  ) VALUES (
    NEW.empresa_id, v_cp.obra_id, v_cp.etapa_id, v_cat, NEW.conta_bancaria_id,
    'despesa'::public.lancamento_tipo,
    (CASE WHEN NEW.data_pagamento IS NOT NULL THEN 'realizado' ELSE 'previsto' END)::public.lancamento_status,
    v_cp.descricao || ' (' || NEW.numero || ')',
    COALESCE(NEW.valor_pago, NEW.valor),
    v_cp.data_emissao, NEW.data_vencimento, NEW.data_pagamento,
    NEW.forma_pagamento, v_forn, v_cp.numero_documento, NEW.comprovante_url,
    'conta_pagar', NEW.id
  )
  ON CONFLICT (origem, origem_id) DO UPDATE SET
    empresa_id = EXCLUDED.empresa_id, obra_id = EXCLUDED.obra_id, etapa_id = EXCLUDED.etapa_id,
    categoria_id = EXCLUDED.categoria_id, conta_bancaria_id = EXCLUDED.conta_bancaria_id,
    status = EXCLUDED.status, descricao = EXCLUDED.descricao, valor = EXCLUDED.valor,
    data_competencia = EXCLUDED.data_competencia, data_vencimento = EXCLUDED.data_vencimento,
    data_realizado = EXCLUDED.data_realizado, forma_pagamento = EXCLUDED.forma_pagamento,
    fornecedor_nome = EXCLUDED.fornecedor_nome, documento_num = EXCLUDED.documento_num,
    comprovante_url = EXCLUDED.comprovante_url, updated_at = now();

  NEW.status := CASE WHEN NEW.data_pagamento IS NOT NULL THEN 'paga' ELSE 'aberta' END;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_cpp_lancamento
  AFTER INSERT OR UPDATE OR DELETE ON public.contas_pagar_parcelas
  FOR EACH ROW EXECUTE FUNCTION public.fn_conta_pagar_to_lancamento();

-- status da parcela e da conta
CREATE OR REPLACE FUNCTION public.fn_cpp_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.status := CASE WHEN NEW.data_pagamento IS NOT NULL THEN 'paga' ELSE 'aberta' END;
  IF NEW.data_pagamento IS NOT NULL AND NEW.valor_pago IS NULL THEN NEW.valor_pago := NEW.valor; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_cpp_status BEFORE INSERT OR UPDATE ON public.contas_pagar_parcelas
  FOR EACH ROW EXECUTE FUNCTION public.fn_cpp_status();

CREATE OR REPLACE FUNCTION public.fn_cp_recalc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_conta uuid; v_emp uuid; v_abertas int; v_total numeric;
BEGIN
  v_conta := COALESCE(NEW.conta_id, OLD.conta_id);
  v_emp := COALESCE(NEW.empresa_id, OLD.empresa_id);
  SELECT COUNT(*) FILTER (WHERE data_pagamento IS NULL), COALESCE(SUM(valor),0)
    INTO v_abertas, v_total
    FROM public.contas_pagar_parcelas WHERE conta_id = v_conta AND empresa_id = v_emp;
  UPDATE public.contas_pagar
     SET status = CASE WHEN v_abertas = 0 THEN 'paga' ELSE 'aberta' END,
         valor_total = GREATEST(v_total, 0), updated_at = now()
   WHERE id = v_conta AND empresa_id = v_emp;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_cp_recalc AFTER INSERT OR UPDATE OR DELETE ON public.contas_pagar_parcelas
  FOR EACH ROW EXECUTE FUNCTION public.fn_cp_recalc();

-- ============ EXTRATO BANCÁRIO ============
CREATE TABLE public.extrato_bancario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT get_user_empresa_id() REFERENCES public.empresas(id),
  conta_id uuid NOT NULL REFERENCES public.contas_bancarias(id) ON DELETE CASCADE,
  data date NOT NULL,
  descricao text NOT NULL,
  valor numeric(14,2) NOT NULL,
  documento text,
  hash_unico text NOT NULL,
  conciliado boolean NOT NULL DEFAULT false,
  lancamento_id uuid REFERENCES public.lancamentos_financeiros(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extrato_bancario TO authenticated;
GRANT ALL ON public.extrato_bancario TO service_role;
ALTER TABLE public.extrato_bancario ENABLE ROW LEVEL SECURITY;
CREATE POLICY eb_sel ON public.extrato_bancario FOR SELECT TO authenticated USING (tenant_match(empresa_id));
CREATE POLICY eb_ins ON public.extrato_bancario FOR INSERT TO authenticated
  WITH CHECK (
    tenant_can_write(empresa_id)
    AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'financeiro','create'))
    AND EXISTS (SELECT 1 FROM public.contas_bancarias b WHERE b.id = conta_id AND b.empresa_id = empresa_id)
  );
CREATE POLICY eb_upd ON public.extrato_bancario FOR UPDATE TO authenticated
  USING (
    tenant_can_write(empresa_id)
    AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'financeiro','edit'))
    AND EXISTS (SELECT 1 FROM public.contas_bancarias b WHERE b.id = conta_id AND b.empresa_id = empresa_id)
  )
  WITH CHECK (
    tenant_can_write(empresa_id)
    AND EXISTS (SELECT 1 FROM public.contas_bancarias b WHERE b.id = conta_id AND b.empresa_id = empresa_id)
    AND (lancamento_id IS NULL OR EXISTS (SELECT 1 FROM public.lancamentos_financeiros lf WHERE lf.id = lancamento_id AND lf.empresa_id = empresa_id))
  );
CREATE POLICY eb_del ON public.extrato_bancario FOR DELETE TO authenticated
  USING (tenant_can_write(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'financeiro','delete')));
CREATE UNIQUE INDEX extrato_hash_uk ON public.extrato_bancario (empresa_id, conta_id, hash_unico);
CREATE INDEX idx_extrato_conc ON public.extrato_bancario (empresa_id, conta_id, conciliado, data);
CREATE TRIGGER trg_eb_updated BEFORE UPDATE ON public.extrato_bancario
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
