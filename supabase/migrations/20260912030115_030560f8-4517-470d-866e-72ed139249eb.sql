-- 1) Regra de assinatura igual ao SubscriptionGate
CREATE OR REPLACE FUNCTION public.empresa_assinatura_ativa(_empresa_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.assinaturas
    where empresa_id = _empresa_id
      and (
        status in ('active','past_due')
        or (status = 'trialing' and trial_ends_at is not null and trial_ends_at > now())
      )
  );
$function$;

-- 3) empresa_dashboard_config: separar leitura de escrita
DROP POLICY IF EXISTS dashboard_config_upsert ON public.empresa_dashboard_config;
CREATE POLICY dashboard_config_insert ON public.empresa_dashboard_config
  FOR INSERT TO authenticated
  WITH CHECK (public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid()));
CREATE POLICY dashboard_config_update ON public.empresa_dashboard_config
  FOR UPDATE TO authenticated
  USING (public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid()));
CREATE POLICY dashboard_config_delete ON public.empresa_dashboard_config
  FOR DELETE TO authenticated
  USING (public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid()));

-- obra_adendos UPDATE precisa de tenant_can_write
DROP POLICY IF EXISTS obra_adendos_update ON public.obra_adendos;
CREATE POLICY obra_adendos_update ON public.obra_adendos
  FOR UPDATE TO authenticated
  USING (public.tenant_can_write(empresa_id) AND public.can_access_obra(auth.uid(), obra_id)
         AND public.mesmo_tenant('obras'::regclass, obra_id, empresa_id))
  WITH CHECK (public.tenant_can_write(empresa_id) AND public.can_access_obra(auth.uid(), obra_id)
         AND public.mesmo_tenant('obras'::regclass, obra_id, empresa_id));

-- RPCs de obra: exigir assinatura ativa
CREATE OR REPLACE FUNCTION public.criar_obra_segura(_codigo_chamado text, _origem text, _regiao_label text, _engenheiro_responsavel text, _descricao_servico text, _endereco text, _data_recebimento date)
RETURNS obras
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_empresa_id uuid;
  v_obra public.obras;
  v_codigo text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT ur.empresa_id INTO v_empresa_id
  FROM public.user_roles ur
  WHERE ur.user_id = v_uid AND ur.empresa_id IS NOT NULL
  ORDER BY ur.created_at ASC LIMIT 1;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa_nao_identificada';
  END IF;

  IF NOT public.tenant_can_write(v_empresa_id) THEN
    RAISE EXCEPTION 'assinatura_inativa';
  END IF;

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

  INSERT INTO public.obras (
    empresa_id, codigo_chamado, origem, regiao, regiao_label,
    engenheiro_responsavel, descricao_servico, endereco, data_recebimento, created_by
  ) VALUES (
    v_empresa_id, v_codigo,
    COALESCE(NULLIF(trim(_origem), ''), 'Sabesp'),
    'leste'::public.obra_regiao,
    NULLIF(trim(_regiao_label), ''),
    NULLIF(trim(_engenheiro_responsavel), ''),
    NULLIF(trim(_descricao_servico), ''),
    NULLIF(trim(_endereco), ''),
    COALESCE(_data_recebimento, CURRENT_DATE),
    v_uid
  )
  RETURNING * INTO v_obra;

  INSERT INTO public.obra_timeline (obra_id, empresa_id, user_id, evento, detalhes)
  VALUES (v_obra.id, v_empresa_id, v_uid, 'Obra criada',
          'Chamado ' || v_obra.codigo_chamado || ' cadastrado no sistema');

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
BEGIN
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'empresa_nao_identificada';
  END IF;
  IF NOT public.tenant_can_write(v_empresa) THEN
    RAISE EXCEPTION 'assinatura_inativa';
  END IF;
  IF NOT (public.is_admin_or_super(auth.uid())
          OR public.has_permission(auth.uid(), 'orcamentos', 'create')
          OR public.has_permission(auth.uid(), 'orcamentos', 'edit')) THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;

  SELECT id INTO v_obra_id FROM public.obras
   WHERE empresa_id = v_empresa AND codigo_chamado = _chamado
   LIMIT 1;

  IF v_obra_id IS NULL THEN
    INSERT INTO public.obras (empresa_id, codigo_chamado, status, descricao_servico, endereco, created_by)
    VALUES (v_empresa, _chamado, 'em_aprovacao', _descricao, _endereco, auth.uid())
    RETURNING id INTO v_obra_id;
  ELSE
    UPDATE public.obras
       SET status = 'em_aprovacao',
           descricao_servico = COALESCE(_descricao, descricao_servico),
           endereco = COALESCE(_endereco, endereco),
           updated_at = now()
     WHERE id = v_obra_id AND empresa_id = v_empresa;
  END IF;

  RETURN v_obra_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.ensure_obra_for_chamado(text,text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ensure_obra_for_chamado(text,text,text) TO authenticated;

-- Storage: escrita exige assinatura ativa
DROP POLICY IF EXISTS obras_fotos_insert ON storage.objects;
CREATE POLICY obras_fotos_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'obras-fotos'
    AND public.can_access_obra(auth.uid(), ((storage.foldername(name))[1])::uuid)
    AND public.empresa_assinatura_ativa(public.get_user_empresa_id()));
DROP POLICY IF EXISTS obras_fotos_update ON storage.objects;
CREATE POLICY obras_fotos_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'obras-fotos'
    AND public.can_access_obra(auth.uid(), ((storage.foldername(name))[1])::uuid)
    AND public.empresa_assinatura_ativa(public.get_user_empresa_id()))
  WITH CHECK (bucket_id = 'obras-fotos'
    AND public.can_access_obra(auth.uid(), ((storage.foldername(name))[1])::uuid)
    AND public.empresa_assinatura_ativa(public.get_user_empresa_id()));
DROP POLICY IF EXISTS obras_fotos_delete ON storage.objects;
CREATE POLICY obras_fotos_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'obras-fotos'
    AND (public.is_admin_or_super(auth.uid()) OR public.can_access_obra(auth.uid(), ((storage.foldername(name))[1])::uuid))
    AND public.empresa_assinatura_ativa(public.get_user_empresa_id()));

DROP POLICY IF EXISTS orcamentos_anexos_insert ON storage.objects;
CREATE POLICY orcamentos_anexos_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'orcamentos-anexos'
    AND public.can_access_obra(auth.uid(), ((storage.foldername(name))[1])::uuid)
    AND public.empresa_assinatura_ativa(public.get_user_empresa_id()));
DROP POLICY IF EXISTS orcamentos_anexos_update ON storage.objects;
CREATE POLICY orcamentos_anexos_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'orcamentos-anexos'
    AND public.can_access_obra(auth.uid(), ((storage.foldername(name))[1])::uuid)
    AND public.empresa_assinatura_ativa(public.get_user_empresa_id()))
  WITH CHECK (bucket_id = 'orcamentos-anexos'
    AND public.can_access_obra(auth.uid(), ((storage.foldername(name))[1])::uuid)
    AND public.empresa_assinatura_ativa(public.get_user_empresa_id()));
DROP POLICY IF EXISTS orcamentos_anexos_delete ON storage.objects;
CREATE POLICY orcamentos_anexos_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'orcamentos-anexos'
    AND (public.is_admin_or_super(auth.uid()) OR public.can_access_obra(auth.uid(), ((storage.foldername(name))[1])::uuid))
    AND public.empresa_assinatura_ativa(public.get_user_empresa_id()));

DROP POLICY IF EXISTS comprovantes_ins_admin ON storage.objects;
CREATE POLICY comprovantes_ins_admin ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comprovantes-pagamento'
    AND public.can_access_contratacao(auth.uid(), ((storage.foldername(name))[1])::uuid)
    AND public.empresa_assinatura_ativa(public.get_user_empresa_id()));
DROP POLICY IF EXISTS comprovantes_upd_admin ON storage.objects;
CREATE POLICY comprovantes_upd_admin ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'comprovantes-pagamento'
    AND public.can_access_contratacao(auth.uid(), ((storage.foldername(name))[1])::uuid)
    AND public.empresa_assinatura_ativa(public.get_user_empresa_id()))
  WITH CHECK (bucket_id = 'comprovantes-pagamento'
    AND public.can_access_contratacao(auth.uid(), ((storage.foldername(name))[1])::uuid)
    AND public.empresa_assinatura_ativa(public.get_user_empresa_id()));
DROP POLICY IF EXISTS comprovantes_del_admin ON storage.objects;
CREATE POLICY comprovantes_del_admin ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'comprovantes-pagamento'
    AND public.can_access_contratacao(auth.uid(), ((storage.foldername(name))[1])::uuid)
    AND public.empresa_assinatura_ativa(public.get_user_empresa_id()));

DROP POLICY IF EXISTS "Materiais anexos insert" ON storage.objects;
CREATE POLICY "Materiais anexos insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'materiais-anexos'
    AND public.can_access_obra(auth.uid(), ((storage.foldername(name))[1])::uuid)
    AND public.empresa_assinatura_ativa(public.get_user_empresa_id()));
DROP POLICY IF EXISTS "Materiais anexos update" ON storage.objects;
CREATE POLICY "Materiais anexos update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'materiais-anexos'
    AND public.can_access_obra(auth.uid(), ((storage.foldername(name))[1])::uuid)
    AND public.empresa_assinatura_ativa(public.get_user_empresa_id()))
  WITH CHECK (bucket_id = 'materiais-anexos'
    AND public.can_access_obra(auth.uid(), ((storage.foldername(name))[1])::uuid)
    AND public.empresa_assinatura_ativa(public.get_user_empresa_id()));
DROP POLICY IF EXISTS "Materiais anexos delete" ON storage.objects;
CREATE POLICY "Materiais anexos delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'materiais-anexos'
    AND public.can_access_obra(auth.uid(), ((storage.foldername(name))[1])::uuid)
    AND public.empresa_assinatura_ativa(public.get_user_empresa_id()));

-- 4) pessoas-documentos: separar as quatro operações
DROP POLICY IF EXISTS pessoas_docs_all ON storage.objects;
CREATE POLICY pessoas_docs_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pessoas-documentos' AND (
    public.is_super_admin(auth.uid())
    OR ((storage.foldername(name))[1] = (public.get_user_empresa_id())::text
        AND (public.is_admin_or_super(auth.uid())
             OR public.has_permission(auth.uid(), 'equipes'::public.app_modulo, 'view'::public.app_acao)))));
CREATE POLICY pessoas_docs_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pessoas-documentos'
    AND (storage.foldername(name))[1] = (public.get_user_empresa_id())::text
    AND public.tenant_can_write(public.get_user_empresa_id())
    AND (public.is_admin_or_super(auth.uid())
         OR public.has_permission(auth.uid(), 'equipes'::public.app_modulo, 'create'::public.app_acao)
         OR public.has_permission(auth.uid(), 'equipes'::public.app_modulo, 'edit'::public.app_acao)));
CREATE POLICY pessoas_docs_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pessoas-documentos'
    AND (storage.foldername(name))[1] = (public.get_user_empresa_id())::text
    AND public.tenant_can_write(public.get_user_empresa_id())
    AND (public.is_admin_or_super(auth.uid())
         OR public.has_permission(auth.uid(), 'equipes'::public.app_modulo, 'edit'::public.app_acao)))
  WITH CHECK (bucket_id = 'pessoas-documentos'
    AND (storage.foldername(name))[1] = (public.get_user_empresa_id())::text
    AND public.tenant_can_write(public.get_user_empresa_id())
    AND (public.is_admin_or_super(auth.uid())
         OR public.has_permission(auth.uid(), 'equipes'::public.app_modulo, 'edit'::public.app_acao)));
CREATE POLICY pessoas_docs_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pessoas-documentos'
    AND (storage.foldername(name))[1] = (public.get_user_empresa_id())::text
    AND public.tenant_can_write(public.get_user_empresa_id())
    AND (public.is_admin_or_super(auth.uid())
         OR public.has_permission(auth.uid(), 'equipes'::public.app_modulo, 'delete'::public.app_acao)));

-- 3.e) Trigger genérico: obra_id sempre da mesma empresa
CREATE OR REPLACE FUNCTION public.fn_valida_obra_mesmo_tenant()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_emp uuid;
BEGIN
  IF NEW.obra_id IS NULL THEN RETURN NEW; END IF;
  SELECT o.empresa_id INTO v_emp FROM public.obras o WHERE o.id = NEW.obra_id;
  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'obra_inexistente';
  END IF;
  IF v_emp <> NEW.empresa_id THEN
    RAISE EXCEPTION 'obra_de_outra_empresa';
  END IF;
  RETURN NEW;
END;
$function$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['orcamentos','notas_fiscais','pedidos_compra','recebimentos','materiais_obra',
                           'cartao_despesas','contratacoes_terceirizado','obra_adendos','lancamentos_financeiros']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_valida_obra_tenant ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_valida_obra_tenant BEFORE INSERT OR UPDATE OF obra_id ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.fn_valida_obra_mesmo_tenant()', t);
  END LOOP;
END $$;