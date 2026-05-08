ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS cakto_checkout_url_mensal text,
  ADD COLUMN IF NOT EXISTS cakto_checkout_url_anual text;