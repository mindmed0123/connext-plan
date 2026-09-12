-- ============ BDI POR ITEM ============
ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS bdi_pct numeric;

-- ============ MODELOS DE PROPOSTA ============
CREATE TABLE public.modelos_proposta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) DEFAULT public.get_user_empresa_id(),
  nome text NOT NULL,
  capa text,
  texto_introducao text,
  texto_condicoes text,
  texto_rodape text,
  mostra_bdi boolean NOT NULL DEFAULT false,
  padrao boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_modelos_proposta_nome ON public.modelos_proposta(empresa_id, lower(nome));
CREATE UNIQUE INDEX uq_modelos_proposta_padrao ON public.modelos_proposta(empresa_id) WHERE padrao;

CREATE TABLE public.proposta_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) DEFAULT public.get_user_empresa_id(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  modelo_id uuid REFERENCES public.modelos_proposta(id) ON DELETE SET NULL,
  versao integer NOT NULL DEFAULT 1,
  conteudo jsonb NOT NULL,
  gerado_por uuid DEFAULT auth.uid(),
  gerado_por_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_proposta_versoes ON public.proposta_versoes(empresa_id, orcamento_id, versao);

-- ============ ALÇADAS ============
CREATE TABLE public.alcadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) DEFAULT public.get_user_empresa_id(),
  documento text NOT NULL CHECK (documento IN ('orcamento','medicao','solicitacao','ordem_compra','pagamento')),
  valor_de numeric NOT NULL DEFAULT 0 CHECK (valor_de >= 0),
  valor_ate numeric,
  perfil_id uuid REFERENCES public.perfis_permissao(id) ON DELETE CASCADE,
  pessoa_id uuid REFERENCES public.pessoas(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alcada_tem_aprovador CHECK (perfil_id IS NOT NULL OR pessoa_id IS NOT NULL)
);
CREATE INDEX idx_alcadas_doc ON public.alcadas(empresa_id, documento, ordem);

CREATE TABLE public.aprovacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) DEFAULT public.get_user_empresa_id(),
  alcada_id uuid REFERENCES public.alcadas(id) ON DELETE SET NULL,
  documento text NOT NULL CHECK (documento IN ('orcamento','medicao','solicitacao','ordem_compra','pagamento')),
  registro_id uuid NOT NULL,
  descricao text,
  valor numeric NOT NULL DEFAULT 0,
  ordem integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','reprovado')),
  perfil_id uuid REFERENCES public.perfis_permissao(id) ON DELETE SET NULL,
  pessoa_id uuid REFERENCES public.pessoas(id) ON DELETE SET NULL,
  decidido_por uuid,
  decidido_em timestamptz,
  justificativa text,
  solicitado_por uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_aprovacoes_fila ON public.aprovacoes(empresa_id, status, documento);
CREATE INDEX idx_aprovacoes_registro ON public.aprovacoes(empresa_id, documento, registro_id);

-- ============ GRANTS ============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modelos_proposta TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposta_versoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alcadas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aprovacoes TO authenticated;
GRANT ALL ON public.modelos_proposta TO service_role;
GRANT ALL ON public.proposta_versoes TO service_role;
GRANT ALL ON public.alcadas TO service_role;
GRANT ALL ON public.aprovacoes TO service_role;

ALTER TABLE public.modelos_proposta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposta_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alcadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aprovacoes ENABLE ROW LEVEL SECURITY;

-- modelos_proposta
CREATE POLICY "mp_select" ON public.modelos_proposta FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY "mp_insert" ON public.modelos_proposta FOR INSERT TO authenticated
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','create')));
CREATE POLICY "mp_update" ON public.modelos_proposta FOR UPDATE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','edit')))
  WITH CHECK (public.tenant_can_write(empresa_id));
CREATE POLICY "mp_delete" ON public.modelos_proposta FOR DELETE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','delete')));

-- proposta_versoes
CREATE POLICY "pv_select" ON public.proposta_versoes FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY "pv_insert" ON public.proposta_versoes FOR INSERT TO authenticated
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','create'))
    AND public.mesmo_tenant('public.orcamentos', orcamento_id, empresa_id)
    AND public.mesmo_tenant('public.modelos_proposta', modelo_id, empresa_id));
CREATE POLICY "pv_update" ON public.proposta_versoes FOR UPDATE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','edit'))
    AND public.mesmo_tenant('public.orcamentos', orcamento_id, empresa_id)
    AND public.mesmo_tenant('public.modelos_proposta', modelo_id, empresa_id))
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND public.mesmo_tenant('public.orcamentos', orcamento_id, empresa_id)
    AND public.mesmo_tenant('public.modelos_proposta', modelo_id, empresa_id));
CREATE POLICY "pv_delete" ON public.proposta_versoes FOR DELETE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'orcamentos','delete')));

-- alcadas (somente administração configura)
CREATE POLICY "alc_select" ON public.alcadas FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY "alc_insert" ON public.alcadas FOR INSERT TO authenticated
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND public.is_admin_or_super(auth.uid())
    AND public.mesmo_tenant('public.perfis_permissao', perfil_id, empresa_id)
    AND public.mesmo_tenant('public.pessoas', pessoa_id, empresa_id));
CREATE POLICY "alc_update" ON public.alcadas FOR UPDATE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND public.is_admin_or_super(auth.uid())
    AND public.mesmo_tenant('public.perfis_permissao', perfil_id, empresa_id)
    AND public.mesmo_tenant('public.pessoas', pessoa_id, empresa_id))
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND public.mesmo_tenant('public.perfis_permissao', perfil_id, empresa_id)
    AND public.mesmo_tenant('public.pessoas', pessoa_id, empresa_id));
CREATE POLICY "alc_delete" ON public.alcadas FOR DELETE TO authenticated
  USING (public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid()));

-- aprovacoes
CREATE POLICY "apr_select" ON public.aprovacoes FOR SELECT TO authenticated
  USING (public.tenant_match(empresa_id));
CREATE POLICY "apr_insert" ON public.aprovacoes FOR INSERT TO authenticated
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','create'))
    AND public.mesmo_tenant('public.alcadas', alcada_id, empresa_id)
    AND public.mesmo_tenant('public.perfis_permissao', perfil_id, empresa_id)
    AND public.mesmo_tenant('public.pessoas', pessoa_id, empresa_id));
CREATE POLICY "apr_update" ON public.aprovacoes FOR UPDATE TO authenticated
  USING (public.tenant_can_write(empresa_id)
    AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(),'financeiro','edit'))
    AND public.mesmo_tenant('public.alcadas', alcada_id, empresa_id)
    AND public.mesmo_tenant('public.perfis_permissao', perfil_id, empresa_id)
    AND public.mesmo_tenant('public.pessoas', pessoa_id, empresa_id))
  WITH CHECK (public.tenant_can_write(empresa_id)
    AND public.mesmo_tenant('public.alcadas', alcada_id, empresa_id)
    AND public.mesmo_tenant('public.perfis_permissao', perfil_id, empresa_id)
    AND public.mesmo_tenant('public.pessoas', pessoa_id, empresa_id));
CREATE POLICY "apr_delete" ON public.aprovacoes FOR DELETE TO authenticated
  USING (public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid()));

CREATE TRIGGER trg_mp_updated BEFORE UPDATE ON public.modelos_proposta FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_alc_updated BEFORE UPDATE ON public.alcadas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_apr_updated BEFORE UPDATE ON public.aprovacoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ FUNÇÕES DE APROVAÇÃO ============
CREATE OR REPLACE FUNCTION public.solicitar_aprovacao(
  _documento text, _registro_id uuid, _valor numeric, _descricao text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pgmq AS $$
DECLARE
  v_emp uuid := public.get_user_empresa_id();
  v_alc record;
  v_criadas int := 0;
  v_email text;
  v_nome text;
BEGIN
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Empresa não identificada'; END IF;
  IF NOT public.tenant_can_write(v_emp) THEN RAISE EXCEPTION 'Sem permissão de escrita'; END IF;
  IF _documento NOT IN ('orcamento','medicao','solicitacao','ordem_compra','pagamento') THEN
    RAISE EXCEPTION 'Tipo de documento inválido';
  END IF;

  FOR v_alc IN
    SELECT * FROM public.alcadas a
     WHERE a.empresa_id = v_emp AND a.ativo AND a.documento = _documento
       AND COALESCE(_valor,0) >= a.valor_de
       AND (a.valor_ate IS NULL OR COALESCE(_valor,0) <= a.valor_ate)
     ORDER BY a.ordem
  LOOP
    INSERT INTO public.aprovacoes
      (empresa_id, alcada_id, documento, registro_id, descricao, valor, ordem, perfil_id, pessoa_id)
    VALUES (v_emp, v_alc.id, _documento, _registro_id, _descricao, COALESCE(_valor,0),
            v_alc.ordem, v_alc.perfil_id, v_alc.pessoa_id);
    v_criadas := v_criadas + 1;

    SELECT p.email, p.nome INTO v_email, v_nome
      FROM public.pessoas p
     WHERE p.empresa_id = v_emp
       AND (p.id = v_alc.pessoa_id OR (v_alc.pessoa_id IS NULL AND p.perfil_id = v_alc.perfil_id))
       AND p.email IS NOT NULL AND p.status = 'ativo'
     LIMIT 1;

    IF v_email IS NOT NULL THEN
      PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
        'message_id', gen_random_uuid()::text,
        'to', v_email,
        'from', 'Gestão de Obra <noreply@gestaodeobra.online>',
        'sender_domain', 'notify.gestaodeobra.online',
        'subject', 'Documento aguardando sua aprovação',
        'html', '<p>Olá ' || COALESCE(v_nome,'') || ',</p><p>Um documento do tipo <strong>' || _documento ||
                '</strong> no valor de R$ ' || to_char(COALESCE(_valor,0), 'FM999G999G990D00') ||
                ' está aguardando a sua aprovação.</p><p>Acesse "Minhas aprovações" no sistema para aprovar ou reprovar.</p>',
        'purpose', 'transactional',
        'label', 'aprovacao_pendente',
        'queued_at', now()
      ));
    END IF;
  END LOOP;

  RETURN v_criadas;
END $$;
REVOKE EXECUTE ON FUNCTION public.solicitar_aprovacao(text, uuid, numeric, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.solicitar_aprovacao(text, uuid, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.decidir_aprovacao(
  _aprovacao_id uuid, _aprovado boolean, _justificativa text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp uuid := public.get_user_empresa_id();
  v_apr public.aprovacoes%ROWTYPE;
  v_pessoa public.pessoas%ROWTYPE;
  v_pode boolean := false;
BEGIN
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Empresa não identificada'; END IF;
  IF NOT public.tenant_can_write(v_emp) THEN RAISE EXCEPTION 'Sem permissão de escrita'; END IF;

  SELECT * INTO v_apr FROM public.aprovacoes WHERE id = _aprovacao_id AND empresa_id = v_emp;
  IF v_apr.id IS NULL THEN RAISE EXCEPTION 'Aprovação não encontrada'; END IF;
  IF v_apr.status <> 'pendente' THEN RAISE EXCEPTION 'Esta aprovação já foi decidida'; END IF;
  IF NOT _aprovado AND COALESCE(btrim(_justificativa),'') = '' THEN
    RAISE EXCEPTION 'Informe a justificativa da reprovação';
  END IF;

  SELECT * INTO v_pessoa FROM public.pessoas
   WHERE user_id = auth.uid() AND empresa_id = v_emp LIMIT 1;

  IF public.is_admin_or_super(auth.uid()) THEN
    v_pode := true;
  ELSIF v_apr.pessoa_id IS NOT NULL AND v_pessoa.id = v_apr.pessoa_id THEN
    v_pode := true;
  ELSIF v_apr.perfil_id IS NOT NULL AND v_pessoa.perfil_id = v_apr.perfil_id THEN
    v_pode := true;
  END IF;
  IF NOT v_pode THEN RAISE EXCEPTION 'Este documento não está na sua fila de aprovação'; END IF;

  UPDATE public.aprovacoes
     SET status = CASE WHEN _aprovado THEN 'aprovado' ELSE 'reprovado' END,
         decidido_por = auth.uid(), decidido_em = now(),
         justificativa = _justificativa, updated_at = now()
   WHERE id = _aprovacao_id AND empresa_id = v_emp;

  INSERT INTO public.audit_log (empresa_id, ator_user_id, acao, tabela, registro_id, dados_depois, justificativa)
  VALUES (v_emp, auth.uid(),
          CASE WHEN _aprovado THEN 'aprovacao_aprovada' ELSE 'aprovacao_reprovada' END,
          'aprovacoes', _aprovacao_id,
          jsonb_build_object('documento', v_apr.documento, 'registro_id', v_apr.registro_id, 'valor', v_apr.valor),
          _justificativa);
END $$;
REVOKE EXECUTE ON FUNCTION public.decidir_aprovacao(uuid, boolean, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.decidir_aprovacao(uuid, boolean, text) TO authenticated;