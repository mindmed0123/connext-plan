DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'obras','obra_adendos','obra_responsaveis','obra_timeline','orcamentos','orcamento_itens',
    'execucoes','vistorias','contratacoes_terceirizado','parcelas_pagamento','materiais_obra',
    'notas_fiscais','pedidos_compra','rcs','recebimentos','lancamentos_financeiros',
    'cartao_despesas','cartoes_credito','compradores','comprador_contratos','pessoas',
    'pessoa_documentos','pessoa_permissoes','servicos','medicoes','contratos_clientes'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;