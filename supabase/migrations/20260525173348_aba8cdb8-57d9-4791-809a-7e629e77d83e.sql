
-- =====================================================
-- SERVIÇOS & ORÇAMENTOS — UPGRADE (NÍVEL OMIE)
-- preservando dados existentes (7 servicos, 31 orcamentos, 3 itens)
-- =====================================================

-- 1. CATEGORIAS DE SERVIÇO ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.categorias_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#6B7280',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);
ALTER TABLE public.categorias_servico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cat_serv_sel ON public.categorias_servico;
DROP POLICY IF EXISTS cat_serv_ins ON public.categorias_servico;
DROP POLICY IF EXISTS cat_serv_upd ON public.categorias_servico;
DROP POLICY IF EXISTS cat_serv_del ON public.categorias_servico;

CREATE POLICY cat_serv_sel ON public.categorias_servico FOR SELECT TO authenticated
  USING (tenant_match(empresa_id));
CREATE POLICY cat_serv_ins ON public.categorias_servico FOR INSERT TO authenticated
  WITH CHECK (tenant_match(empresa_id) AND (
    is_admin_or_super(auth.uid()) OR has_permission(auth.uid(), 'servicos'::app_modulo, 'create'::app_acao)
  ));
CREATE POLICY cat_serv_upd ON public.categorias_servico FOR UPDATE TO authenticated
  USING (tenant_match(empresa_id) AND (
    is_admin_or_super(auth.uid()) OR has_permission(auth.uid(), 'servicos'::app_modulo, 'edit'::app_acao)
  ));
CREATE POLICY cat_serv_del ON public.categorias_servico FOR DELETE TO authenticated
  USING (tenant_match(empresa_id) AND (
    is_admin_or_super(auth.uid()) OR has_permission(auth.uid(), 'servicos'::app_modulo, 'delete'::app_acao)
  ));

-- 2. SERVIÇOS — novos campos ------------------------------------------
ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS descricao_detalhada TEXT,
  ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES public.categorias_servico(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS desconto_padrao_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS codigo_servico_municipio TEXT,
  ADD COLUMN IF NOT EXISTS codigo_lc116 TEXT,
  ADD COLUMN IF NOT EXISTS codigo_nbs TEXT,
  ADD COLUMN IF NOT EXISTS aliquota_iss NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iss_retido BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tipo_tributacao TEXT NOT NULL DEFAULT 'tributado_municipio';

DO $$ BEGIN
  ALTER TABLE public.servicos
    ADD CONSTRAINT servicos_tipo_tributacao_chk
    CHECK (tipo_tributacao IN ('tributado_municipio','isento','imune','nao_incidencia','exportacao'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. AUTO-GERAR código SRV00001 (por empresa) -------------------------
CREATE OR REPLACE FUNCTION public.gerar_codigo_servico()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_seq INT;
BEGIN
  SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(codigo,'\D','','g'),'') AS INT)), 0) + 1
  INTO v_seq
  FROM public.servicos
  WHERE empresa_id = NEW.empresa_id AND codigo LIKE 'SRV%';
  NEW.codigo := 'SRV' || LPAD(v_seq::TEXT, 5, '0');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_codigo_servico ON public.servicos;
CREATE TRIGGER trg_codigo_servico
  BEFORE INSERT ON public.servicos
  FOR EACH ROW
  WHEN (NEW.codigo IS NULL OR NEW.codigo = '')
  EXECUTE FUNCTION public.gerar_codigo_servico();

-- 4. ORÇAMENTOS — novos campos ----------------------------------------
-- adiciona valor "cancelado" ao enum se ainda não existir
DO $$ BEGIN
  ALTER TYPE public.orcamento_status ADD VALUE IF NOT EXISTS 'cancelado';
EXCEPTION WHEN others THEN NULL; END $$;

ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS numero TEXT,
  ADD COLUMN IF NOT EXISTS comprador_id UUID REFERENCES public.compradores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_emissao DATE,
  ADD COLUMN IF NOT EXISTS data_validade DATE,
  ADD COLUMN IF NOT EXISTS data_resposta DATE,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_global_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_global_valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_impostos NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS condicao_pagamento TEXT NOT NULL DEFAULT 'a_vista',
  ADD COLUMN IF NOT EXISTS numero_parcelas INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS intervalo_parcelas INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS percentual_entrada NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS objeto TEXT,
  ADD COLUMN IF NOT EXISTS local_execucao TEXT,
  ADD COLUMN IF NOT EXISTS prazo_execucao TEXT,
  ADD COLUMN IF NOT EXISTS observacoes_internas TEXT;

DO $$ BEGIN
  ALTER TABLE public.orcamentos
    ADD CONSTRAINT orcamentos_condicao_pgto_chk
    CHECK (condicao_pagamento IN ('a_vista','parcelado','entrada_parcelas','boleto','pix','transferencia','negociar'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill datas/valores/numero
UPDATE public.orcamentos
   SET data_emissao = COALESCE(data_emissao, data_orcamento, data_envio, CURRENT_DATE),
       valor_total  = CASE WHEN valor_total = 0 THEN COALESCE(valor_orcamento, 0) ELSE valor_total END,
       subtotal     = CASE WHEN subtotal    = 0 THEN COALESCE(valor_orcamento, 0) ELSE subtotal END;

-- Backfill data_validade a partir de validade_dias
UPDATE public.orcamentos
   SET data_validade = (COALESCE(data_emissao, CURRENT_DATE) + (COALESCE(validade_dias,30) || ' days')::interval)::date
 WHERE data_validade IS NULL;

-- Backfill número (ORC-YYYY-0001 por empresa, mantendo numero_orcamento original como fallback)
WITH ranked AS (
  SELECT id, empresa_id, EXTRACT(YEAR FROM COALESCE(data_emissao, created_at))::int AS ano,
         ROW_NUMBER() OVER (
           PARTITION BY empresa_id, EXTRACT(YEAR FROM COALESCE(data_emissao, created_at))
           ORDER BY created_at ASC
         ) AS seq
  FROM public.orcamentos
  WHERE numero IS NULL OR numero = ''
)
UPDATE public.orcamentos o
   SET numero = 'ORC-' || ranked.ano || '-' || LPAD(ranked.seq::TEXT, 4, '0')
  FROM ranked
 WHERE o.id = ranked.id;

-- 5. AUTO-GERAR número de orçamento ----------------------------------
CREATE OR REPLACE FUNCTION public.gerar_numero_orcamento()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ano TEXT := EXTRACT(YEAR FROM COALESCE(NEW.data_emissao, CURRENT_DATE))::TEXT;
  v_seq INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(numero, '-', 3) AS INT)), 0) + 1
    INTO v_seq
    FROM public.orcamentos
   WHERE empresa_id = NEW.empresa_id
     AND numero LIKE 'ORC-' || v_ano || '-%';
  NEW.numero := 'ORC-' || v_ano || '-' || LPAD(v_seq::TEXT, 4, '0');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_numero_orcamento ON public.orcamentos;
CREATE TRIGGER trg_numero_orcamento
  BEFORE INSERT ON public.orcamentos
  FOR EACH ROW
  WHEN (NEW.numero IS NULL OR NEW.numero = '')
  EXECUTE FUNCTION public.gerar_numero_orcamento();

-- 6. ITENS DE ORÇAMENTO — novos campos -------------------------------
ALTER TABLE public.orcamento_itens
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'servico',
  ADD COLUMN IF NOT EXISTS codigo TEXT,
  ADD COLUMN IF NOT EXISTS descricao_detalhada TEXT,
  ADD COLUMN IF NOT EXISTS aliquota_iss NUMERIC(5,2) NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE public.orcamento_itens
    ADD CONSTRAINT orc_itens_tipo_chk CHECK (tipo IN ('servico','material','despesa','texto'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Recalcula totais (subtotal item + totais do orçamento)
CREATE OR REPLACE FUNCTION public.recalc_totais_orcamento()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_orc_id UUID := COALESCE(NEW.orcamento_id, OLD.orcamento_id);
  v_subtotal NUMERIC(14,2);
  v_impostos NUMERIC(14,2);
  v_desc_pct NUMERIC(5,2);
  v_desc_valor NUMERIC(14,2);
BEGIN
  -- recalcula subtotal de cada item (não usa GENERATED para não perder dados)
  IF TG_OP <> 'DELETE' THEN
    NEW.subtotal := ROUND(COALESCE(NEW.quantidade,0) * COALESCE(NEW.preco_unitario,0) * (1 - COALESCE(NEW.desconto_pct,0)/100.0), 2);
  END IF;

  SELECT
    COALESCE(SUM(subtotal), 0),
    COALESCE(SUM(ROUND(subtotal * COALESCE(aliquota_iss,0) / 100.0, 2)), 0)
    INTO v_subtotal, v_impostos
    FROM public.orcamento_itens
   WHERE orcamento_id = v_orc_id;

  SELECT COALESCE(desconto_global_pct,0) INTO v_desc_pct FROM public.orcamentos WHERE id = v_orc_id;
  v_desc_valor := ROUND(v_subtotal * COALESCE(v_desc_pct,0) / 100.0, 2);

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

-- substitui o trigger antigo "recalculate_orcamento_total"
DROP TRIGGER IF EXISTS trg_recalc_orcamento_total ON public.orcamento_itens;
DROP TRIGGER IF EXISTS trg_recalc_orcamento ON public.orcamento_itens;
DROP TRIGGER IF EXISTS trg_recalc_orcamento_before ON public.orcamento_itens;

CREATE TRIGGER trg_recalc_orcamento_before
  BEFORE INSERT OR UPDATE ON public.orcamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.recalc_totais_orcamento();

CREATE TRIGGER trg_recalc_orcamento_after
  AFTER INSERT OR UPDATE OR DELETE ON public.orcamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.recalc_totais_orcamento();

-- recalcula totais após mudar desconto_global_pct do próprio orçamento
CREATE OR REPLACE FUNCTION public.recalc_totais_apos_desc_global()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_subtotal NUMERIC(14,2);
  v_impostos NUMERIC(14,2);
  v_desc_valor NUMERIC(14,2);
BEGIN
  SELECT
    COALESCE(SUM(subtotal),0),
    COALESCE(SUM(ROUND(subtotal*COALESCE(aliquota_iss,0)/100.0,2)),0)
    INTO v_subtotal, v_impostos
    FROM public.orcamento_itens WHERE orcamento_id = NEW.id;
  v_desc_valor := ROUND(v_subtotal * COALESCE(NEW.desconto_global_pct,0)/100.0, 2);
  NEW.subtotal := v_subtotal;
  NEW.desconto_global_valor := v_desc_valor;
  NEW.valor_impostos := v_impostos;
  NEW.valor_total := v_subtotal - v_desc_valor + v_impostos;
  NEW.valor_orcamento := NEW.valor_total;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_recalc_orc_desc ON public.orcamentos;
CREATE TRIGGER trg_recalc_orc_desc
  BEFORE UPDATE OF desconto_global_pct ON public.orcamentos
  FOR EACH ROW
  WHEN (OLD.desconto_global_pct IS DISTINCT FROM NEW.desconto_global_pct)
  EXECUTE FUNCTION public.recalc_totais_apos_desc_global();

-- 7. COMPRADORES — campos extras --------------------------------------
ALTER TABLE public.compradores
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS cidade TEXT,
  ADD COLUMN IF NOT EXISTS estado TEXT;

-- 8. Índices ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_servicos_empresa ON public.servicos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_servicos_categoria ON public.servicos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_empresa ON public.orcamentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_status ON public.orcamentos(status);
CREATE INDEX IF NOT EXISTS idx_orcamentos_obra ON public.orcamentos(obra_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_comprador ON public.orcamentos(comprador_id);
CREATE INDEX IF NOT EXISTS idx_orc_itens_orcamento ON public.orcamento_itens(orcamento_id);

-- 9. Seed de categorias padrão para todas empresas --------------------
INSERT INTO public.categorias_servico (empresa_id, nome, cor)
SELECT e.id, c.nome, c.cor
  FROM public.empresas e
  CROSS JOIN (VALUES
    ('Obras Civis',          '#3b82f6'),
    ('Elétrica',             '#f59e0b'),
    ('Hidráulica',           '#06b6d4'),
    ('Pintura e Acabamento', '#8b5cf6'),
    ('Terraplanagem',        '#84cc16'),
    ('Instalações',          '#ec4899'),
    ('Manutenção',           '#6b7280'),
    ('Consultoria',          '#0ea5e9')
  ) AS c(nome, cor)
ON CONFLICT (empresa_id, nome) DO NOTHING;
