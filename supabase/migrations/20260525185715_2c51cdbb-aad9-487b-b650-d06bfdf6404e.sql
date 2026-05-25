ALTER PUBLICATION supabase_realtime ADD TABLE public.pessoa_permissoes;
ALTER TABLE public.pessoa_permissoes REPLICA IDENTITY FULL;