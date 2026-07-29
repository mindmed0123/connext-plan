-- =========================================================
-- 1) DOCUMENTOS DE FUNCIONÁRIOS (CLT / operacional e demais)
-- =========================================================
CREATE TABLE public.pessoa_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.get_user_empresa_id(),
  pessoa_id uuid NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'outro',
  nome text NOT NULL,
  numero text,
  descricao text,
  data_emissao date,
  data_validade date,
  arquivo_path text,
  arquivo_nome text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pessoa_documentos TO authenticated;
GRANT ALL ON public.pessoa_documentos TO service_role;

ALTER TABLE public.pessoa_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pessoa_documentos_select" ON public.pessoa_documentos
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (public.tenant_match(empresa_id)
        AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'equipes', 'view')))
  );

CREATE POLICY "pessoa_documentos_insert" ON public.pessoa_documentos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (public.tenant_match(empresa_id)
        AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'equipes', 'create')))
  );

CREATE POLICY "pessoa_documentos_update" ON public.pessoa_documentos
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (public.tenant_match(empresa_id)
        AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'equipes', 'edit')))
  );

CREATE POLICY "pessoa_documentos_delete" ON public.pessoa_documentos
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (public.tenant_match(empresa_id)
        AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'equipes', 'delete')))
  );

CREATE INDEX idx_pessoa_documentos_pessoa ON public.pessoa_documentos(pessoa_id);
CREATE INDEX idx_pessoa_documentos_empresa ON public.pessoa_documentos(empresa_id);

CREATE TRIGGER trg_pessoa_documentos_updated_at
  BEFORE UPDATE ON public.pessoa_documentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 2) COMPRADORES: campos robustos + contratos
-- =========================================================
ALTER TABLE public.compradores
  ADD COLUMN IF NOT EXISTS tipo_instituicao text NOT NULL DEFAULT 'outro',
  ADD COLUMN IF NOT EXISTS razao_social text,
  ADD COLUMN IF NOT EXISTS inscricao_estadual text,
  ADD COLUMN IF NOT EXISTS site text,
  ADD COLUMN IF NOT EXISTS responsavel_nome text,
  ADD COLUMN IF NOT EXISTS responsavel_email text,
  ADD COLUMN IF NOT EXISTS responsavel_telefone text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS condicoes_comerciais text;

CREATE TABLE public.comprador_contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.get_user_empresa_id(),
  comprador_id uuid NOT NULL REFERENCES public.compradores(id) ON DELETE CASCADE,
  numero_contrato text,
  objeto text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  data_inicio date,
  data_fim date,
  status text NOT NULL DEFAULT 'ativo',
  observacoes text,
  arquivo_path text,
  arquivo_nome text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comprador_contratos TO authenticated;
GRANT ALL ON public.comprador_contratos TO service_role;

ALTER TABLE public.comprador_contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comprador_contratos_select" ON public.comprador_contratos
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (public.tenant_match(empresa_id)
        AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'compradores', 'view')))
  );

CREATE POLICY "comprador_contratos_insert" ON public.comprador_contratos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (public.tenant_match(empresa_id)
        AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'compradores', 'create')))
  );

CREATE POLICY "comprador_contratos_update" ON public.comprador_contratos
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (public.tenant_match(empresa_id)
        AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'compradores', 'edit')))
  );

CREATE POLICY "comprador_contratos_delete" ON public.comprador_contratos
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (public.tenant_match(empresa_id)
        AND (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'compradores', 'delete')))
  );

CREATE INDEX idx_comprador_contratos_comprador ON public.comprador_contratos(comprador_id);
CREATE INDEX idx_comprador_contratos_empresa ON public.comprador_contratos(empresa_id);

CREATE TRIGGER trg_comprador_contratos_updated_at
  BEFORE UPDATE ON public.comprador_contratos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 3) OBRAS: contrato por unidade + adendos
-- =========================================================
ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS contrato_unidade text,
  ADD COLUMN IF NOT EXISTS contrato_valor_unitario numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contrato_qtd_prevista numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contrato_qtd_contratada numeric NOT NULL DEFAULT 0;

CREATE TABLE public.obra_adendos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.get_user_empresa_id(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  numero integer NOT NULL DEFAULT 1,
  titulo text NOT NULL,
  descricao text,
  quantidade numeric NOT NULL DEFAULT 1,
  valor_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  data_assinatura date,
  data_inicio date,
  status text NOT NULL DEFAULT 'previsto',
  observacoes text,
  arquivo_path text,
  arquivo_nome text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_adendos TO authenticated;
GRANT ALL ON public.obra_adendos TO service_role;

ALTER TABLE public.obra_adendos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "obra_adendos_select" ON public.obra_adendos
  FOR SELECT TO authenticated
  USING (public.can_access_obra(auth.uid(), obra_id));

CREATE POLICY "obra_adendos_insert" ON public.obra_adendos
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_obra(auth.uid(), obra_id) AND public.tenant_match(empresa_id));

CREATE POLICY "obra_adendos_update" ON public.obra_adendos
  FOR UPDATE TO authenticated
  USING (public.can_access_obra(auth.uid(), obra_id));

CREATE POLICY "obra_adendos_delete" ON public.obra_adendos
  FOR DELETE TO authenticated
  USING (public.can_access_obra(auth.uid(), obra_id));

CREATE INDEX idx_obra_adendos_obra ON public.obra_adendos(obra_id);
CREATE INDEX idx_obra_adendos_empresa ON public.obra_adendos(empresa_id);

CREATE TRIGGER trg_obra_adendos_updated_at
  BEFORE UPDATE ON public.obra_adendos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Recalcula a quantidade contratada da obra a partir dos adendos aprovados/executados
CREATE OR REPLACE FUNCTION public.recalc_obra_contrato()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_obra uuid := COALESCE(NEW.obra_id, OLD.obra_id);
BEGIN
  UPDATE public.obras o
     SET contrato_qtd_contratada = COALESCE((
           SELECT SUM(a.quantidade) FROM public.obra_adendos a
            WHERE a.obra_id = v_obra AND a.status IN ('assinado','em_execucao','concluido')
         ), 0),
         updated_at = now()
   WHERE o.id = v_obra;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_recalc_obra_contrato
  AFTER INSERT OR UPDATE OR DELETE ON public.obra_adendos
  FOR EACH ROW EXECUTE FUNCTION public.recalc_obra_contrato();