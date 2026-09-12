-- ============ 1) Tabelas de configuração ============
CREATE TABLE public.obra_status_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_user_empresa_id(),
  chave text NOT NULL,
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#64748B',
  ordem integer NOT NULL DEFAULT 0,
  categoria text NOT NULL DEFAULT 'em_execucao'
    CHECK (categoria IN ('nao_iniciada','em_execucao','concluida','cancelada')),
  ativo boolean NOT NULL DEFAULT true,
  padrao boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX obra_status_config_empresa_chave_uk ON public.obra_status_config (empresa_id, chave);
CREATE INDEX obra_status_config_empresa_idx ON public.obra_status_config (empresa_id, ordem);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_status_config TO authenticated;
GRANT ALL ON public.obra_status_config TO service_role;
ALTER TABLE public.obra_status_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY obra_status_config_select ON public.obra_status_config FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY obra_status_config_insert ON public.obra_status_config FOR INSERT TO authenticated
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'obras','edit')));
CREATE POLICY obra_status_config_update ON public.obra_status_config FOR UPDATE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'obras','edit')))
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'obras','edit')));
CREATE POLICY obra_status_config_delete ON public.obra_status_config FOR DELETE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'obras','delete')));
CREATE TRIGGER trg_obra_status_config_updated BEFORE UPDATE ON public.obra_status_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.empresa_rotulos (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_user_empresa_id(),
  obra_singular text NOT NULL DEFAULT 'Obra',
  obra_plural text NOT NULL DEFAULT 'Obras',
  codigo_obra text NOT NULL DEFAULT 'Código da obra',
  comprador text NOT NULL DEFAULT 'Comprador',
  cliente text NOT NULL DEFAULT 'Cliente',
  orcamento text NOT NULL DEFAULT 'Orçamento',
  medicao text NOT NULL DEFAULT 'Medição',
  usa_codigo_obra boolean NOT NULL DEFAULT true,
  usa_regiao boolean NOT NULL DEFAULT true,
  usa_engenheiro boolean NOT NULL DEFAULT true,
  usa_comprador boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_rotulos TO authenticated;
GRANT ALL ON public.empresa_rotulos TO service_role;
ALTER TABLE public.empresa_rotulos ENABLE ROW LEVEL SECURITY;
CREATE POLICY empresa_rotulos_select ON public.empresa_rotulos FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY empresa_rotulos_insert ON public.empresa_rotulos FOR INSERT TO authenticated
  WITH CHECK (public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid()));
CREATE POLICY empresa_rotulos_update ON public.empresa_rotulos FOR UPDATE TO authenticated
  USING (public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid()));
CREATE POLICY empresa_rotulos_delete ON public.empresa_rotulos FOR DELETE TO authenticated
  USING (public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid()));
CREATE TRIGGER trg_empresa_rotulos_updated BEFORE UPDATE ON public.empresa_rotulos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 2) Seed das empresas existentes (mantém o fluxo atual) ============
INSERT INTO public.obra_status_config (empresa_id, chave, nome, cor, ordem, categoria, padrao)
SELECT e.id, s.chave, s.nome, s.cor, s.ordem, s.categoria, s.padrao
FROM public.empresas e
CROSS JOIN (VALUES
  ('recebido','Recebido','#64748B',1,'nao_iniciada',true),
  ('em_vistoria','Em vistoria','#0EA5E9',2,'nao_iniciada',false),
  ('aguardando_orcamento','Aguardando orçamento','#8B5CF6',3,'nao_iniciada',false),
  ('em_aprovacao','Em aprovação','#F59E0B',4,'nao_iniciada',false),
  ('aprovado','Aprovado','#22C55E',5,'nao_iniciada',false),
  ('em_execucao','Em execução','#3B82F6',6,'em_execucao',true),
  ('finalizado','Finalizado','#10B981',7,'concluida',true),
  ('aguardando_rc','Aguardando RC','#A855F7',8,'em_execucao',false),
  ('aguardando_pedido_compra','Aguardando PC','#EC4899',9,'em_execucao',false),
  ('aguardando_nf','Aguardando NF','#F97316',10,'em_execucao',false),
  ('aguardando_pagamento','Aguardando pagamento','#EAB308',11,'em_execucao',false),
  ('pago','Pago','#16A34A',12,'concluida',false)
) AS s(chave,nome,cor,ordem,categoria,padrao);

INSERT INTO public.empresa_rotulos (empresa_id, codigo_obra)
SELECT e.id, 'Chamado' FROM public.empresas e;

-- ============ 3) obras.status deixa de ser enum ============
ALTER TABLE public.obras ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.obras ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.obras ALTER COLUMN status SET DEFAULT 'recebido';
ALTER TABLE public.obras ALTER COLUMN origem DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.obra_status_padrao(_empresa uuid, _categoria text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT chave FROM public.obra_status_config
   WHERE empresa_id = _empresa AND categoria = _categoria AND ativo
   ORDER BY padrao DESC, ordem ASC LIMIT 1;
$function$;
REVOKE EXECUTE ON FUNCTION public.obra_status_padrao(uuid,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.obra_status_padrao(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_valida_obra_status()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS NULL THEN
    NEW.status := COALESCE(public.obra_status_padrao(NEW.empresa_id,'nao_iniciada'),
                           public.obra_status_padrao(NEW.empresa_id,'em_execucao'));
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.obra_status_config c
                  WHERE c.empresa_id = NEW.empresa_id AND c.chave = NEW.status) THEN
    RAISE EXCEPTION 'status_nao_configurado';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.fn_valida_obra_status() FROM anon, authenticated, public;
CREATE TRIGGER trg_valida_obra_status BEFORE INSERT OR UPDATE OF status ON public.obras
  FOR EACH ROW EXECUTE FUNCTION public.fn_valida_obra_status();

-- ============ 4) Triggers por categoria ============
CREATE OR REPLACE FUNCTION public.sync_obra_status_from_orcamento()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_obra_emp uuid;
  v_cat text;
  v_alvo text;
BEGIN
  IF NEW.obra_id IS NULL THEN RETURN NEW; END IF;
  SELECT empresa_id INTO v_obra_emp FROM public.obras WHERE id = NEW.obra_id;
  IF v_obra_emp IS NULL OR v_obra_emp IS DISTINCT FROM NEW.empresa_id THEN
    RAISE EXCEPTION 'Obra de outra empresa';
  END IF;

  SELECT c.categoria INTO v_cat
    FROM public.obras o
    JOIN public.obra_status_config c
      ON c.empresa_id = o.empresa_id AND c.chave = o.status
   WHERE o.id = NEW.obra_id;

  IF NEW.status = 'enviado' AND OLD.status IS DISTINCT FROM 'enviado'
     AND COALESCE(v_cat,'nao_iniciada') = 'nao_iniciada' THEN
    SELECT chave INTO v_alvo FROM public.obra_status_config
     WHERE empresa_id = v_obra_emp AND chave = 'em_aprovacao' AND ativo;
    IF v_alvo IS NOT NULL THEN
      UPDATE public.obras SET status = v_alvo, updated_at = now()
       WHERE id = NEW.obra_id AND empresa_id = v_obra_emp;
    END IF;
  END IF;

  IF NEW.status = 'aprovado' AND OLD.status IS DISTINCT FROM 'aprovado' THEN
    IF COALESCE(v_cat,'nao_iniciada') = 'nao_iniciada' THEN
      v_alvo := public.obra_status_padrao(v_obra_emp,'em_execucao');
      IF v_alvo IS NOT NULL THEN
        UPDATE public.obras SET status = v_alvo, updated_at = now()
         WHERE id = NEW.obra_id AND empresa_id = v_obra_emp;
      END IF;
    END IF;
    INSERT INTO public.obra_timeline (obra_id, evento, detalhes, empresa_id)
    VALUES (NEW.obra_id, 'Orçamento aprovado',
            'Orçamento aprovado no valor de ' || COALESCE(NEW.valor_total, NEW.valor_orcamento, 0),
            v_obra_emp);
  END IF;
  RETURN NEW;
END $function$;

-- ============ 5) RPCs de obra sem valores do fluxo antigo ============
CREATE OR REPLACE FUNCTION public.criar_obra_segura(_codigo_chamado text, _origem text, _regiao_label text, _engenheiro_responsavel text, _descricao_servico text, _endereco text, _data_recebimento date)
RETURNS obras
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_empresa_id uuid;
  v_obra public.obras;
  v_codigo text;
  v_status text;
  v_rot text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT ur.empresa_id INTO v_empresa_id
  FROM public.user_roles ur
  WHERE ur.user_id = v_uid AND ur.empresa_id IS NOT NULL
  ORDER BY ur.created_at ASC LIMIT 1;

  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'empresa_nao_identificada'; END IF;
  IF NOT public.tenant_can_write(v_empresa_id) THEN RAISE EXCEPTION 'assinatura_inativa'; END IF;
  IF NOT (
    public.is_admin_or_super(v_uid)
    OR public.has_permission(v_uid, 'obras'::public.app_modulo, 'create'::public.app_acao)
  ) THEN
    RAISE EXCEPTION 'sem_permissao_criar_obra';
  END IF;

  IF COALESCE(NULLIF(trim(_codigo_chamado), ''), '') = '' THEN
    v_codigo := 'OBRA-' || to_char(now(), 'YYMMDD') || '-' || substr(md5(random()::text), 1, 5);
  ELSE
    v_codigo := trim(_codigo_chamado);
  END IF;

  v_status := COALESCE(public.obra_status_padrao(v_empresa_id,'nao_iniciada'),
                       public.obra_status_padrao(v_empresa_id,'em_execucao'));
  IF v_status IS NULL THEN RAISE EXCEPTION 'status_nao_configurado'; END IF;

  INSERT INTO public.obras (
    empresa_id, codigo_chamado, origem, regiao_label,
    engenheiro_responsavel, descricao_servico, endereco, data_recebimento, created_by, status
  ) VALUES (
    v_empresa_id, v_codigo,
    COALESCE(NULLIF(trim(_origem), ''), ''),
    NULLIF(trim(_regiao_label), ''),
    NULLIF(trim(_engenheiro_responsavel), ''),
    NULLIF(trim(_descricao_servico), ''),
    NULLIF(trim(_endereco), ''),
    COALESCE(_data_recebimento, CURRENT_DATE),
    v_uid, v_status
  )
  RETURNING * INTO v_obra;

  SELECT COALESCE(r.obra_singular,'Obra') INTO v_rot
    FROM public.empresa_rotulos r WHERE r.empresa_id = v_empresa_id;

  INSERT INTO public.obra_timeline (obra_id, empresa_id, user_id, evento, detalhes)
  VALUES (v_obra.id, v_empresa_id, v_uid, COALESCE(v_rot,'Obra') || ' criada',
          COALESCE(v_rot,'Obra') || ' ' || v_obra.codigo_chamado || ' cadastrada no sistema');

  RETURN v_obra;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.criar_obra_segura(text,text,text,text,text,text,date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.criar_obra_segura(text,text,text,text,text,text,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_obra_for_chamado(_chamado text, _descricao text, _endereco text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa uuid := public.get_user_empresa_id();
  v_obra_id uuid;
  v_status text;
BEGIN
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'empresa_nao_identificada'; END IF;
  IF NOT public.tenant_can_write(v_empresa) THEN RAISE EXCEPTION 'assinatura_inativa'; END IF;
  IF NOT (public.is_admin_or_super(auth.uid())
          OR public.has_permission(auth.uid(), 'orcamentos', 'create')
          OR public.has_permission(auth.uid(), 'orcamentos', 'edit')) THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;

  SELECT id INTO v_obra_id FROM public.obras
   WHERE empresa_id = v_empresa AND codigo_chamado = _chamado LIMIT 1;

  SELECT COALESCE(
    (SELECT chave FROM public.obra_status_config
      WHERE empresa_id = v_empresa AND chave = 'em_aprovacao' AND ativo),
    public.obra_status_padrao(v_empresa,'nao_iniciada')
  ) INTO v_status;

  IF v_obra_id IS NULL THEN
    INSERT INTO public.obras (empresa_id, codigo_chamado, status, descricao_servico, endereco, created_by)
    VALUES (v_empresa, _chamado, v_status, _descricao, _endereco, auth.uid())
    RETURNING id INTO v_obra_id;
  ELSE
    UPDATE public.obras
       SET status = COALESCE(v_status, status),
           descricao_servico = COALESCE(_descricao, descricao_servico),
           endereco = COALESCE(_endereco, endereco),
           updated_at = now()
     WHERE id = v_obra_id AND empresa_id = v_empresa
       AND EXISTS (SELECT 1 FROM public.obra_status_config c
                    WHERE c.empresa_id = v_empresa AND c.chave = obras.status
                      AND c.categoria = 'nao_iniciada');
  END IF;

  RETURN v_obra_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.ensure_obra_for_chamado(text,text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ensure_obra_for_chamado(text,text,text) TO authenticated;

-- ============ 6) Empresa nova: conjunto genérico, sem regiões/origens ============
CREATE OR REPLACE FUNCTION public.handle_nova_empresa()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.seed_categorias_financeiras(NEW.id);

  INSERT INTO public.obra_status_config (empresa_id, chave, nome, cor, ordem, categoria, padrao)
  VALUES
    (NEW.id,'planejada','Planejada','#64748B',1,'nao_iniciada',true),
    (NEW.id,'em_execucao','Em execução','#3B82F6',2,'em_execucao',true),
    (NEW.id,'pausada','Pausada','#F59E0B',3,'em_execucao',false),
    (NEW.id,'concluida','Concluída','#10B981',4,'concluida',true),
    (NEW.id,'cancelada','Cancelada','#EF4444',5,'cancelada',true)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.empresa_rotulos (empresa_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $function$;

-- ============ 7) Resíduos do negócio antigo ============
DROP TYPE IF EXISTS public.obra_origem;