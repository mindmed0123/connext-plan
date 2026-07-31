DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'regime_tributario' AND n.nspname = 'public') THEN
    CREATE TYPE public.regime_tributario AS ENUM ('simples_anexo_iii_v', 'simples_anexo_iv', 'lucro_presumido', 'lucro_real');
  END IF;
END $$;

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS regime_tributario public.regime_tributario DEFAULT 'simples_anexo_iv',
  ADD COLUMN IF NOT EXISTS saldo_inicial numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_saldo_inicial date;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS municipio text,
  ADD COLUMN IF NOT EXISTS aliquota_iss numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retem_iss boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retem_inss boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS retem_irrf boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retem_csrf boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prazo_pagamento_dias integer NOT NULL DEFAULT 30;

ALTER TABLE public.contratos_clientes
  ADD COLUMN IF NOT EXISTS prazo_pagamento_dias integer;