ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS bdi_ac numeric(6,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bdi_s numeric(6,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bdi_r numeric(6,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bdi_df numeric(6,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bdi_l numeric(6,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bdi_i numeric(6,3) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.orcamentos.bdi_ac IS 'BDI: administracao central (%) - demonstrativo, nao altera o total';
COMMENT ON COLUMN public.orcamentos.bdi_i IS 'BDI: impostos sobre o preco de venda (%) - demonstrativo';