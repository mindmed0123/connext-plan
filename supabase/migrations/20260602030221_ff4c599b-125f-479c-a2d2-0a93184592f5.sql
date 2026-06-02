ALTER TABLE public.recebimentos ALTER COLUMN obra_id DROP NOT NULL;
ALTER TABLE public.recebimentos ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE public.recebimentos ADD COLUMN IF NOT EXISTS observacoes TEXT;