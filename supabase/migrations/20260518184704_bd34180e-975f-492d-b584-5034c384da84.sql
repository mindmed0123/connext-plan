REVOKE EXECUTE ON FUNCTION public.criar_obra_segura(text, text, text, text, text, text, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.criar_obra_segura(text, text, text, text, text, text, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.criar_obra_segura(text, text, text, text, text, text, date) TO authenticated;