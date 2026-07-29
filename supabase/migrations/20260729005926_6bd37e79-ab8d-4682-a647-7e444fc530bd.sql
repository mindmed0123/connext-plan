CREATE OR REPLACE FUNCTION public.criar_obra_segura(
  _codigo_chamado text,
  _origem text,
  _regiao_label text,
  _engenheiro_responsavel text,
  _descricao_servico text,
  _endereco text,
  _data_recebimento date
)
RETURNS public.obras
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    v_empresa_id,
    v_codigo,
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
$$;