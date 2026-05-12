ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS codigo_chamado TEXT;

ALTER TABLE public.orcamentos
  ALTER COLUMN obra_id DROP NOT NULL;