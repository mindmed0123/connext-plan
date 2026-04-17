-- Tornar obra_id opcional e adicionar campo de texto livre para obras antigas
ALTER TABLE public.pedidos_compra ALTER COLUMN obra_id DROP NOT NULL;
ALTER TABLE public.pedidos_compra ADD COLUMN IF NOT EXISTS codigo_chamado_avulso text;
ALTER TABLE public.pedidos_compra ADD CONSTRAINT pedidos_compra_obra_or_avulso_chk
  CHECK (obra_id IS NOT NULL OR (codigo_chamado_avulso IS NOT NULL AND length(trim(codigo_chamado_avulso)) > 0));

ALTER TABLE public.rcs ALTER COLUMN obra_id DROP NOT NULL;
ALTER TABLE public.rcs ADD COLUMN IF NOT EXISTS codigo_chamado_avulso text;
ALTER TABLE public.rcs ADD CONSTRAINT rcs_obra_or_avulso_chk
  CHECK (obra_id IS NOT NULL OR (codigo_chamado_avulso IS NOT NULL AND length(trim(codigo_chamado_avulso)) > 0));

ALTER TABLE public.notas_fiscais ALTER COLUMN obra_id DROP NOT NULL;
ALTER TABLE public.notas_fiscais ADD COLUMN IF NOT EXISTS codigo_chamado_avulso text;
ALTER TABLE public.notas_fiscais ADD CONSTRAINT notas_fiscais_obra_or_avulso_chk
  CHECK (obra_id IS NOT NULL OR (codigo_chamado_avulso IS NOT NULL AND length(trim(codigo_chamado_avulso)) > 0));