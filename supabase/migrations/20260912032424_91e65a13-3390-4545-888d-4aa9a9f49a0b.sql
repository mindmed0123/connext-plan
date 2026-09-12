REVOKE EXECUTE ON FUNCTION public.fn_categoria_sync_grupo() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.fn_block_delete_categoria_em_uso() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.fn_valida_centro_custo() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.fn_valida_perfil_pessoa() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.seed_listas_opcoes(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.seed_perfis_permissao(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.categoria_por_papel(uuid, text) FROM anon, public;