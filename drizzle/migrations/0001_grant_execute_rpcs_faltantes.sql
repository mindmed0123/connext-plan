GRANT EXECUTE ON FUNCTION public.admin_list_empresas_contatos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_obra_for_chamado(text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_list_empresas_contatos() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ensure_obra_for_chamado(text, text, text) FROM anon, public;