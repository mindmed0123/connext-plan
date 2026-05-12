ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS onboarding_completo boolean NOT NULL DEFAULT false;

-- Empresas existentes já estão usando o sistema, marcar como concluído
UPDATE public.empresas SET onboarding_completo = true WHERE created_at < now() - interval '1 minute';