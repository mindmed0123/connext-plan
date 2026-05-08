ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS cakto_product_id_mensal text,
  ADD COLUMN IF NOT EXISTS cakto_product_id_anual text;

ALTER TABLE public.assinaturas
  ADD COLUMN IF NOT EXISTS cakto_subscription_id text,
  ADD COLUMN IF NOT EXISTS cakto_customer_id text;

CREATE INDEX IF NOT EXISTS idx_assinaturas_cakto_sub ON public.assinaturas(cakto_subscription_id);

ALTER TABLE public.billing_events
  ADD COLUMN IF NOT EXISTS cakto_subscription_id text;