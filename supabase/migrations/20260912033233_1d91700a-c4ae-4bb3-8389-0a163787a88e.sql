-- 1) Configuração por empresa
CREATE TABLE public.empresa_config (
  empresa_id uuid PRIMARY KEY NOT NULL DEFAULT public.get_user_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  regime_tributario public.regime_tributario,
  cprb boolean NOT NULL DEFAULT false,
  aliquota_inss_padrao numeric(6,3) NOT NULL DEFAULT 11,
  aliquota_inss_cprb numeric(6,3) NOT NULL DEFAULT 3.5,
  aliquota_iss_padrao numeric(6,3) NOT NULL DEFAULT 0,
  aliquota_irrf_padrao numeric(6,3) NOT NULL DEFAULT 1.5,
  aliquota_pcc_padrao numeric(6,3) NOT NULL DEFAULT 4.65,
  prazo_pagamento_padrao integer NOT NULL DEFAULT 30,
  bdi_ac numeric(6,3) NOT NULL DEFAULT 0,
  bdi_s numeric(6,3) NOT NULL DEFAULT 0,
  bdi_r numeric(6,3) NOT NULL DEFAULT 0,
  bdi_df numeric(6,3) NOT NULL DEFAULT 0,
  bdi_l numeric(6,3) NOT NULL DEFAULT 0,
  bdi_i numeric(6,3) NOT NULL DEFAULT 0,
  mascara_orcamento text NOT NULL DEFAULT 'ORC-{ano}-{seq}',
  mascara_medicao text NOT NULL DEFAULT 'MED-{ano}-{seq}',
  mascara_contrato text NOT NULL DEFAULT 'CTR-{ano}-{seq}',
  mascara_nf text NOT NULL DEFAULT 'NF-{ano}-{seq}',
  validade_orcamento_dias integer NOT NULL DEFAULT 30,
  texto_condicoes text,
  texto_observacoes text,
  texto_rodape text,
  cor_primaria text NOT NULL DEFAULT '#52C4B8',
  email_remetente_nome text,
  email_remetente_endereco text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_config TO authenticated;
GRANT ALL ON public.empresa_config TO service_role;
ALTER TABLE public.empresa_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresa_config_select" ON public.empresa_config FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY "empresa_config_insert" ON public.empresa_config FOR INSERT TO authenticated
  WITH CHECK (
    public.tenant_can_write(empresa_id)
    AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'create'))
  );
CREATE POLICY "empresa_config_update" ON public.empresa_config FOR UPDATE TO authenticated
  USING (
    public.tenant_can_write(empresa_id)
    AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'edit'))
  )
  WITH CHECK (
    public.tenant_can_write(empresa_id)
    AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'edit'))
  );
CREATE POLICY "empresa_config_delete" ON public.empresa_config FOR DELETE TO authenticated
  USING (
    public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'delete'))
  );

CREATE TRIGGER trg_empresa_config_updated
  BEFORE UPDATE ON public.empresa_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Contadores de documentos por empresa
CREATE TABLE public.documento_contadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.get_user_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  ano integer NOT NULL,
  ultimo_numero integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX documento_contadores_unq ON public.documento_contadores (empresa_id, tipo, ano);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documento_contadores TO authenticated;
GRANT ALL ON public.documento_contadores TO service_role;
ALTER TABLE public.documento_contadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documento_contadores_select" ON public.documento_contadores FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY "documento_contadores_insert" ON public.documento_contadores FOR INSERT TO authenticated
  WITH CHECK (
    public.tenant_can_write(empresa_id)
    AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'orcamentos', 'create'))
  );
CREATE POLICY "documento_contadores_update" ON public.documento_contadores FOR UPDATE TO authenticated
  USING (
    public.tenant_can_write(empresa_id)
    AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'orcamentos', 'edit'))
  )
  WITH CHECK (
    public.tenant_can_write(empresa_id)
    AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'orcamentos', 'edit'))
  );
CREATE POLICY "documento_contadores_delete" ON public.documento_contadores FOR DELETE TO authenticated
  USING (
    public.tenant_can_write(empresa_id)
    AND public.is_admin_or_super(auth.uid())
  );

CREATE TRIGGER trg_documento_contadores_updated
  BEFORE UPDATE ON public.documento_contadores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Sequência com trava + aplicação de máscara
CREATE OR REPLACE FUNCTION public.proximo_numero_documento(_empresa_id uuid, _tipo text, _data date DEFAULT CURRENT_DATE)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano int := EXTRACT(YEAR FROM COALESCE(_data, CURRENT_DATE))::int;
  v_mes int := EXTRACT(MONTH FROM COALESCE(_data, CURRENT_DATE))::int;
  v_seq int;
  v_mascara text;
BEGIN
  IF _empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa não informada';
  END IF;
  IF auth.uid() IS NOT NULL
     AND _empresa_id IS DISTINCT FROM public.get_user_empresa_id()
     AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Empresa inválida para a numeração';
  END IF;

  INSERT INTO public.documento_contadores (empresa_id, tipo, ano, ultimo_numero)
  VALUES (_empresa_id, _tipo, v_ano, 1)
  ON CONFLICT (empresa_id, tipo, ano)
  DO UPDATE SET ultimo_numero = public.documento_contadores.ultimo_numero + 1,
                updated_at = now()
  WHERE public.documento_contadores.empresa_id = _empresa_id
  RETURNING ultimo_numero INTO v_seq;

  SELECT CASE _tipo
           WHEN 'orcamento' THEN c.mascara_orcamento
           WHEN 'medicao' THEN c.mascara_medicao
           WHEN 'contrato' THEN c.mascara_contrato
           WHEN 'nf' THEN c.mascara_nf
         END
    INTO v_mascara
    FROM public.empresa_config c
   WHERE c.empresa_id = _empresa_id;

  IF v_mascara IS NULL OR btrim(v_mascara) = '' THEN
    v_mascara := upper(left(_tipo, 3)) || '-{ano}-{seq}';
  END IF;

  v_mascara := replace(v_mascara, '{ano}', v_ano::text);
  v_mascara := replace(v_mascara, '{ano2}', right(v_ano::text, 2));
  v_mascara := replace(v_mascara, '{mes}', lpad(v_mes::text, 2, '0'));
  v_mascara := replace(v_mascara, '{seq}', lpad(v_seq::text, 4, '0'));
  RETURN v_mascara;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.proximo_numero_documento(uuid, text, date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.proximo_numero_documento(uuid, text, date) TO authenticated, service_role;

-- 4) Orçamento passa a usar a sequência
CREATE OR REPLACE FUNCTION public.gerar_numero_orcamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.numero IS NULL OR btrim(NEW.numero) = '' THEN
    NEW.numero := public.proximo_numero_documento(NEW.empresa_id, 'orcamento', COALESCE(NEW.data_emissao, CURRENT_DATE));
  END IF;
  RETURN NEW;
END;
$$;

-- 5) Semear config para empresas existentes e novas
INSERT INTO public.empresa_config (empresa_id, cprb, regime_tributario)
SELECT e.id, COALESCE(e.cprb, false), e.regime_tributario FROM public.empresas e
ON CONFLICT (empresa_id) DO NOTHING;

-- Contadores alinhados aos orçamentos já existentes
INSERT INTO public.documento_contadores (empresa_id, tipo, ano, ultimo_numero)
SELECT o.empresa_id, 'orcamento',
       EXTRACT(YEAR FROM COALESCE(o.data_emissao, o.created_at::date))::int,
       COALESCE(MAX(NULLIF(regexp_replace(COALESCE(o.numero, ''), '\D', '', 'g'), ''))::bigint % 10000, 0)::int
  FROM public.orcamentos o
 WHERE o.numero IS NOT NULL
 GROUP BY o.empresa_id, EXTRACT(YEAR FROM COALESCE(o.data_emissao, o.created_at::date))::int
ON CONFLICT (empresa_id, tipo, ano) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_nova_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_categorias_financeiras(NEW.id);

  INSERT INTO public.categoria_grupos (empresa_id, chave, nome, tipo, papel, ordem)
  SELECT NEW.id, g.chave, g.nome, g.tipo::public.lancamento_tipo, g.papel, g.ordem FROM (VALUES
    ('receita_servico','Receita de serviço','receita','receita_servico',1),
    ('receita_material','Receita de material','receita',NULL,2),
    ('receita_outro','Outras receitas','receita',NULL,3),
    ('custo_mao_obra_direta','Mão de obra direta','despesa',NULL,4),
    ('custo_mao_obra_indireta','Mão de obra indireta','despesa',NULL,5),
    ('custo_material','Materiais e insumos','despesa','material',6),
    ('custo_equipamento','Equipamentos','despesa',NULL,7),
    ('custo_subcontratado','Subcontratados','despesa','subcontratado',8),
    ('custo_administrativo','Administrativo','despesa',NULL,9),
    ('custo_imposto','Impostos e taxas','despesa',NULL,10),
    ('custo_outro','Outros custos','despesa',NULL,11)
  ) AS g(chave,nome,tipo,papel,ordem)
  ON CONFLICT DO NOTHING;

  UPDATE public.categorias_financeiras cf SET grupo_id = cg.id
    FROM public.categoria_grupos cg
   WHERE cg.empresa_id = NEW.id AND cf.empresa_id = NEW.id AND cg.chave = cf.grupo::text;

  PERFORM public.seed_listas_opcoes(NEW.id);
  PERFORM public.seed_perfis_permissao(NEW.id);

  INSERT INTO public.obra_status_config (empresa_id, chave, nome, cor, ordem, categoria, padrao)
  VALUES
    (NEW.id,'planejada','Planejada','#64748B',1,'nao_iniciada',true),
    (NEW.id,'em_execucao','Em execução','#3B82F6',2,'em_execucao',true),
    (NEW.id,'pausada','Pausada','#F59E0B',3,'em_execucao',false),
    (NEW.id,'concluida','Concluída','#10B981',4,'concluida',true),
    (NEW.id,'cancelada','Cancelada','#EF4444',5,'cancelada',true)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.empresa_rotulos (empresa_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.empresa_config (empresa_id, cprb, regime_tributario)
  VALUES (NEW.id, COALESCE(NEW.cprb, false), NEW.regime_tributario) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;