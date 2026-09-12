CREATE OR REPLACE FUNCTION public.decidir_aprovacao(
  _aprovacao_id uuid, _aprovado boolean, _justificativa text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp uuid := public.get_user_empresa_id();
  v_apr public.aprovacoes%ROWTYPE;
  v_pessoa public.pessoas%ROWTYPE;
  v_pode boolean := false;
  v_restantes int;
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

  SELECT count(*) INTO v_restantes FROM public.aprovacoes
   WHERE empresa_id = v_emp AND documento = v_apr.documento
     AND registro_id = v_apr.registro_id AND status = 'pendente';

  IF NOT _aprovado THEN
    IF v_apr.documento = 'ordem_compra' THEN
      UPDATE public.ordens_compra SET status = 'cancelada'
       WHERE id = v_apr.registro_id AND empresa_id = v_emp;
    ELSIF v_apr.documento = 'solicitacao' THEN
      UPDATE public.solicitacoes_compra SET status = 'reprovada'
       WHERE id = v_apr.registro_id AND empresa_id = v_emp;
    END IF;
  ELSIF v_restantes = 0 THEN
    IF v_apr.documento = 'ordem_compra' THEN
      UPDATE public.ordens_compra SET status = 'emitida'
       WHERE id = v_apr.registro_id AND empresa_id = v_emp AND status = 'aguardando_aprovacao';
    ELSIF v_apr.documento = 'solicitacao' THEN
      UPDATE public.solicitacoes_compra SET status = 'aberta'
       WHERE id = v_apr.registro_id AND empresa_id = v_emp AND status = 'aguardando_aprovacao';
    END IF;
  END IF;

  INSERT INTO public.audit_log (empresa_id, ator_user_id, acao, tabela, registro_id, dados_depois, justificativa)
  VALUES (v_emp, auth.uid(),
          CASE WHEN _aprovado THEN 'aprovacao_aprovada' ELSE 'aprovacao_reprovada' END,
          'aprovacoes', _aprovacao_id,
          jsonb_build_object('documento', v_apr.documento, 'registro_id', v_apr.registro_id, 'valor', v_apr.valor),
          _justificativa);
END $$;
REVOKE EXECUTE ON FUNCTION public.decidir_aprovacao(uuid, boolean, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.decidir_aprovacao(uuid, boolean, text) TO authenticated;

-- Recebimento de OC só depois de aprovada
CREATE OR REPLACE FUNCTION public.fn_oc_bloqueia_recebimento_sem_aprovacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM public.ordens_compra
   WHERE id = NEW.ordem_compra_id AND empresa_id = NEW.empresa_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Ordem de compra não pertence a esta empresa';
  END IF;
  IF v_status = 'aguardando_aprovacao' THEN
    RAISE EXCEPTION 'Esta ordem de compra ainda aguarda aprovação';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.fn_oc_bloqueia_recebimento_sem_aprovacao() FROM anon, public;

DROP TRIGGER IF EXISTS trg_oc_bloqueia_recebimento ON public.ordem_compra_recebimentos;
CREATE TRIGGER trg_oc_bloqueia_recebimento
BEFORE INSERT ON public.ordem_compra_recebimentos
FOR EACH ROW EXECUTE FUNCTION public.fn_oc_bloqueia_recebimento_sem_aprovacao();