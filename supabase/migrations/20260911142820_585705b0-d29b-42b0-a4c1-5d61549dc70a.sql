CREATE TABLE public.checkout_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  plano_id uuid NOT NULL REFERENCES public.planos(id),
  periodo text NOT NULL CHECK (periodo IN ('mensal','anual')),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  usado_em timestamptz
);

GRANT ALL ON public.checkout_intents TO service_role;

ALTER TABLE public.checkout_intents ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_checkout_intents_empresa ON public.checkout_intents(empresa_id);