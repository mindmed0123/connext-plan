CREATE TABLE public.materiais_obra (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  fornecedor TEXT,
  quantidade NUMERIC NOT NULL DEFAULT 1,
  unidade TEXT,
  valor_unitario NUMERIC NOT NULL DEFAULT 0,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  data_compra DATE NOT NULL DEFAULT CURRENT_DATE,
  forma_pagamento public.forma_pagamento,
  numero_nf TEXT,
  observacoes TEXT,
  anexo_path TEXT,
  anexo_url TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_materiais_obra_obra ON public.materiais_obra(obra_id);

ALTER TABLE public.materiais_obra ENABLE ROW LEVEL SECURITY;

CREATE POLICY materiais_sel ON public.materiais_obra FOR SELECT TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY materiais_ins ON public.materiais_obra FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY materiais_upd ON public.materiais_obra FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY materiais_del ON public.materiais_obra FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_materiais_obra_updated
  BEFORE UPDATE ON public.materiais_obra
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket para anexos (notas fiscais de material)
INSERT INTO storage.buckets (id, name, public) VALUES ('materiais-anexos', 'materiais-anexos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Materiais anexos select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'materiais-anexos' AND public.is_admin_or_super(auth.uid()));

CREATE POLICY "Materiais anexos insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'materiais-anexos' AND public.is_admin_or_super(auth.uid()));

CREATE POLICY "Materiais anexos update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'materiais-anexos' AND public.is_admin_or_super(auth.uid()));

CREATE POLICY "Materiais anexos delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'materiais-anexos' AND public.is_super_admin(auth.uid()));