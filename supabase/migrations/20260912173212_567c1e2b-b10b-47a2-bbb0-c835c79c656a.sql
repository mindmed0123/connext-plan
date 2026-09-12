CREATE TABLE public.custos_referencia_m2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) DEFAULT public.get_user_empresa_id(),
  tipo_obra text NOT NULL,
  padrao text NOT NULL DEFAULT 'normal',
  valor_m2 numeric(14,2) NOT NULL DEFAULT 0,
  fonte text,
  cidade text,
  data_referencia date NOT NULL DEFAULT CURRENT_DATE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custos_referencia_m2 TO authenticated;
GRANT ALL ON public.custos_referencia_m2 TO service_role;
ALTER TABLE public.custos_referencia_m2 ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX custos_ref_m2_key ON public.custos_referencia_m2 (empresa_id, lower(tipo_obra), lower(padrao), data_referencia);

CREATE POLICY "custos_ref_m2_select" ON public.custos_referencia_m2 FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY "custos_ref_m2_insert" ON public.custos_referencia_m2 FOR INSERT TO authenticated
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','create')));
CREATE POLICY "custos_ref_m2_update" ON public.custos_referencia_m2 FOR UPDATE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','edit')))
  WITH CHECK (public.tenant_can_write(empresa_id));
CREATE POLICY "custos_ref_m2_delete" ON public.custos_referencia_m2 FOR DELETE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','delete')));

CREATE TABLE public.ia_usos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) DEFAULT public.get_user_empresa_id(),
  uso text NOT NULL CHECK (uso IN ('orcamento','cotacao','diario')),
  registro_id uuid,
  tokens integer NOT NULL DEFAULT 0,
  custo_estimado numeric(12,4) NOT NULL DEFAULT 0,
  modelo text,
  sucesso boolean NOT NULL DEFAULT true,
  usuario_id uuid,
  data timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_usos TO authenticated;
GRANT ALL ON public.ia_usos TO service_role;
ALTER TABLE public.ia_usos ENABLE ROW LEVEL SECURITY;
CREATE INDEX ia_usos_emp_data_idx ON public.ia_usos (empresa_id, data DESC);

CREATE POLICY "ia_usos_select" ON public.ia_usos FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY "ia_usos_insert" ON public.ia_usos FOR INSERT TO authenticated
  WITH CHECK (public.tenant_can_write(empresa_id));
CREATE POLICY "ia_usos_update" ON public.ia_usos FOR UPDATE TO authenticated
  USING (public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.tenant_can_write(empresa_id));
CREATE POLICY "ia_usos_delete" ON public.ia_usos FOR DELETE TO authenticated
  USING (public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid()));

CREATE TRIGGER trg_custos_ref_m2_updated BEFORE UPDATE ON public.custos_referencia_m2
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ia_usos_updated BEFORE UPDATE ON public.ia_usos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS ia_orcamento boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ia_cotacao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ia_diario boolean NOT NULL DEFAULT false;

ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS gerado_por_ia boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.ia_consumo_mes()
RETURNS TABLE (uso text, chamadas bigint, tokens bigint, custo numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_user_empresa_id();
BEGIN
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Empresa não identificada'; END IF;
  RETURN QUERY
  SELECT u.uso, count(*)::bigint, COALESCE(sum(u.tokens),0)::bigint, COALESCE(sum(u.custo_estimado),0)
  FROM public.ia_usos u
  WHERE u.empresa_id = v_emp
    AND u.data >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')
  GROUP BY u.uso ORDER BY u.uso;
END $$;
REVOKE EXECUTE ON FUNCTION public.ia_consumo_mes() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ia_consumo_mes() TO authenticated;