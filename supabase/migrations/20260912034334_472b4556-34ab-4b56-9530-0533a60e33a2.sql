-- 1) Colunas novas
ALTER TABLE public.contratos_clientes
  ADD COLUMN IF NOT EXISTS retencao_contratual_pct numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retencao_devolucao_prevista date;

ALTER TABLE public.medicoes
  ADD COLUMN IF NOT EXISTS arquivo_path text,
  ADD COLUMN IF NOT EXISTS arquivo_nome text;

ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS medicao_id uuid REFERENCES public.medicoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nf_medicao ON public.notas_fiscais(medicao_id);
CREATE INDEX IF NOT EXISTS idx_medicoes_contrato ON public.medicoes(empresa_id, contrato_id);
CREATE INDEX IF NOT EXISTS idx_contratos_obra ON public.contratos_clientes(empresa_id, obra_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_medicao_num ON public.medicoes(empresa_id, contrato_id, numero_medicao);
CREATE UNIQUE INDEX IF NOT EXISTS uq_contrato_numero ON public.contratos_clientes(empresa_id, numero_contrato) WHERE numero_contrato IS NOT NULL;

-- 2) GRANTS (faltavam)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos_clientes TO authenticated;
GRANT ALL ON public.contratos_clientes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicoes TO authenticated;
GRANT ALL ON public.medicoes TO service_role;

-- 3) Policies com os módulos novos
DROP POLICY IF EXISTS cc_sel ON public.contratos_clientes;
DROP POLICY IF EXISTS cc_ins ON public.contratos_clientes;
DROP POLICY IF EXISTS cc_upd ON public.contratos_clientes;
DROP POLICY IF EXISTS cc_del ON public.contratos_clientes;

CREATE POLICY cc_sel ON public.contratos_clientes FOR SELECT TO authenticated
USING (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid())
  OR has_permission(auth.uid(),'contratos','view') OR has_permission(auth.uid(),'financeiro','view')));

CREATE POLICY cc_ins ON public.contratos_clientes FOR INSERT TO authenticated
WITH CHECK (tenant_can_write(empresa_id)
  AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'contratos','create'))
  AND mesmo_tenant('obras'::regclass, obra_id, empresa_id)
  AND mesmo_tenant('clientes'::regclass, cliente_id, empresa_id));

CREATE POLICY cc_upd ON public.contratos_clientes FOR UPDATE TO authenticated
USING (tenant_can_write(empresa_id)
  AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'contratos','edit'))
  AND mesmo_tenant('obras'::regclass, obra_id, empresa_id)
  AND mesmo_tenant('clientes'::regclass, cliente_id, empresa_id))
WITH CHECK (tenant_can_write(empresa_id)
  AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'contratos','edit'))
  AND mesmo_tenant('obras'::regclass, obra_id, empresa_id)
  AND mesmo_tenant('clientes'::regclass, cliente_id, empresa_id));

CREATE POLICY cc_del ON public.contratos_clientes FOR DELETE TO authenticated
USING (tenant_can_write(empresa_id)
  AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'contratos','delete')));

DROP POLICY IF EXISTS med_sel ON public.medicoes;
DROP POLICY IF EXISTS med_ins ON public.medicoes;
DROP POLICY IF EXISTS med_upd ON public.medicoes;
DROP POLICY IF EXISTS med_del ON public.medicoes;

CREATE POLICY med_sel ON public.medicoes FOR SELECT TO authenticated
USING (tenant_match(empresa_id) AND (is_admin_or_super(auth.uid())
  OR has_permission(auth.uid(),'medicoes','view') OR has_permission(auth.uid(),'faturamento','view')));

CREATE POLICY med_ins ON public.medicoes FOR INSERT TO authenticated
WITH CHECK (tenant_can_write(empresa_id)
  AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'medicoes','create'))
  AND mesmo_tenant('obras'::regclass, obra_id, empresa_id)
  AND mesmo_tenant('contratos_clientes'::regclass, contrato_id, empresa_id));

CREATE POLICY med_upd ON public.medicoes FOR UPDATE TO authenticated
USING (tenant_can_write(empresa_id)
  AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'medicoes','edit'))
  AND mesmo_tenant('obras'::regclass, obra_id, empresa_id)
  AND mesmo_tenant('contratos_clientes'::regclass, contrato_id, empresa_id))
WITH CHECK (tenant_can_write(empresa_id)
  AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'medicoes','edit'))
  AND mesmo_tenant('obras'::regclass, obra_id, empresa_id)
  AND mesmo_tenant('contratos_clientes'::regclass, contrato_id, empresa_id));

CREATE POLICY med_del ON public.medicoes FOR DELETE TO authenticated
USING (tenant_can_write(empresa_id)
  AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(),'medicoes','delete')));

-- 4) empresa_id default e trigger de coerência de tenant + numeração
ALTER TABLE public.contratos_clientes ALTER COLUMN empresa_id SET DEFAULT public.get_user_empresa_id();
ALTER TABLE public.medicoes ALTER COLUMN empresa_id SET DEFAULT public.get_user_empresa_id();

CREATE OR REPLACE FUNCTION public.fn_medicao_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_teto numeric := 0;
  v_soma numeric := 0;
BEGIN
  IF NEW.empresa_id IS NULL THEN NEW.empresa_id := public.get_user_empresa_id(); END IF;

  IF NEW.obra_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.obras o WHERE o.id = NEW.obra_id AND o.empresa_id = NEW.empresa_id
  ) THEN RAISE EXCEPTION 'Obra de outra empresa'; END IF;

  IF NEW.contrato_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.contratos_clientes c WHERE c.id = NEW.contrato_id AND c.empresa_id = NEW.empresa_id
  ) THEN RAISE EXCEPTION 'Contrato de outra empresa'; END IF;

  IF TG_OP = 'INSERT' AND (NEW.numero_medicao IS NULL OR NEW.numero_medicao <= 0) THEN
    SELECT COALESCE(MAX(m.numero_medicao),0) + 1 INTO NEW.numero_medicao
      FROM public.medicoes m
     WHERE m.empresa_id = NEW.empresa_id
       AND m.contrato_id IS NOT DISTINCT FROM NEW.contrato_id;
  END IF;

  -- medição aprovada é somente leitura (exceto mudança de status e recálculo do sistema)
  IF TG_OP = 'UPDATE' AND OLD.status = 'aprovada' AND pg_trigger_depth() <= 1 THEN
    IF NEW.valor_medido IS DISTINCT FROM OLD.valor_medido
       OR NEW.data_medicao IS DISTINCT FROM OLD.data_medicao
       OR NEW.contrato_id IS DISTINCT FROM OLD.contrato_id
       OR NEW.obra_id IS DISTINCT FROM OLD.obra_id
       OR NEW.numero_medicao IS DISTINCT FROM OLD.numero_medicao
       OR NEW.referencia IS DISTINCT FROM OLD.referencia
       OR NEW.percentual IS DISTINCT FROM OLD.percentual THEN
      RAISE EXCEPTION 'Medição aprovada é somente leitura. Rejeite a medição antes de alterar os valores.';
    END IF;
  END IF;

  IF NEW.status = 'aprovada' THEN
    IF NEW.aprovado_em IS NULL THEN NEW.aprovado_em := now(); END IF;
    IF NEW.aprovado_por IS NULL THEN NEW.aprovado_por := auth.uid(); END IF;

    IF NEW.contrato_id IS NOT NULL THEN
      SELECT COALESCE(c.valor_global,0)
             + COALESCE((SELECT SUM(a.valor_total) FROM public.obra_adendos a
                          WHERE a.empresa_id = NEW.empresa_id AND a.obra_id = c.obra_id
                            AND a.status IN ('assinado','em_execucao','concluido')),0)
        INTO v_teto
        FROM public.contratos_clientes c
       WHERE c.id = NEW.contrato_id AND c.empresa_id = NEW.empresa_id;

      SELECT COALESCE(SUM(m.valor_medido),0) INTO v_soma
        FROM public.medicoes m
       WHERE m.empresa_id = NEW.empresa_id AND m.contrato_id = NEW.contrato_id
         AND m.status = 'aprovada' AND m.id <> NEW.id;

      IF v_soma + COALESCE(NEW.valor_medido,0) > v_teto + 0.005 THEN
        RAISE EXCEPTION 'Medições aprovadas (R$ %) passariam do valor do contrato com adendos (R$ %).',
          to_char(v_soma + COALESCE(NEW.valor_medido,0),'FM999999999.00'), to_char(v_teto,'FM999999999.00');
      END IF;
      NEW.valor_acumulado := v_soma + COALESCE(NEW.valor_medido,0);
      IF v_teto > 0 THEN NEW.percentual := ROUND(NEW.valor_acumulado / v_teto * 100, 2); END IF;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_medicao_before_write ON public.medicoes;
CREATE TRIGGER trg_medicao_before_write BEFORE INSERT OR UPDATE ON public.medicoes
FOR EACH ROW EXECUTE FUNCTION public.fn_medicao_before_write();

-- recalcula acumulado das demais medições aprovadas do contrato
CREATE OR REPLACE FUNCTION public.fn_medicao_recalc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_contrato uuid := COALESCE(NEW.contrato_id, OLD.contrato_id);
  v_empresa uuid := COALESCE(NEW.empresa_id, OLD.empresa_id);
  v_acc numeric := 0;
  r record;
BEGIN
  IF v_contrato IS NULL OR pg_trigger_depth() > 1 THEN RETURN NULL; END IF;
  FOR r IN SELECT m.id, m.valor_medido FROM public.medicoes m
            WHERE m.empresa_id = v_empresa AND m.contrato_id = v_contrato AND m.status = 'aprovada'
            ORDER BY m.numero_medicao LOOP
    v_acc := v_acc + COALESCE(r.valor_medido,0);
    UPDATE public.medicoes SET valor_acumulado = v_acc
      WHERE id = r.id AND empresa_id = v_empresa AND valor_acumulado IS DISTINCT FROM v_acc;
  END LOOP;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_medicao_recalc ON public.medicoes;
CREATE TRIGGER trg_medicao_recalc AFTER INSERT OR UPDATE OR DELETE ON public.medicoes
FOR EACH ROW EXECUTE FUNCTION public.fn_medicao_recalc();

-- timeline da obra
CREATE OR REPLACE FUNCTION public.fn_medicao_timeline()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_evento text;
BEGIN
  IF NEW.obra_id IS NULL THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL; END IF;
  v_evento := CASE NEW.status
    WHEN 'enviada' THEN 'Medição enviada'
    WHEN 'aprovada' THEN 'Medição aprovada'
    WHEN 'rejeitada' THEN 'Medição rejeitada'
    ELSE NULL END;
  IF v_evento IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.obra_timeline (obra_id, empresa_id, user_id, evento, detalhes)
  VALUES (NEW.obra_id, NEW.empresa_id, auth.uid(),
          v_evento || ' nº ' || NEW.numero_medicao,
          'Valor medido: R$ ' || to_char(COALESCE(NEW.valor_medido,0),'FM999999999.00'));
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_medicao_timeline ON public.medicoes;
CREATE TRIGGER trg_medicao_timeline AFTER INSERT OR UPDATE OF status ON public.medicoes
FOR EACH ROW EXECUTE FUNCTION public.fn_medicao_timeline();

DROP TRIGGER IF EXISTS trg_contratos_clientes_updated ON public.contratos_clientes;
CREATE TRIGGER trg_contratos_clientes_updated BEFORE UPDATE ON public.contratos_clientes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

REVOKE EXECUTE ON FUNCTION public.fn_medicao_before_write() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fn_medicao_recalc() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fn_medicao_timeline() FROM anon, public;