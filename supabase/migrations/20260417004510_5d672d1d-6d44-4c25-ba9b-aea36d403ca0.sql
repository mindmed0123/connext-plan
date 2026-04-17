
-- =========================
-- ENUMS
-- =========================
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor', 'engenheiro', 'financeiro', 'operacional');

CREATE TYPE public.obra_origem AS ENUM ('veman', 'sabesp');
CREATE TYPE public.obra_regiao AS ENUM ('leste', 'oeste', 'norte', 'sul');
CREATE TYPE public.obra_status AS ENUM (
  'recebido','em_vistoria','aguardando_orcamento','em_aprovacao','aprovado',
  'em_execucao','finalizado','aguardando_rc','aguardando_pedido_compra',
  'aguardando_nf','aguardando_pagamento','pago'
);

CREATE TYPE public.vistoria_status AS ENUM ('pendente','vistoriado');
CREATE TYPE public.orcamento_status AS ENUM ('em_elaboracao','enviado','em_negociacao','aprovado','reprovado');
CREATE TYPE public.execucao_tipo AS ENUM ('equipe_propria','terceirizado');
CREATE TYPE public.execucao_status AS ENUM ('nao_iniciada','em_execucao','pausada','finalizada');
CREATE TYPE public.foto_tipo AS ENUM ('antes','durante','depois');
CREATE TYPE public.diario_status AS ENUM ('enviado','aprovado','reprovado');
CREATE TYPE public.rc_status AS ENUM ('aguardando','recebido');
CREATE TYPE public.pc_status AS ENUM ('aguardando','recebido');
CREATE TYPE public.recebimento_status AS ENUM ('a_receber','recebido');

-- =========================
-- UTIL: updated_at trigger
-- =========================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================
-- PROFILES
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- USER ROLES (separate table for security)
-- =========================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Auto create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email));

  -- First user becomes admin, others operacional by default
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operacional');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- OBRAS (main entity)
-- =========================
CREATE TABLE public.obras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_chamado TEXT NOT NULL UNIQUE,
  origem public.obra_origem NOT NULL DEFAULT 'sabesp',
  regiao public.obra_regiao NOT NULL,
  engenheiro_responsavel TEXT NOT NULL,
  descricao_servico TEXT NOT NULL,
  endereco TEXT NOT NULL,
  data_recebimento DATE NOT NULL DEFAULT CURRENT_DATE,
  status public.obra_status NOT NULL DEFAULT 'recebido',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_obras_status ON public.obras(status);
CREATE INDEX idx_obras_regiao ON public.obras(regiao);
CREATE INDEX idx_obras_codigo ON public.obras(codigo_chamado);
CREATE TRIGGER trg_obras_updated BEFORE UPDATE ON public.obras
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- VISTORIAS
-- =========================
CREATE TABLE public.vistorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  data_vistoria DATE NOT NULL,
  responsavel_vistoria TEXT NOT NULL,
  observacoes TEXT,
  status public.vistoria_status NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vistorias ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_vistorias_obra ON public.vistorias(obra_id);
CREATE TRIGGER trg_vistorias_updated BEFORE UPDATE ON public.vistorias
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- ORCAMENTOS
-- =========================
CREATE TABLE public.orcamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  numero_orcamento TEXT,
  valor_orcamento NUMERIC(14,2) NOT NULL DEFAULT 0,
  data_envio DATE,
  engenheiro_aprovador TEXT,
  status public.orcamento_status NOT NULL DEFAULT 'em_elaboracao',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_orcamentos_obra ON public.orcamentos(obra_id);
CREATE TRIGGER trg_orcamentos_updated BEFORE UPDATE ON public.orcamentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- EXECUCOES
-- =========================
CREATE TABLE public.execucoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  tipo_execucao public.execucao_tipo NOT NULL DEFAULT 'equipe_propria',
  nome_terceirizado TEXT,
  responsavel_obra TEXT NOT NULL,
  data_inicio DATE,
  prazo_estimado INTEGER, -- dias
  status public.execucao_status NOT NULL DEFAULT 'nao_iniciada',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.execucoes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_execucoes_obra ON public.execucoes(obra_id);
CREATE TRIGGER trg_execucoes_updated BEFORE UPDATE ON public.execucoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- FOTOS DA OBRA
-- =========================
CREATE TABLE public.fotos_obra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  tipo public.foto_tipo NOT NULL,
  imagem_url TEXT NOT NULL,
  storage_path TEXT,
  observacao TEXT,
  data_upload TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fotos_obra ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_fotos_obra ON public.fotos_obra(obra_id);

-- =========================
-- DIARIO DE OBRA
-- =========================
CREATE TABLE public.diario_obra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  data_envio DATE NOT NULL DEFAULT CURRENT_DATE,
  observacoes TEXT NOT NULL,
  status public.diario_status NOT NULL DEFAULT 'enviado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.diario_obra ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_diario_obra ON public.diario_obra(obra_id);
CREATE TRIGGER trg_diario_updated BEFORE UPDATE ON public.diario_obra
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- RC
-- =========================
CREATE TABLE public.rcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  numero_rc TEXT,
  data_rc DATE,
  status public.rc_status NOT NULL DEFAULT 'aguardando',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rcs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_rcs_obra ON public.rcs(obra_id);
CREATE TRIGGER trg_rcs_updated BEFORE UPDATE ON public.rcs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- PEDIDOS DE COMPRA
-- =========================
CREATE TABLE public.pedidos_compra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  numero_pedido TEXT,
  data_recebimento DATE,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  status public.pc_status NOT NULL DEFAULT 'aguardando',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pedidos_compra ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_pc_obra ON public.pedidos_compra(obra_id);
CREATE TRIGGER trg_pc_updated BEFORE UPDATE ON public.pedidos_compra
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- NOTAS FISCAIS
-- =========================
CREATE TABLE public.notas_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  numero_nf TEXT NOT NULL,
  data_emissao DATE NOT NULL,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  arquivo_pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_nf_obra ON public.notas_fiscais(obra_id);
CREATE TRIGGER trg_nf_updated BEFORE UPDATE ON public.notas_fiscais
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- RECEBIMENTOS
-- =========================
CREATE TABLE public.recebimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  data_prevista DATE,
  data_recebido DATE,
  status public.recebimento_status NOT NULL DEFAULT 'a_receber',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recebimentos ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_receb_obra ON public.recebimentos(obra_id);
CREATE TRIGGER trg_receb_updated BEFORE UPDATE ON public.recebimentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- TIMELINE / HISTORICO DA OBRA
-- =========================
CREATE TABLE public.obra_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  evento TEXT NOT NULL,
  detalhes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.obra_timeline ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_timeline_obra ON public.obra_timeline(obra_id);

-- =========================
-- RLS POLICIES (any authenticated user can read/write; only admin can delete)
-- =========================

-- profiles
CREATE POLICY "Profiles visíveis para autenticados" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuário atualiza seu profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Usuário insere seu profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- user_roles
CREATE POLICY "Roles visíveis para autenticados" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin gerencia roles - insert" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin gerencia roles - update" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin gerencia roles - delete" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Generic policies for operational tables
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'obras','vistorias','orcamentos','execucoes','fotos_obra','diario_obra',
    'rcs','pedidos_compra','notas_fiscais','recebimentos','obra_timeline'
  ])
  LOOP
    EXECUTE format('CREATE POLICY "%s_select_auth" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "%s_insert_auth" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "%s_update_auth" ON public.%I FOR UPDATE TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "%s_delete_admin" ON public.%I FOR DELETE TO authenticated USING (public.has_role(auth.uid(), ''admin''))', t, t);
  END LOOP;
END $$;

-- =========================
-- STORAGE
-- =========================
INSERT INTO storage.buckets (id, name, public) VALUES ('obras-fotos', 'obras-fotos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Fotos públicas para leitura" ON storage.objects
  FOR SELECT USING (bucket_id = 'obras-fotos');
CREATE POLICY "Autenticados podem upload de fotos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'obras-fotos');
CREATE POLICY "Autenticados podem atualizar fotos" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'obras-fotos');
CREATE POLICY "Admin pode deletar fotos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'obras-fotos' AND public.has_role(auth.uid(),'admin'));
