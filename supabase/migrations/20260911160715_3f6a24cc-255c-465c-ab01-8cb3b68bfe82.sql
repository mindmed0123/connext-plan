REVOKE ALL ON FUNCTION public.fn_pagamento_to_lancamento() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_recalc_recebimento_pagamentos() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_block_delete_recebimento_pago() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.verificar_razao() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.verificar_razao() TO authenticated;