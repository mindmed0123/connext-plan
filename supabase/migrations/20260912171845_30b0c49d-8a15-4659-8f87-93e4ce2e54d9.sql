ALTER TABLE public.ordens_compra DROP CONSTRAINT IF EXISTS ordens_compra_status_check;
ALTER TABLE public.ordens_compra ADD CONSTRAINT ordens_compra_status_check
  CHECK (status IN ('aguardando_aprovacao','emitida','parcial','recebida','cancelada'));

ALTER TABLE public.solicitacoes_compra DROP CONSTRAINT IF EXISTS solicitacoes_compra_status_check;
ALTER TABLE public.solicitacoes_compra ADD CONSTRAINT solicitacoes_compra_status_check
  CHECK (status IN ('rascunho','aguardando_aprovacao','aberta','cotando','aprovada','reprovada','atendida'));