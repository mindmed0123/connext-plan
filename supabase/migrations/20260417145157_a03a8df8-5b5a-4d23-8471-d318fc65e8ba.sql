ALTER TABLE public.rcs DROP CONSTRAINT IF EXISTS rcs_obra_or_avulso_chk;
ALTER TABLE public.pedidos_compra DROP CONSTRAINT IF EXISTS pedidos_compra_obra_or_avulso_chk;
ALTER TABLE public.notas_fiscais DROP CONSTRAINT IF EXISTS notas_fiscais_obra_or_avulso_chk;