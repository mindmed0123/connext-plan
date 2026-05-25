
ALTER TABLE public.cartao_despesas
  ADD CONSTRAINT cartao_despesas_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES public.obras(id) ON DELETE SET NULL;
NOTIFY pgrst, 'reload schema';
