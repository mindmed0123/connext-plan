-- 1. Regiões dinâmicas por empresa
CREATE TABLE IF NOT EXISTS public.regioes_obra (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, nome)
);
CREATE INDEX IF NOT EXISTS idx_regioes_empresa ON public.regioes_obra(empresa_id);
ALTER TABLE public.regioes_obra ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_regioes_set_empresa ON public.regioes_obra;
CREATE TRIGGER trg_regioes_set_empresa
  BEFORE INSERT ON public.regioes_obra
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_from_user();

DROP POLICY IF EXISTS "regioes_select" ON public.regioes_obra;
DROP POLICY IF EXISTS "regioes_insert" ON public.regioes_obra;
DROP POLICY IF EXISTS "regioes_update" ON public.regioes_obra;
DROP POLICY IF EXISTS "regioes_delete" ON public.regioes_obra;
CREATE POLICY "regioes_select" ON public.regioes_obra FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY "regioes_insert" ON public.regioes_obra FOR INSERT TO authenticated
  WITH CHECK (public.tenant_match(empresa_id));
CREATE POLICY "regioes_update" ON public.regioes_obra FOR UPDATE TO authenticated
  USING (public.tenant_match(empresa_id) AND public.is_admin_or_super(auth.uid()));
CREATE POLICY "regioes_delete" ON public.regioes_obra FOR DELETE TO authenticated
  USING (public.tenant_match(empresa_id) AND public.is_admin_or_super(auth.uid()));

-- 2. Campo regiao_label nas obras (texto livre)
ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS regiao_label TEXT;

UPDATE public.obras SET regiao_label = CASE
  WHEN regiao::text = 'leste'    THEN 'Leste'
  WHEN regiao::text = 'oeste'    THEN 'Oeste'
  WHEN regiao::text = 'norte'    THEN 'Norte'
  WHEN regiao::text = 'sul'      THEN 'Sul'
  WHEN regiao::text = 'interior' THEN 'Interior'
  ELSE regiao::text
END
WHERE regiao_label IS NULL AND regiao IS NOT NULL;

-- Seed regiões da Potência Soluções
INSERT INTO public.regioes_obra (empresa_id, nome)
SELECT id, unnest(ARRAY['Leste','Oeste','Norte','Sul','Interior'])
FROM public.empresas WHERE slug LIKE 'potencia%'
ON CONFLICT (empresa_id, nome) DO NOTHING;

-- 3. Configuração de dashboard por empresa
CREATE TABLE IF NOT EXISTS public.empresa_dashboard_config (
  empresa_id     UUID PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  cards_visiveis TEXT[] NOT NULL DEFAULT ARRAY[
    'obras_ativas','em_orcamento','em_execucao',
    'finalizadas','total_a_receber','recebimentos_15d',
    'pago_terceirizados','pendente_terceirizados'
  ],
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.empresa_dashboard_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dashboard_config_select" ON public.empresa_dashboard_config;
DROP POLICY IF EXISTS "dashboard_config_upsert" ON public.empresa_dashboard_config;
CREATE POLICY "dashboard_config_select" ON public.empresa_dashboard_config
  FOR SELECT TO authenticated USING (public.tenant_match(empresa_id));
CREATE POLICY "dashboard_config_upsert" ON public.empresa_dashboard_config
  FOR ALL TO authenticated
  USING (public.tenant_match(empresa_id) AND public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.tenant_match(empresa_id) AND public.is_admin_or_super(auth.uid()));

INSERT INTO public.empresa_dashboard_config (empresa_id)
SELECT id FROM public.empresas WHERE slug LIKE 'potencia%'
ON CONFLICT DO NOTHING;

-- 4. Trigger: orçamento aprovado → obra em_execucao
CREATE OR REPLACE FUNCTION public.sync_obra_status_from_orcamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'enviado' AND OLD.status != 'enviado' THEN
    UPDATE public.obras SET status = 'em_aprovacao', updated_at = now()
    WHERE id = NEW.obra_id
      AND status NOT IN ('em_execucao','finalizado','aguardando_rc',
                         'aguardando_pedido_compra','aguardando_nf',
                         'aguardando_pagamento','pago');
  END IF;

  IF NEW.status = 'aprovado' AND OLD.status != 'aprovado' THEN
    UPDATE public.obras SET status = 'em_execucao', updated_at = now()
    WHERE id = NEW.obra_id;
    INSERT INTO public.obra_timeline (obra_id, evento, detalhes, empresa_id)
    VALUES (NEW.obra_id, 'Orçamento aprovado',
            'Obra movida para Em execução automaticamente',
            (SELECT empresa_id FROM public.obras WHERE id = NEW.obra_id));
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