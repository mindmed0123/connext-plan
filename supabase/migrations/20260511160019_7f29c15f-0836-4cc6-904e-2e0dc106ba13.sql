-- Servicos
CREATE TABLE IF NOT EXISTS public.servicos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo        TEXT,
  nome          TEXT NOT NULL,
  descricao     TEXT,
  unidade       TEXT NOT NULL DEFAULT 'm²',
  preco_unitario NUMERIC(14,2) NOT NULL DEFAULT 0,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_servicos_empresa ON public.servicos(empresa_id);
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_servicos_updated ON public.servicos;
CREATE TRIGGER trg_servicos_updated
  BEFORE UPDATE ON public.servicos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "servicos_select" ON public.servicos;
DROP POLICY IF EXISTS "servicos_insert" ON public.servicos;
DROP POLICY IF EXISTS "servicos_update" ON public.servicos;
DROP POLICY IF EXISTS "servicos_delete" ON public.servicos;

CREATE POLICY "servicos_select" ON public.servicos FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY "servicos_insert" ON public.servicos FOR INSERT TO authenticated
  WITH CHECK (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'servicos', 'create')));
CREATE POLICY "servicos_update" ON public.servicos FOR UPDATE TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'servicos', 'edit')));
CREATE POLICY "servicos_delete" ON public.servicos FOR DELETE TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'servicos', 'delete')));

-- Campos extras orcamentos
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS titulo TEXT,
  ADD COLUMN IF NOT EXISTS validade_dias INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS condicoes_pagamento TEXT,
  ADD COLUMN IF NOT EXISTS data_orcamento DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS cliente_nome TEXT,
  ADD COLUMN IF NOT EXISTS cliente_cnpj TEXT,
  ADD COLUMN IF NOT EXISTS cliente_endereco TEXT;

-- Itens do orçamento
CREATE TABLE IF NOT EXISTS public.orcamento_itens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id    UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  empresa_id      UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  servico_id      UUID REFERENCES public.servicos(id) ON DELETE SET NULL,
  descricao       TEXT NOT NULL,
  unidade         TEXT NOT NULL DEFAULT 'un',
  quantidade      NUMERIC(14,4) NOT NULL DEFAULT 1,
  preco_unitario  NUMERIC(14,2) NOT NULL DEFAULT 0,
  desconto_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,
  subtotal        NUMERIC(14,2) GENERATED ALWAYS AS (
    ROUND(quantidade * preco_unitario * (1 - desconto_pct / 100), 2)
  ) STORED,
  ordem           INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orcamento_itens_orcamento ON public.orcamento_itens(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_itens_empresa ON public.orcamento_itens(empresa_id);
ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orcamento_itens_select" ON public.orcamento_itens;
DROP POLICY IF EXISTS "orcamento_itens_insert" ON public.orcamento_itens;
DROP POLICY IF EXISTS "orcamento_itens_update" ON public.orcamento_itens;
DROP POLICY IF EXISTS "orcamento_itens_delete" ON public.orcamento_itens;

CREATE POLICY "orcamento_itens_select" ON public.orcamento_itens FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY "orcamento_itens_insert" ON public.orcamento_itens FOR INSERT TO authenticated
  WITH CHECK (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'orcamentos', 'create')));
CREATE POLICY "orcamento_itens_update" ON public.orcamento_itens FOR UPDATE TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'orcamentos', 'edit')));
CREATE POLICY "orcamento_itens_delete" ON public.orcamento_itens FOR DELETE TO authenticated
  USING (public.tenant_match(empresa_id) AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'orcamentos', 'delete')));

-- Sync obra status
CREATE OR REPLACE FUNCTION public.sync_obra_status_from_orcamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'enviado' AND OLD.status != 'enviado' THEN
    UPDATE public.obras SET status = 'em_aprovacao', updated_at = now()
    WHERE id = NEW.obra_id AND status NOT IN ('em_execucao','finalizado','pago');
  END IF;
  IF NEW.status = 'aprovado' AND OLD.status != 'aprovado' THEN
    UPDATE public.obras SET status = 'aprovado', updated_at = now()
    WHERE id = NEW.obra_id;
  END IF;
  IF NEW.status = 'reprovado' AND OLD.status != 'reprovado' THEN
    UPDATE public.obras SET status = 'aguardando_orcamento', updated_at = now()
    WHERE id = NEW.obra_id AND status = 'em_aprovacao';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_obra_from_orcamento ON public.orcamentos;
CREATE TRIGGER trg_sync_obra_from_orcamento
  AFTER UPDATE OF status ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.sync_obra_status_from_orcamento();

-- Recalcular total
CREATE OR REPLACE FUNCTION public.recalculate_orcamento_total()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.orcamentos
  SET valor_orcamento = (
    SELECT COALESCE(SUM(subtotal), 0) FROM public.orcamento_itens WHERE orcamento_id = COALESCE(NEW.orcamento_id, OLD.orcamento_id)
  )
  WHERE id = COALESCE(NEW.orcamento_id, OLD.orcamento_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_orcamento ON public.orcamento_itens;
CREATE TRIGGER trg_recalc_orcamento
  AFTER INSERT OR UPDATE OR DELETE ON public.orcamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_orcamento_total();