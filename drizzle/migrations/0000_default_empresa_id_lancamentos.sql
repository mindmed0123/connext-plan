ALTER TABLE public.lancamentos_financeiros ALTER COLUMN empresa_id SET DEFAULT get_user_empresa_id();
ALTER TABLE public.categorias_financeiras ALTER COLUMN empresa_id SET DEFAULT get_user_empresa_id();
ALTER TABLE public.recebimento_pagamentos ALTER COLUMN empresa_id SET DEFAULT get_user_empresa_id();
ALTER TABLE public.regioes_obra ALTER COLUMN empresa_id SET DEFAULT get_user_empresa_id();