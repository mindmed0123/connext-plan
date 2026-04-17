-- =========================================================
-- FASE 1: Equipes, Permissões e Vínculos (parte 2)
-- =========================================================

-- Enums auxiliares
DO $$ BEGIN
  CREATE TYPE public.pessoa_tipo AS ENUM ('terceirizado','administrativo','operacional');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pessoa_status AS ENUM ('ativo','inativo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.obra_papel AS ENUM ('responsavel_administrativo','executor_operacional','terceirizado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) Tabela pessoas
CREATE TABLE IF NOT EXISTS public.pessoas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  tipo public.pessoa_tipo NOT NULL,
  nome text NOT NULL,
  cpf_cnpj text NULL,
  telefone text NULL,
  email text NULL,
  endereco text NULL,
  cargo text NULL,
  tipo_servico text NULL,
  data_admissao date NULL,
  chave_pix text NULL,
  banco text NULL,
  agencia text NULL,
  conta text NULL,
  observacoes text NULL,
  status public.pessoa_status NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL
);
CREATE INDEX IF NOT EXISTS idx_pessoas_tipo ON public.pessoas(tipo);
CREATE INDEX IF NOT EXISTS idx_pessoas_status ON public.pessoas(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pessoas_user_id ON public.pessoas(user_id) WHERE user_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_pessoas_updated_at ON public.pessoas;
CREATE TRIGGER trg_pessoas_updated_at BEFORE UPDATE ON public.pessoas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.pessoas ENABLE ROW LEVEL SECURITY;

-- 2) Vínculo
CREATE TABLE IF NOT EXISTS public.obra_responsaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  pessoa_id uuid NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
  papel public.obra_papel NOT NULL,
  observacao text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  UNIQUE (obra_id, pessoa_id, papel)
);
CREATE INDEX IF NOT EXISTS idx_obra_resp_obra ON public.obra_responsaveis(obra_id);
CREATE INDEX IF NOT EXISTS idx_obra_resp_pessoa ON public.obra_responsaveis(pessoa_id);
ALTER TABLE public.obra_responsaveis ENABLE ROW LEVEL SECURITY;

-- 3) Helpers
CREATE OR REPLACE FUNCTION public.is_admin_or_super(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role IN ('super_admin','admin','gestor')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.can_access_obra(_uid uuid, _obra_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_admin_or_super(_uid)
    OR EXISTS (
      SELECT 1 FROM public.obra_responsaveis r
      JOIN public.pessoas p ON p.id = r.pessoa_id
      WHERE r.obra_id = _obra_id AND p.user_id = _uid AND p.status = 'ativo'
    );
$$;

-- 4) RLS pessoas
DROP POLICY IF EXISTS pessoas_select ON public.pessoas;
DROP POLICY IF EXISTS pessoas_insert ON public.pessoas;
DROP POLICY IF EXISTS pessoas_update ON public.pessoas;
DROP POLICY IF EXISTS pessoas_delete ON public.pessoas;
CREATE POLICY pessoas_select ON public.pessoas FOR SELECT TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR user_id = auth.uid());
CREATE POLICY pessoas_insert ON public.pessoas FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY pessoas_update ON public.pessoas FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY pessoas_delete ON public.pessoas FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 5) RLS obra_responsaveis
DROP POLICY IF EXISTS obra_resp_select ON public.obra_responsaveis;
DROP POLICY IF EXISTS obra_resp_insert ON public.obra_responsaveis;
DROP POLICY IF EXISTS obra_resp_update ON public.obra_responsaveis;
DROP POLICY IF EXISTS obra_resp_delete ON public.obra_responsaveis;
CREATE POLICY obra_resp_select ON public.obra_responsaveis FOR SELECT TO authenticated
  USING (public.can_access_obra(auth.uid(), obra_id));
CREATE POLICY obra_resp_insert ON public.obra_responsaveis FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY obra_resp_update ON public.obra_responsaveis FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY obra_resp_delete ON public.obra_responsaveis FOR DELETE TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

-- 6) Reescreve RLS de obras
DROP POLICY IF EXISTS obras_select_auth ON public.obras;
DROP POLICY IF EXISTS obras_insert_auth ON public.obras;
DROP POLICY IF EXISTS obras_update_auth ON public.obras;
DROP POLICY IF EXISTS obras_delete_admin ON public.obras;
CREATE POLICY obras_select ON public.obras FOR SELECT TO authenticated
  USING (public.can_access_obra(auth.uid(), id));
CREATE POLICY obras_insert ON public.obras FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY obras_update ON public.obras FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY obras_delete ON public.obras FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 7) fotos_obra: operacional/terceirizado podem ver e enviar foto nas obras vinculadas
DROP POLICY IF EXISTS fotos_obra_select_auth ON public.fotos_obra;
DROP POLICY IF EXISTS fotos_obra_insert_auth ON public.fotos_obra;
DROP POLICY IF EXISTS fotos_obra_update_auth ON public.fotos_obra;
DROP POLICY IF EXISTS fotos_obra_delete_admin ON public.fotos_obra;
CREATE POLICY fotos_select ON public.fotos_obra FOR SELECT TO authenticated
  USING (public.can_access_obra(auth.uid(), obra_id));
CREATE POLICY fotos_insert ON public.fotos_obra FOR INSERT TO authenticated
  WITH CHECK (public.can_access_obra(auth.uid(), obra_id));
CREATE POLICY fotos_update ON public.fotos_obra FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY fotos_delete ON public.fotos_obra FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 8) Demais tabelas operacionais/financeiras: somente admin/super
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['vistorias','orcamentos','execucoes','diario_obra','rcs','pedidos_compra','notas_fiscais','recebimentos'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select_auth ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert_auth ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_update_auth ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete_admin ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_sel ON public.%I FOR SELECT TO authenticated USING (public.is_admin_or_super(auth.uid()))', t, t);
    EXECUTE format('CREATE POLICY %I_ins ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()))', t, t);
    EXECUTE format('CREATE POLICY %I_upd ON public.%I FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid()))', t, t);
    EXECUTE format('CREATE POLICY %I_del ON public.%I FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()))', t, t);
  END LOOP;
END $$;

-- 9) obra_timeline: operacional/terceirizado leem timeline da própria obra; só admin/super escreve
DROP POLICY IF EXISTS obra_timeline_select_auth ON public.obra_timeline;
DROP POLICY IF EXISTS obra_timeline_insert_auth ON public.obra_timeline;
DROP POLICY IF EXISTS obra_timeline_update_auth ON public.obra_timeline;
DROP POLICY IF EXISTS obra_timeline_delete_admin ON public.obra_timeline;
CREATE POLICY obra_timeline_sel ON public.obra_timeline FOR SELECT TO authenticated
  USING (public.can_access_obra(auth.uid(), obra_id));
CREATE POLICY obra_timeline_ins ON public.obra_timeline FOR INSERT TO authenticated
  WITH CHECK (public.can_access_obra(auth.uid(), obra_id));
CREATE POLICY obra_timeline_upd ON public.obra_timeline FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY obra_timeline_del ON public.obra_timeline FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 10) Execucoes: terceirizado_id
ALTER TABLE public.execucoes
  ADD COLUMN IF NOT EXISTS terceirizado_id uuid NULL REFERENCES public.pessoas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_execucoes_terceirizado ON public.execucoes(terceirizado_id);

-- 11) fotos_obra: registrar quem enviou
ALTER TABLE public.fotos_obra
  ADD COLUMN IF NOT EXISTS uploaded_by uuid NULL;

-- 12) handle_new_user: super_admin para Pedro; vincula pessoa existente pelo email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email));

  IF lower(NEW.email) = 'pedro@potenciasolucoes.com.br' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin') ON CONFLICT DO NOTHING;
  ELSIF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operacional');
  END IF;

  UPDATE public.pessoas SET user_id = NEW.id, updated_at = now()
  WHERE lower(email) = lower(NEW.email) AND user_id IS NULL;

  RETURN NEW;
END;
$$;

-- Garante trigger em auth.users
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- 13) Promove Pedro retroativamente
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'super_admin'::app_role FROM auth.users u
WHERE lower(u.email) = 'pedro@potenciasolucoes.com.br'
ON CONFLICT DO NOTHING;