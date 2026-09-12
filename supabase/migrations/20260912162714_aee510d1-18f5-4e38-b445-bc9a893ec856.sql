-- 1) Limite de obras: também ao desarquivar -----------------------------------
CREATE OR REPLACE FUNCTION public.fn_limite_obras()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lim int; v_plano text; v_uso int;
BEGIN
  IF NEW.empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa não identificada.';
  END IF;

  -- Em UPDATE só interessa a transição arquivada = true -> false.
  IF TG_OP = 'UPDATE' THEN
    IF COALESCE(NEW.arquivada,false) = true
       OR COALESCE(OLD.arquivada,false) = false THEN
      RETURN NEW;
    END IF;
    IF NEW.empresa_id <> OLD.empresa_id THEN
      RAISE EXCEPTION 'Não é permitido mover a obra para outra empresa.';
    END IF;
  END IF;

  SELECT l.limite_obras, l.plano_nome INTO v_lim, v_plano
    FROM public.limites_plano(NEW.empresa_id) l;
  IF v_lim IS NULL OR v_lim <= 0 THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_uso FROM public.obras o
   WHERE o.empresa_id = NEW.empresa_id
     AND COALESCE(o.arquivada,false) = false
     AND o.id <> NEW.id;

  IF v_uso >= v_lim THEN
    RAISE EXCEPTION 'LIMITE_PLANO_OBRAS: O plano % permite % obra(s) ativa(s) e a empresa já tem %.',
      COALESCE(v_plano,'atual'), v_lim, v_uso
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_limite_obras ON public.obras;
CREATE TRIGGER trg_limite_obras
BEFORE INSERT OR UPDATE OF arquivada ON public.obras
FOR EACH ROW EXECUTE FUNCTION public.fn_limite_obras();

-- 2) Alerta do administrador do sistema: pedidos de exclusão pendentes --------
CREATE OR REPLACE FUNCTION public.admin_exclusoes_pendentes()
RETURNS TABLE (
  id uuid, empresa_id uuid, empresa_nome text,
  solicitado_por_email text, motivo text,
  prazo_em timestamptz, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN QUERY
  SELECT s.id, s.empresa_id, e.nome, s.solicitado_por_email, s.motivo, s.prazo_em, s.created_at
  FROM public.exclusao_solicitacoes s
  JOIN public.empresas e ON e.id = s.empresa_id
  WHERE s.status = 'pendente'
  ORDER BY s.prazo_em;
END; $$;

REVOKE EXECUTE ON FUNCTION public.admin_exclusoes_pendentes() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_exclusoes_pendentes() TO authenticated;