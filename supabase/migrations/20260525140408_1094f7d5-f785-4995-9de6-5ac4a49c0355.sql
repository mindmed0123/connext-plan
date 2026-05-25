
-- =========== COMPRADORES ===========
CREATE TABLE public.compradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL DEFAULT public.get_user_empresa_id(),
  nome TEXT NOT NULL,
  cpf_cnpj TEXT,
  email TEXT,
  telefone TEXT,
  cargo TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_compradores_empresa ON public.compradores(empresa_id);
ALTER TABLE public.compradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY comp_sel ON public.compradores FOR SELECT TO authenticated
  USING (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'financeiro','view')));
CREATE POLICY comp_ins ON public.compradores FOR INSERT TO authenticated
  WITH CHECK (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'financeiro','create')));
CREATE POLICY comp_upd ON public.compradores FOR UPDATE TO authenticated
  USING (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'financeiro','edit')));
CREATE POLICY comp_del ON public.compradores FOR DELETE TO authenticated
  USING (tenant_match(empresa_id) AND is_admin_or_super(auth.uid()));

CREATE TRIGGER trg_compradores_updated BEFORE UPDATE ON public.compradores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========== CARTÕES DE CRÉDITO ===========
CREATE TABLE public.cartoes_credito (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL DEFAULT public.get_user_empresa_id(),
  apelido TEXT NOT NULL,
  banco TEXT,
  bandeira TEXT,
  ultimos_4 TEXT,
  titular TEXT,
  limite NUMERIC NOT NULL DEFAULT 0,
  dia_fechamento INTEGER,
  dia_vencimento INTEGER,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cartoes_empresa ON public.cartoes_credito(empresa_id);
ALTER TABLE public.cartoes_credito ENABLE ROW LEVEL SECURITY;

CREATE POLICY cart_sel ON public.cartoes_credito FOR SELECT TO authenticated
  USING (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'financeiro','view')));
CREATE POLICY cart_ins ON public.cartoes_credito FOR INSERT TO authenticated
  WITH CHECK (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'financeiro','create')));
CREATE POLICY cart_upd ON public.cartoes_credito FOR UPDATE TO authenticated
  USING (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'financeiro','edit')));
CREATE POLICY cart_del ON public.cartoes_credito FOR DELETE TO authenticated
  USING (tenant_match(empresa_id) AND is_admin_or_super(auth.uid()));

CREATE TRIGGER trg_cartoes_updated BEFORE UPDATE ON public.cartoes_credito
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========== DESPESAS DE CARTÃO ===========
CREATE TABLE public.cartao_despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL DEFAULT public.get_user_empresa_id(),
  cartao_id UUID NOT NULL REFERENCES public.cartoes_credito(id) ON DELETE CASCADE,
  obra_id UUID,
  comprador_id UUID REFERENCES public.compradores(id) ON DELETE SET NULL,
  categoria_id UUID,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  data_compra DATE NOT NULL DEFAULT CURRENT_DATE,
  parcelas INTEGER NOT NULL DEFAULT 1,
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_card_desp_cartao ON public.cartao_despesas(cartao_id);
CREATE INDEX idx_card_desp_obra ON public.cartao_despesas(obra_id);
CREATE INDEX idx_card_desp_empresa ON public.cartao_despesas(empresa_id);
ALTER TABLE public.cartao_despesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY cdesp_sel ON public.cartao_despesas FOR SELECT TO authenticated
  USING (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'financeiro','view')));
CREATE POLICY cdesp_ins ON public.cartao_despesas FOR INSERT TO authenticated
  WITH CHECK (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'financeiro','create')));
CREATE POLICY cdesp_upd ON public.cartao_despesas FOR UPDATE TO authenticated
  USING (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'financeiro','edit')));
CREATE POLICY cdesp_del ON public.cartao_despesas FOR DELETE TO authenticated
  USING (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'financeiro','delete')));

CREATE TRIGGER trg_card_desp_updated BEFORE UPDATE ON public.cartao_despesas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========== comprador_id em tabelas existentes ===========
ALTER TABLE public.pedidos_compra ADD COLUMN IF NOT EXISTS comprador_id UUID REFERENCES public.compradores(id) ON DELETE SET NULL;
ALTER TABLE public.materiais_obra ADD COLUMN IF NOT EXISTS comprador_id UUID REFERENCES public.compradores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pc_comprador ON public.pedidos_compra(comprador_id);
CREATE INDEX IF NOT EXISTS idx_mat_comprador ON public.materiais_obra(comprador_id);

-- =========== Índices de performance ===========
CREATE INDEX IF NOT EXISTS idx_pc_obra ON public.pedidos_compra(obra_id);
CREATE INDEX IF NOT EXISTS idx_pc_empresa ON public.pedidos_compra(empresa_id);
CREATE INDEX IF NOT EXISTS idx_nf_obra ON public.notas_fiscais(obra_id);
CREATE INDEX IF NOT EXISTS idx_nf_empresa ON public.notas_fiscais(empresa_id);
CREATE INDEX IF NOT EXISTS idx_mat_obra ON public.materiais_obra(obra_id);
CREATE INDEX IF NOT EXISTS idx_lanc_obra ON public.lancamentos_financeiros(obra_id);
CREATE INDEX IF NOT EXISTS idx_lanc_empresa ON public.lancamentos_financeiros(empresa_id);
CREATE INDEX IF NOT EXISTS idx_rec_obra ON public.recebimentos(obra_id);
CREATE INDEX IF NOT EXISTS idx_contr_obra ON public.contratacoes_terceirizado(obra_id);
CREATE INDEX IF NOT EXISTS idx_parc_contr ON public.parcelas_pagamento(contratacao_id);
CREATE INDEX IF NOT EXISTS idx_obras_empresa_status ON public.obras(empresa_id, status);

-- =========== RPC resumo financeiro por obra ===========
CREATE OR REPLACE FUNCTION public.get_obra_financeiro_resumo(_obra_id UUID DEFAULT NULL)
RETURNS TABLE (
  obra_id UUID,
  codigo_chamado TEXT,
  receita_orcada NUMERIC,
  receita_faturada NUMERIC,
  receita_recebida NUMERIC,
  custo_materiais NUMERIC,
  custo_terceirizados_pago NUMERIC,
  custo_terceirizados_previsto NUMERIC,
  custo_cartao NUMERIC,
  despesas_realizadas NUMERIC,
  custo_total NUMERIC,
  saldo NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH e AS (SELECT public.get_user_empresa_id() AS eid)
  SELECT
    o.id,
    o.codigo_chamado,
    COALESCE((SELECT SUM(valor_orcamento) FROM orcamentos WHERE obra_id = o.id AND status = 'aprovado'), 0),
    COALESCE((SELECT SUM(valor) FROM notas_fiscais WHERE obra_id = o.id), 0),
    COALESCE((SELECT SUM(valor) FROM recebimentos WHERE obra_id = o.id AND status = 'recebido'), 0),
    COALESCE((SELECT SUM(valor_total) FROM materiais_obra WHERE obra_id = o.id), 0),
    COALESCE((SELECT SUM(pp.valor) FROM parcelas_pagamento pp
              JOIN contratacoes_terceirizado ct ON ct.id = pp.contratacao_id
              WHERE ct.obra_id = o.id AND pp.status = 'pago'), 0),
    COALESCE((SELECT SUM(valor_total) FROM contratacoes_terceirizado WHERE obra_id = o.id AND status_financeiro <> 'cancelado'), 0),
    COALESCE((SELECT SUM(valor) FROM cartao_despesas WHERE obra_id = o.id), 0),
    COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id = o.id AND tipo = 'despesa' AND status = 'realizado'), 0),
    COALESCE((SELECT SUM(valor_total) FROM materiais_obra WHERE obra_id = o.id), 0)
      + COALESCE((SELECT SUM(pp.valor) FROM parcelas_pagamento pp
                  JOIN contratacoes_terceirizado ct ON ct.id = pp.contratacao_id
                  WHERE ct.obra_id = o.id AND pp.status = 'pago'), 0)
      + COALESCE((SELECT SUM(valor) FROM cartao_despesas WHERE obra_id = o.id), 0)
      + COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id = o.id AND tipo = 'despesa' AND status = 'realizado'), 0),
    COALESCE((SELECT SUM(valor) FROM recebimentos WHERE obra_id = o.id AND status = 'recebido'), 0)
      - (
        COALESCE((SELECT SUM(valor_total) FROM materiais_obra WHERE obra_id = o.id), 0)
        + COALESCE((SELECT SUM(pp.valor) FROM parcelas_pagamento pp
                    JOIN contratacoes_terceirizado ct ON ct.id = pp.contratacao_id
                    WHERE ct.obra_id = o.id AND pp.status = 'pago'), 0)
        + COALESCE((SELECT SUM(valor) FROM cartao_despesas WHERE obra_id = o.id), 0)
        + COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE obra_id = o.id AND tipo = 'despesa' AND status = 'realizado'), 0)
      )
  FROM obras o, e
  WHERE o.empresa_id = e.eid
    AND (_obra_id IS NULL OR o.id = _obra_id)
  ORDER BY o.created_at DESC;
$$;
