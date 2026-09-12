
CREATE TABLE IF NOT EXISTS public.notificacao_preferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.get_user_empresa_id() REFERENCES public.empresas(id),
  user_id uuid NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  frequencia text NOT NULL DEFAULT 'diario' CHECK (frequencia IN ('diario','semanal')),
  contas_a_vencer boolean NOT NULL DEFAULT true,
  recebimento_vencido boolean NOT NULL DEFAULT true,
  medicao_aprovada boolean NOT NULL DEFAULT true,
  nf_emitida boolean NOT NULL DEFAULT true,
  orcamento_decidido boolean NOT NULL DEFAULT true,
  rdo_reprovado boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_pref_emp_user ON public.notificacao_preferencias(empresa_id, user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacao_preferencias TO authenticated;
GRANT ALL ON public.notificacao_preferencias TO service_role;
ALTER TABLE public.notificacao_preferencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notif_pref_select ON public.notificacao_preferencias;
CREATE POLICY notif_pref_select ON public.notificacao_preferencias FOR SELECT TO authenticated
USING (public.tenant_match(empresa_id) AND (user_id = auth.uid() OR public.is_admin_or_super(auth.uid())));

DROP POLICY IF EXISTS notif_pref_insert ON public.notificacao_preferencias;
CREATE POLICY notif_pref_insert ON public.notificacao_preferencias FOR INSERT TO authenticated
WITH CHECK (
  public.tenant_can_write(empresa_id)
  AND (user_id = auth.uid() OR public.is_admin_or_super(auth.uid()))
  AND EXISTS (SELECT 1 FROM public.pessoas p WHERE p.user_id = notificacao_preferencias.user_id AND p.empresa_id = notificacao_preferencias.empresa_id)
);

DROP POLICY IF EXISTS notif_pref_update ON public.notificacao_preferencias;
CREATE POLICY notif_pref_update ON public.notificacao_preferencias FOR UPDATE TO authenticated
USING (
  public.tenant_can_write(empresa_id)
  AND (user_id = auth.uid() OR public.is_admin_or_super(auth.uid()))
  AND EXISTS (SELECT 1 FROM public.pessoas p WHERE p.user_id = notificacao_preferencias.user_id AND p.empresa_id = notificacao_preferencias.empresa_id)
)
WITH CHECK (
  public.tenant_can_write(empresa_id)
  AND EXISTS (SELECT 1 FROM public.pessoas p WHERE p.user_id = notificacao_preferencias.user_id AND p.empresa_id = notificacao_preferencias.empresa_id)
);

DROP POLICY IF EXISTS notif_pref_delete ON public.notificacao_preferencias;
CREATE POLICY notif_pref_delete ON public.notificacao_preferencias FOR DELETE TO authenticated
USING (public.tenant_can_write(empresa_id) AND (user_id = auth.uid() OR public.is_admin_or_super(auth.uid())));

DROP TRIGGER IF EXISTS trg_notif_pref_updated ON public.notificacao_preferencias;
CREATE TRIGGER trg_notif_pref_updated BEFORE UPDATE ON public.notificacao_preferencias
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.notificacao_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.get_user_empresa_id() REFERENCES public.empresas(id),
  user_id uuid NOT NULL,
  destinatario text NOT NULL,
  evento text NOT NULL,
  chave text NOT NULL,
  referencia_data date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  canal text NOT NULL DEFAULT 'email',
  enviado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_envio_dedupe
  ON public.notificacao_envios(empresa_id, user_id, evento, chave, referencia_data);
GRANT SELECT ON public.notificacao_envios TO authenticated;
GRANT ALL ON public.notificacao_envios TO service_role;
ALTER TABLE public.notificacao_envios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notif_envio_select ON public.notificacao_envios;
CREATE POLICY notif_envio_select ON public.notificacao_envios FOR SELECT TO authenticated
USING (public.tenant_match(empresa_id) AND (user_id = auth.uid() OR public.is_admin_or_super(auth.uid())));
DROP POLICY IF EXISTS notif_envio_insert ON public.notificacao_envios;
CREATE POLICY notif_envio_insert ON public.notificacao_envios FOR INSERT TO authenticated
WITH CHECK (public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid()));
DROP POLICY IF EXISTS notif_envio_update ON public.notificacao_envios;
CREATE POLICY notif_envio_update ON public.notificacao_envios FOR UPDATE TO authenticated
USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS notif_envio_delete ON public.notificacao_envios;
CREATE POLICY notif_envio_delete ON public.notificacao_envios FOR DELETE TO authenticated
USING (public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid()));

CREATE TABLE IF NOT EXISTS public.notificacao_canais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.get_user_empresa_id() REFERENCES public.empresas(id),
  canal text NOT NULL CHECK (canal IN ('email','whatsapp')),
  provedor text,
  ativo boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_canal_emp ON public.notificacao_canais(empresa_id, canal);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacao_canais TO authenticated;
GRANT ALL ON public.notificacao_canais TO service_role;
ALTER TABLE public.notificacao_canais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notif_canal_select ON public.notificacao_canais;
CREATE POLICY notif_canal_select ON public.notificacao_canais FOR SELECT TO authenticated
USING (public.tenant_match(empresa_id));
DROP POLICY IF EXISTS notif_canal_insert ON public.notificacao_canais;
CREATE POLICY notif_canal_insert ON public.notificacao_canais FOR INSERT TO authenticated
WITH CHECK (public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid()));
DROP POLICY IF EXISTS notif_canal_update ON public.notificacao_canais;
CREATE POLICY notif_canal_update ON public.notificacao_canais FOR UPDATE TO authenticated
USING (public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid()))
WITH CHECK (public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid()));
DROP POLICY IF EXISTS notif_canal_delete ON public.notificacao_canais;
CREATE POLICY notif_canal_delete ON public.notificacao_canais FOR DELETE TO authenticated
USING (public.tenant_can_write(empresa_id) AND public.is_admin_or_super(auth.uid()));

DROP TRIGGER IF EXISTS trg_notif_canal_updated ON public.notificacao_canais;
CREATE TRIGGER trg_notif_canal_updated BEFORE UPDATE ON public.notificacao_canais
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
