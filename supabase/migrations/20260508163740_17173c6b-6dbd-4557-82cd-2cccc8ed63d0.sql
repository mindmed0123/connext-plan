
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'obras','pessoas','execucoes','contratacoes_terceirizado','materiais_obra',
    'fotos_obra','vistorias','diario_obra','pedidos_compra','recebimentos',
    'pessoa_permissoes','orcamentos','notas_fiscais','rcs','parcelas_pagamento',
    'obra_responsaveis','obra_timeline'
  ])
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN empresa_id SET DEFAULT public.get_user_empresa_id()',
      t
    );
    -- O trigger não é mais necessário (default cobre o caso)
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_empresa_id ON public.%I', t);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_set_empresa_id_origens ON public.origens_obra;
ALTER TABLE public.origens_obra ALTER COLUMN empresa_id SET DEFAULT public.get_user_empresa_id();
