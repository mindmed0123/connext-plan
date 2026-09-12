ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

DROP INDEX IF EXISTS public.uq_obra_portal_tokens_emp_token;
CREATE UNIQUE INDEX IF NOT EXISTS uq_obra_portal_tokens_token ON public.obra_portal_tokens(token);

CREATE TABLE IF NOT EXISTS public.rotina_execucoes (
  rotina text PRIMARY KEY,
  ultima_execucao timestamptz NOT NULL DEFAULT now(),
  ultimo_status text,
  detalhe text,
  execucoes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.rotina_execucoes TO authenticated;
GRANT ALL ON public.rotina_execucoes TO service_role;
ALTER TABLE public.rotina_execucoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rotina_execucoes_select ON public.rotina_execucoes;
CREATE POLICY rotina_execucoes_select ON public.rotina_execucoes FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS rotina_execucoes_insert ON public.rotina_execucoes;
CREATE POLICY rotina_execucoes_insert ON public.rotina_execucoes FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS rotina_execucoes_update ON public.rotina_execucoes;
CREATE POLICY rotina_execucoes_update ON public.rotina_execucoes FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS rotina_execucoes_delete ON public.rotina_execucoes;
CREATE POLICY rotina_execucoes_delete ON public.rotina_execucoes FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_rotina_execucoes_updated ON public.rotina_execucoes;
CREATE TRIGGER trg_rotina_execucoes_updated BEFORE UPDATE ON public.rotina_execucoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.disparar_rotina(_rotina text, _url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _key text;
  _req bigint;
BEGIN
  SELECT decrypted_secret INTO _key
  FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key';

  IF _key IS NULL THEN
    INSERT INTO public.rotina_execucoes (rotina, ultima_execucao, ultimo_status, detalhe, execucoes)
    VALUES (_rotina, now(), 'erro', 'service role key indisponivel', 1)
    ON CONFLICT (rotina) DO UPDATE
      SET ultima_execucao = now(), ultimo_status = 'erro',
          detalhe = 'service role key indisponivel',
          execucoes = public.rotina_execucoes.execucoes + 1;
    RETURN;
  END IF;

  SELECT net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _key
    ),
    body := '{}'::jsonb
  ) INTO _req;

  INSERT INTO public.rotina_execucoes (rotina, ultima_execucao, ultimo_status, detalhe, execucoes)
  VALUES (_rotina, now(), 'disparada', 'request ' || _req::text, 1)
  ON CONFLICT (rotina) DO UPDATE
    SET ultima_execucao = now(), ultimo_status = 'disparada',
        detalhe = 'request ' || _req::text,
        execucoes = public.rotina_execucoes.execucoes + 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.disparar_rotina(text, text) FROM anon, authenticated, public;