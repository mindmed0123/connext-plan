-- Enum dos módulos do sistema
CREATE TYPE public.app_modulo AS ENUM (
  'dashboard',
  'obras',
  'financeiro',
  'faturamento',
  'equipes',
  'vistorias',
  'orcamentos',
  'execucoes',
  'etapas'
);

-- Enum das ações
CREATE TYPE public.app_acao AS ENUM ('view', 'create', 'edit', 'delete');

-- Tabela de permissões por pessoa
CREATE TABLE public.pessoa_permissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id uuid NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
  modulo public.app_modulo NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pessoa_id, modulo)
);

CREATE INDEX idx_pessoa_permissoes_pessoa ON public.pessoa_permissoes(pessoa_id);

ALTER TABLE public.pessoa_permissoes ENABLE ROW LEVEL SECURITY;

-- Apenas super_admin gerencia
CREATE POLICY "perm_select" ON public.pessoa_permissoes
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.pessoas p WHERE p.id = pessoa_id AND p.user_id = auth.uid())
  );

CREATE POLICY "perm_insert" ON public.pessoa_permissoes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "perm_update" ON public.pessoa_permissoes
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "perm_delete" ON public.pessoa_permissoes
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER trg_pessoa_permissoes_updated
  BEFORE UPDATE ON public.pessoa_permissoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função para checar permissão (super_admin sempre tem tudo)
CREATE OR REPLACE FUNCTION public.has_permission(_uid uuid, _modulo public.app_modulo, _acao public.app_acao)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin(_uid)
    OR EXISTS (
      SELECT 1
      FROM public.pessoa_permissoes pp
      JOIN public.pessoas p ON p.id = pp.pessoa_id
      WHERE p.user_id = _uid
        AND pp.modulo = _modulo
        AND CASE _acao
          WHEN 'view'   THEN pp.can_view
          WHEN 'create' THEN pp.can_create
          WHEN 'edit'   THEN pp.can_edit
          WHEN 'delete' THEN pp.can_delete
        END
    );
$$;