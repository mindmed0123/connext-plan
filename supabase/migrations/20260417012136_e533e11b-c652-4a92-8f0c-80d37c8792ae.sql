-- 1) Forma de pagamento (terceirizado)
DO $$ BEGIN
  CREATE TYPE public.forma_pagamento AS ENUM ('pix', 'dinheiro', 'transferencia', 'boleto', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Orçamentos: anexo + auditoria
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS arquivo_url text,
  ADD COLUMN IF NOT EXISTS arquivo_path text,
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS last_updated_by uuid,
  ADD COLUMN IF NOT EXISTS last_updated_at timestamptz;

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_orcamentos_updated_at ON public.orcamentos;
CREATE TRIGGER trg_orcamentos_updated_at
BEFORE UPDATE ON public.orcamentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Execuções: terceirizado
ALTER TABLE public.execucoes
  ADD COLUMN IF NOT EXISTS valor_terceirizado numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forma_pagamento public.forma_pagamento;

DROP TRIGGER IF EXISTS trg_execucoes_updated_at ON public.execucoes;
CREATE TRIGGER trg_execucoes_updated_at
BEFORE UPDATE ON public.execucoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Bucket de anexos de orçamento
INSERT INTO storage.buckets (id, name, public)
VALUES ('orcamentos-anexos', 'orcamentos-anexos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket
DROP POLICY IF EXISTS "orcamentos_anexos_public_read" ON storage.objects;
CREATE POLICY "orcamentos_anexos_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'orcamentos-anexos');

DROP POLICY IF EXISTS "orcamentos_anexos_auth_insert" ON storage.objects;
CREATE POLICY "orcamentos_anexos_auth_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'orcamentos-anexos');

DROP POLICY IF EXISTS "orcamentos_anexos_auth_update" ON storage.objects;
CREATE POLICY "orcamentos_anexos_auth_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'orcamentos-anexos');

DROP POLICY IF EXISTS "orcamentos_anexos_auth_delete" ON storage.objects;
CREATE POLICY "orcamentos_anexos_auth_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'orcamentos-anexos');

-- 5) Realtime para obras (drag-drop refletir em todos)
ALTER TABLE public.obras REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.obras;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;