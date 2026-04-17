-- Enums
CREATE TYPE public.contratacao_status AS ENUM ('pendente', 'parcialmente_pago', 'pago', 'cancelado');
CREATE TYPE public.parcela_status AS ENUM ('pendente', 'pago');

-- Tabela de contratações de terceirizados por obra
CREATE TABLE public.contratacoes_terceirizado (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  terceirizado_id UUID NOT NULL REFERENCES public.pessoas(id) ON DELETE RESTRICT,
  valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantidade_parcelas INTEGER NOT NULL DEFAULT 1,
  forma_pagamento_prevista public.forma_pagamento,
  observacoes TEXT,
  status_financeiro public.contratacao_status NOT NULL DEFAULT 'pendente',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contratacoes_obra ON public.contratacoes_terceirizado(obra_id);
CREATE INDEX idx_contratacoes_terceirizado ON public.contratacoes_terceirizado(terceirizado_id);

ALTER TABLE public.contratacoes_terceirizado ENABLE ROW LEVEL SECURITY;

CREATE POLICY contratacoes_sel ON public.contratacoes_terceirizado FOR SELECT TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY contratacoes_ins ON public.contratacoes_terceirizado FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY contratacoes_upd ON public.contratacoes_terceirizado FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY contratacoes_del ON public.contratacoes_terceirizado FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_contratacoes_updated_at BEFORE UPDATE ON public.contratacoes_terceirizado
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de parcelas
CREATE TABLE public.parcelas_pagamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contratacao_id UUID NOT NULL REFERENCES public.contratacoes_terceirizado(id) ON DELETE CASCADE,
  numero_parcela INTEGER NOT NULL,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  data_prevista DATE,
  data_pagamento DATE,
  forma_pagamento public.forma_pagamento,
  observacao TEXT,
  comprovante_url TEXT,
  comprovante_path TEXT,
  status public.parcela_status NOT NULL DEFAULT 'pendente',
  paid_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contratacao_id, numero_parcela)
);

CREATE INDEX idx_parcelas_contratacao ON public.parcelas_pagamento(contratacao_id);
CREATE INDEX idx_parcelas_status ON public.parcelas_pagamento(status);
CREATE INDEX idx_parcelas_data_prevista ON public.parcelas_pagamento(data_prevista);

ALTER TABLE public.parcelas_pagamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY parcelas_sel ON public.parcelas_pagamento FOR SELECT TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY parcelas_ins ON public.parcelas_pagamento FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY parcelas_upd ON public.parcelas_pagamento FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY parcelas_del ON public.parcelas_pagamento FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_parcelas_updated_at BEFORE UPDATE ON public.parcelas_pagamento
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função para recalcular status financeiro da contratação
CREATE OR REPLACE FUNCTION public.recalcular_status_contratacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contratacao_id UUID;
  v_total NUMERIC;
  v_pago NUMERIC;
  v_novo_status public.contratacao_status;
BEGIN
  v_contratacao_id := COALESCE(NEW.contratacao_id, OLD.contratacao_id);

  SELECT valor_total INTO v_total FROM public.contratacoes_terceirizado WHERE id = v_contratacao_id;
  SELECT COALESCE(SUM(valor), 0) INTO v_pago FROM public.parcelas_pagamento
    WHERE contratacao_id = v_contratacao_id AND status = 'pago';

  IF v_pago <= 0 THEN
    v_novo_status := 'pendente';
  ELSIF v_pago >= v_total THEN
    v_novo_status := 'pago';
  ELSE
    v_novo_status := 'parcialmente_pago';
  END IF;

  UPDATE public.contratacoes_terceirizado
    SET status_financeiro = v_novo_status, updated_at = now()
    WHERE id = v_contratacao_id AND status_financeiro <> 'cancelado';

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_parcelas_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.parcelas_pagamento
FOR EACH ROW EXECUTE FUNCTION public.recalcular_status_contratacao();

-- Bucket de comprovantes (privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes-pagamento', 'comprovantes-pagamento', false)
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket: somente admin/super admin
CREATE POLICY "comprovantes_sel_admin" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'comprovantes-pagamento' AND public.is_admin_or_super(auth.uid()));

CREATE POLICY "comprovantes_ins_admin" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'comprovantes-pagamento' AND public.is_admin_or_super(auth.uid()));

CREATE POLICY "comprovantes_upd_admin" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'comprovantes-pagamento' AND public.is_admin_or_super(auth.uid()));

CREATE POLICY "comprovantes_del_admin" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'comprovantes-pagamento' AND public.is_super_admin(auth.uid()));