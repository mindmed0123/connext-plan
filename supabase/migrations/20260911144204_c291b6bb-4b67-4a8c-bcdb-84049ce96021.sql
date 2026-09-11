ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS arquivada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivada_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_obras_arquivada ON public.obras (empresa_id, arquivada);

-- 1) Bloqueio de exclusão de obra com movimento financeiro
CREATE OR REPLACE FUNCTION public.fn_block_delete_obra_com_movimento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.notas_fiscais WHERE obra_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.recebimentos WHERE obra_id = OLD.id AND status = 'recebido')
     OR EXISTS (
       SELECT 1 FROM public.parcelas_pagamento p
       JOIN public.contratacoes_terceirizado c ON c.id = p.contratacao_id
       WHERE c.obra_id = OLD.id AND p.status = 'pago'
     )
     OR EXISTS (SELECT 1 FROM public.materiais_obra WHERE obra_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.cartao_despesas WHERE obra_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.lancamentos_financeiros WHERE obra_id = OLD.id AND status = 'realizado')
  THEN
    RAISE EXCEPTION 'Esta obra tem movimento financeiro. Use Arquivar.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_delete_obra_com_movimento ON public.obras;
CREATE TRIGGER trg_block_delete_obra_com_movimento
BEFORE DELETE ON public.obras
FOR EACH ROW EXECUTE FUNCTION public.fn_block_delete_obra_com_movimento();

-- 2) Cartões: despesas passam a impedir a exclusão do cartão
ALTER TABLE public.cartao_despesas DROP CONSTRAINT IF EXISTS cartao_despesas_cartao_id_fkey;
ALTER TABLE public.cartao_despesas
  ADD CONSTRAINT cartao_despesas_cartao_id_fkey
  FOREIGN KEY (cartao_id) REFERENCES public.cartoes_credito(id) ON DELETE RESTRICT;

-- 3) Contratações com parcela paga não podem ser excluídas
CREATE OR REPLACE FUNCTION public.fn_block_delete_contratacao_paga()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.parcelas_pagamento WHERE contratacao_id = OLD.id AND status = 'pago') THEN
    RAISE EXCEPTION 'Há parcelas pagas. Cancele a contratação em vez de excluir.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_delete_contratacao_paga ON public.contratacoes_terceirizado;
CREATE TRIGGER trg_block_delete_contratacao_paga
BEFORE DELETE ON public.contratacoes_terceirizado
FOR EACH ROW EXECUTE FUNCTION public.fn_block_delete_contratacao_paga();

REVOKE EXECUTE ON FUNCTION public.fn_block_delete_obra_com_movimento() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.fn_block_delete_contratacao_paga() FROM anon, authenticated, public;