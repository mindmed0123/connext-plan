CREATE OR REPLACE FUNCTION public.ensure_obra_for_chamado(
  _chamado text,
  _descricao text,
  _endereco text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid := public.get_user_empresa_id();
  v_obra_id uuid;
BEGIN
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'empresa_nao_identificada';
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
     WHERE id = v_obra_id;
  END IF;

  RETURN v_obra_id;
END;
$$;