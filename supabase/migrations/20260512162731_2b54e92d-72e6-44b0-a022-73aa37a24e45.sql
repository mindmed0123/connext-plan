CREATE OR REPLACE FUNCTION public.admin_list_empresas_contatos()
RETURNS TABLE(empresa_id uuid, admin_email text, admin_nome text, admin_telefone text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;
  RETURN QUERY
    SELECT ur.empresa_id,
           u.email::text AS admin_email,
           p.nome AS admin_nome,
           p.telefone AS admin_telefone
      FROM public.user_roles ur
      JOIN auth.users u ON u.id = ur.user_id
      LEFT JOIN public.profiles p ON p.user_id = ur.user_id
     WHERE ur.role = 'admin' AND ur.empresa_id IS NOT NULL;
END;
$$;