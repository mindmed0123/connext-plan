DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['recebimento_pagamentos','fornecedores','contas_pagar','contas_pagar_parcelas','contas_bancarias','extrato_bancario','diario_obra','fotos_obra','obra_status_config']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=t)
       AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;