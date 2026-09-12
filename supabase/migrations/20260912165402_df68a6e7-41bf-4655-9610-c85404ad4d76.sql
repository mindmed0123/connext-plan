DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'perfil_operacao') THEN
    CREATE TYPE public.perfil_operacao AS ENUM ('prestadora_servico','obra_propria','manutencao');
  END IF;
END $$;

ALTER TABLE public.empresa_config ADD COLUMN IF NOT EXISTS perfil_operacao public.perfil_operacao;
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS exemplo boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.empresa_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_user_empresa_id(),
  modulo text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS empresa_modulos_empresa_modulo_key
  ON public.empresa_modulos (empresa_id, modulo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_modulos TO authenticated;
GRANT ALL ON public.empresa_modulos TO service_role;

ALTER TABLE public.empresa_modulos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empresa_modulos_select ON public.empresa_modulos;
CREATE POLICY empresa_modulos_select ON public.empresa_modulos
  FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_modulos.empresa_id));

DROP POLICY IF EXISTS empresa_modulos_insert ON public.empresa_modulos;
CREATE POLICY empresa_modulos_insert ON public.empresa_modulos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.tenant_can_write(empresa_modulos.empresa_id)
    AND public.is_admin_or_super(auth.uid())
  );

DROP POLICY IF EXISTS empresa_modulos_update ON public.empresa_modulos;
CREATE POLICY empresa_modulos_update ON public.empresa_modulos
  FOR UPDATE TO authenticated
  USING (
    public.tenant_can_write(empresa_modulos.empresa_id)
    AND public.is_admin_or_super(auth.uid())
  )
  WITH CHECK (
    public.tenant_can_write(empresa_modulos.empresa_id)
    AND public.is_admin_or_super(auth.uid())
  );

DROP POLICY IF EXISTS empresa_modulos_delete ON public.empresa_modulos;
CREATE POLICY empresa_modulos_delete ON public.empresa_modulos
  FOR DELETE TO authenticated
  USING (
    public.tenant_can_write(empresa_modulos.empresa_id)
    AND public.is_admin_or_super(auth.uid())
  );

DROP TRIGGER IF EXISTS trg_empresa_modulos_updated_at ON public.empresa_modulos;
CREATE TRIGGER trg_empresa_modulos_updated_at
  BEFORE UPDATE ON public.empresa_modulos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.aplicar_preset_perfil(_perfil public.perfil_operacao)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_empresa uuid;
  v_perfil_anterior public.perfil_operacao;
  v_obra_sing text;
  v_obra_plur text;
  v_cliente text;
  v_modulos text[];
  m text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  v_empresa := public.get_user_empresa_id();
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'empresa_nao_identificada'; END IF;
  IF NOT public.tenant_can_write(v_empresa) THEN RAISE EXCEPTION 'assinatura_inativa'; END IF;
  IF NOT public.is_admin_or_super(v_uid) THEN RAISE EXCEPTION 'sem_permissao'; END IF;

  SELECT c.perfil_operacao INTO v_perfil_anterior
    FROM public.empresa_config c WHERE c.empresa_id = v_empresa;

  IF _perfil = 'prestadora_servico' THEN
    v_obra_sing := 'Chamado'; v_obra_plur := 'Chamados'; v_cliente := 'Contratante';
    v_modulos := ARRAY['obras','etapas','diario','vistorias','orcamentos','servicos','execucoes',
                       'contratos','medicoes','faturamento','recebimentos','contas_pagar','bancos',
                       'cartoes','portal','equipes'];
  ELSIF _perfil = 'obra_propria' THEN
    v_obra_sing := 'Obra'; v_obra_plur := 'Obras'; v_cliente := 'Cliente';
    v_modulos := ARRAY['obras','etapas','diario','orcamentos','servicos','execucoes','compras',
                       'recebimentos','contas_pagar','bancos','cartoes','portal','equipes'];
  ELSE
    v_obra_sing := 'Ordem de serviço'; v_obra_plur := 'Ordens de serviço'; v_cliente := 'Cliente';
    v_modulos := ARRAY['obras','diario','orcamentos','servicos','execucoes','faturamento',
                       'recebimentos','equipes'];
  END IF;

  INSERT INTO public.empresa_config (empresa_id, perfil_operacao)
  VALUES (v_empresa, _perfil)
  ON CONFLICT (empresa_id) DO UPDATE SET perfil_operacao = EXCLUDED.perfil_operacao, updated_at = now()
  WHERE public.empresa_config.empresa_id = v_empresa;

  -- Liga somente o que ainda não foi decidido pela empresa: escolhas anteriores permanecem.
  FOREACH m IN ARRAY v_modulos LOOP
    INSERT INTO public.empresa_modulos (empresa_id, modulo, ativo)
    VALUES (v_empresa, m, true)
    ON CONFLICT (empresa_id, modulo) DO NOTHING;
  END LOOP;

  INSERT INTO public.empresa_rotulos (empresa_id, obra_singular, obra_plural, cliente)
  VALUES (v_empresa, v_obra_sing, v_obra_plur, v_cliente)
  ON CONFLICT (empresa_id) DO UPDATE
    SET obra_singular = EXCLUDED.obra_singular,
        obra_plural = EXCLUDED.obra_plural,
        cliente = EXCLUDED.cliente,
        updated_at = now()
  WHERE public.empresa_rotulos.empresa_id = v_empresa;

  -- Sugestões fiscais/comerciais só na primeira definição do perfil (nunca sobrescreve ajuste do cliente).
  IF v_perfil_anterior IS NULL THEN
    IF _perfil = 'prestadora_servico' THEN
      UPDATE public.empresa_config
         SET aliquota_inss_padrao = 11, aliquota_irrf_padrao = 1.5, aliquota_pcc_padrao = 4.65,
             prazo_pagamento_padrao = 30, updated_at = now()
       WHERE empresa_id = v_empresa;
    ELSE
      UPDATE public.empresa_config
         SET aliquota_inss_padrao = 0, aliquota_irrf_padrao = 0, aliquota_pcc_padrao = 0,
             prazo_pagamento_padrao = CASE WHEN _perfil = 'manutencao' THEN 15 ELSE 30 END,
             updated_at = now()
       WHERE empresa_id = v_empresa;
    END IF;
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.aplicar_preset_perfil(public.perfil_operacao) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.aplicar_preset_perfil(public.perfil_operacao) TO authenticated;