ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS pedido_compra_id uuid REFERENCES public.pedidos_compra(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notas_fiscais_pedido_compra_id
  ON public.notas_fiscais(pedido_compra_id);