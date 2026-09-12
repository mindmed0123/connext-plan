
ALTER TABLE public.fotos_obra ADD COLUMN IF NOT EXISTS visivel_cliente boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.obra_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.get_user_empresa_id() REFERENCES public.empresas(id),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text,
  arquivo_path text,
  arquivo_nome text,
  visivel_cliente boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_obra_documentos_emp_obra ON public.obra_documentos(empresa_id, obra_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_documentos TO authenticated;
GRANT ALL ON public.obra_documentos TO service_role;
ALTER TABLE public.obra_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS obra_documentos_select ON public.obra_documentos;
CREATE POLICY obra_documentos_select ON public.obra_documentos FOR SELECT TO authenticated
USING (public.tenant_match(empresa_id) AND public.can_access_obra(auth.uid(), obra_id));
DROP POLICY IF EXISTS obra_documentos_insert ON public.obra_documentos;
CREATE POLICY obra_documentos_insert ON public.obra_documentos FOR INSERT TO authenticated
WITH CHECK (
  public.tenant_can_write(empresa_id)
  AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'obras'::public.app_modulo, 'create'::public.app_acao))
  AND EXISTS (SELECT 1 FROM public.obras p WHERE p.id = obra_id AND p.empresa_id = obra_documentos.empresa_id)
);
DROP POLICY IF EXISTS obra_documentos_update ON public.obra_documentos;
CREATE POLICY obra_documentos_update ON public.obra_documentos FOR UPDATE TO authenticated
USING (
  public.tenant_can_write(empresa_id)
  AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'obras'::public.app_modulo, 'edit'::public.app_acao))
  AND EXISTS (SELECT 1 FROM public.obras p WHERE p.id = obra_id AND p.empresa_id = obra_documentos.empresa_id)
)
WITH CHECK (
  public.tenant_can_write(empresa_id)
  AND EXISTS (SELECT 1 FROM public.obras p WHERE p.id = obra_id AND p.empresa_id = obra_documentos.empresa_id)
);
DROP POLICY IF EXISTS obra_documentos_delete ON public.obra_documentos;
CREATE POLICY obra_documentos_delete ON public.obra_documentos FOR DELETE TO authenticated
USING (
  public.tenant_can_write(empresa_id)
  AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'obras'::public.app_modulo, 'delete'::public.app_acao))
);
DROP TRIGGER IF EXISTS trg_obra_documentos_updated ON public.obra_documentos;
CREATE TRIGGER trg_obra_documentos_updated BEFORE UPDATE ON public.obra_documentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.obra_portal_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.get_user_empresa_id() REFERENCES public.empresas(id),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  token text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  expira_em timestamptz,
  criado_por uuid,
  ultimo_acesso timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_obra_portal_tokens_emp_token ON public.obra_portal_tokens(empresa_id, token);
CREATE INDEX IF NOT EXISTS idx_obra_portal_tokens_token ON public.obra_portal_tokens(token);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_portal_tokens TO authenticated;
GRANT ALL ON public.obra_portal_tokens TO service_role;
ALTER TABLE public.obra_portal_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS obra_portal_tokens_select ON public.obra_portal_tokens;
CREATE POLICY obra_portal_tokens_select ON public.obra_portal_tokens FOR SELECT TO authenticated
USING (public.tenant_match(empresa_id) AND public.can_access_obra(auth.uid(), obra_id));
DROP POLICY IF EXISTS obra_portal_tokens_insert ON public.obra_portal_tokens;
CREATE POLICY obra_portal_tokens_insert ON public.obra_portal_tokens FOR INSERT TO authenticated
WITH CHECK (
  public.tenant_can_write(empresa_id)
  AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'obras'::public.app_modulo, 'edit'::public.app_acao))
  AND EXISTS (SELECT 1 FROM public.obras p WHERE p.id = obra_id AND p.empresa_id = obra_portal_tokens.empresa_id)
);
DROP POLICY IF EXISTS obra_portal_tokens_update ON public.obra_portal_tokens;
CREATE POLICY obra_portal_tokens_update ON public.obra_portal_tokens FOR UPDATE TO authenticated
USING (
  public.tenant_can_write(empresa_id)
  AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'obras'::public.app_modulo, 'edit'::public.app_acao))
  AND EXISTS (SELECT 1 FROM public.obras p WHERE p.id = obra_id AND p.empresa_id = obra_portal_tokens.empresa_id)
)
WITH CHECK (
  public.tenant_can_write(empresa_id)
  AND EXISTS (SELECT 1 FROM public.obras p WHERE p.id = obra_id AND p.empresa_id = obra_portal_tokens.empresa_id)
);
DROP POLICY IF EXISTS obra_portal_tokens_delete ON public.obra_portal_tokens;
CREATE POLICY obra_portal_tokens_delete ON public.obra_portal_tokens FOR DELETE TO authenticated
USING (
  public.tenant_can_write(empresa_id)
  AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'obras'::public.app_modulo, 'edit'::public.app_acao))
);
DROP TRIGGER IF EXISTS trg_obra_portal_tokens_updated ON public.obra_portal_tokens;
CREATE TRIGGER trg_obra_portal_tokens_updated BEFORE UPDATE ON public.obra_portal_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.obra_portal_acessos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.get_user_empresa_id() REFERENCES public.empresas(id),
  token_id uuid NOT NULL REFERENCES public.obra_portal_tokens(id) ON DELETE CASCADE,
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  acessado_em timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text
);
CREATE INDEX IF NOT EXISTS idx_portal_acessos_emp_obra ON public.obra_portal_acessos(empresa_id, obra_id, acessado_em DESC);
GRANT SELECT ON public.obra_portal_acessos TO authenticated;
GRANT ALL ON public.obra_portal_acessos TO service_role;
ALTER TABLE public.obra_portal_acessos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS obra_portal_acessos_select ON public.obra_portal_acessos;
CREATE POLICY obra_portal_acessos_select ON public.obra_portal_acessos FOR SELECT TO authenticated
USING (public.tenant_match(empresa_id) AND public.can_access_obra(auth.uid(), obra_id));
DROP POLICY IF EXISTS obra_portal_acessos_insert ON public.obra_portal_acessos;
CREATE POLICY obra_portal_acessos_insert ON public.obra_portal_acessos FOR INSERT TO authenticated
WITH CHECK (
  public.tenant_can_write(empresa_id)
  AND EXISTS (SELECT 1 FROM public.obras p WHERE p.id = obra_id AND p.empresa_id = obra_portal_acessos.empresa_id)
);
DROP POLICY IF EXISTS obra_portal_acessos_update ON public.obra_portal_acessos;
CREATE POLICY obra_portal_acessos_update ON public.obra_portal_acessos FOR UPDATE TO authenticated
USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS obra_portal_acessos_delete ON public.obra_portal_acessos;
CREATE POLICY obra_portal_acessos_delete ON public.obra_portal_acessos FOR DELETE TO authenticated
USING (public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_portal_obra(_token text, _ip text DEFAULT NULL, _user_agent text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE t record; v_obra record; v jsonb;
BEGIN
  IF _token IS NULL OR length(_token) < 20 THEN
    RETURN jsonb_build_object('erro', 'invalido');
  END IF;

  SELECT * INTO t FROM public.obra_portal_tokens WHERE token = _token LIMIT 1;
  IF t IS NULL OR NOT t.ativo THEN RETURN jsonb_build_object('erro', 'invalido'); END IF;
  IF t.expira_em IS NOT NULL AND t.expira_em < now() THEN RETURN jsonb_build_object('erro', 'expirado'); END IF;

  SELECT o.* INTO v_obra FROM public.obras o WHERE o.id = t.obra_id AND o.empresa_id = t.empresa_id;
  IF v_obra IS NULL THEN RETURN jsonb_build_object('erro', 'invalido'); END IF;

  UPDATE public.obra_portal_tokens SET ultimo_acesso = now()
   WHERE id = t.id AND empresa_id = t.empresa_id;
  INSERT INTO public.obra_portal_acessos (empresa_id, token_id, obra_id, ip, user_agent)
  VALUES (t.empresa_id, t.id, t.obra_id, _ip, _user_agent);

  SELECT jsonb_build_object(
    'obra', jsonb_build_object(
      'codigo', v_obra.codigo_chamado,
      'descricao', v_obra.descricao_servico,
      'endereco', v_obra.endereco,
      'status', v_obra.status,
      'data_recebimento', v_obra.data_recebimento,
      'responsavel', v_obra.engenheiro_responsavel
    ),
    'empresa', (SELECT jsonb_build_object('nome', e.nome, 'logo_url', e.logo_url)
                  FROM public.empresas e WHERE e.id = t.empresa_id),
    'etapas', COALESCE((SELECT jsonb_agg(jsonb_build_object('nome', et.nome, 'ordem', et.ordem) ORDER BY et.ordem)
                  FROM public.obra_etapas et
                 WHERE et.obra_id = t.obra_id AND et.empresa_id = t.empresa_id), '[]'::jsonb),
    'cronograma', COALESCE((SELECT jsonb_agg(jsonb_build_object('mes', c.mes, 'percentual_previsto', c.percentual_previsto) ORDER BY c.mes)
                  FROM public.cronograma_etapas c
                 WHERE c.obra_id = t.obra_id AND c.empresa_id = t.empresa_id), '[]'::jsonb),
    'fotos', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                          'storage_path', f.storage_path, 'imagem_url', f.imagem_url,
                          'tipo', f.tipo, 'observacao', f.observacao, 'data', f.data_upload)
                          ORDER BY f.data_upload DESC)
                  FROM public.fotos_obra f
                 WHERE f.obra_id = t.obra_id AND f.empresa_id = t.empresa_id AND f.visivel_cliente), '[]'::jsonb),
    'medicoes', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                          'numero', m.numero_medicao, 'referencia', m.referencia,
                          'data', m.data_medicao, 'percentual', m.percentual)
                          ORDER BY m.data_medicao)
                  FROM public.medicoes m
                 WHERE m.obra_id = t.obra_id AND m.empresa_id = t.empresa_id AND m.status = 'aprovada'), '[]'::jsonb),
    'documentos', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                          'nome', d.nome, 'tipo', d.tipo, 'arquivo_path', d.arquivo_path,
                          'arquivo_nome', d.arquivo_nome, 'data', d.created_at)
                          ORDER BY d.created_at DESC)
                  FROM public.obra_documentos d
                 WHERE d.obra_id = t.obra_id AND d.empresa_id = t.empresa_id AND d.visivel_cliente), '[]'::jsonb)
  ) INTO v;

  RETURN v;
END; $$;
REVOKE EXECUTE ON FUNCTION public.get_portal_obra(text, text, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.get_portal_obra(text, text, text) TO service_role;
