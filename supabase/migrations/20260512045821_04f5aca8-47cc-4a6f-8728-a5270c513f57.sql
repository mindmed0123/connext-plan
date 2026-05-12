-- Tabela de clientes por empresa, para reutilização de CNPJs já buscados
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL DEFAULT get_user_empresa_id(),
  cnpj TEXT NOT NULL,
  nome TEXT NOT NULL,
  inscricao_estadual TEXT,
  endereco TEXT,
  email TEXT,
  telefone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, cnpj)
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY clientes_sel ON public.clientes FOR SELECT TO authenticated
  USING (tenant_match(empresa_id));
CREATE POLICY clientes_ins ON public.clientes FOR INSERT TO authenticated
  WITH CHECK (tenant_match(empresa_id));
CREATE POLICY clientes_upd ON public.clientes FOR UPDATE TO authenticated
  USING (tenant_match(empresa_id));
CREATE POLICY clientes_del ON public.clientes FOR DELETE TO authenticated
  USING (tenant_match(empresa_id) AND is_admin_or_super(auth.uid()));

CREATE TRIGGER trg_clientes_updated
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_clientes_empresa_cnpj ON public.clientes (empresa_id, cnpj);