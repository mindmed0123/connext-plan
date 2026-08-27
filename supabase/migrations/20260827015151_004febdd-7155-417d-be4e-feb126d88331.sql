CREATE OR REPLACE FUNCTION public.can_access_obra(_uid uuid, _obra_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.obras o
    WHERE o.id = _obra_id
      AND (
        public.is_super_admin(_uid)
        OR (
          o.empresa_id = (
            SELECT ur.empresa_id
            FROM public.user_roles ur
            WHERE ur.user_id = _uid
              AND ur.empresa_id IS NOT NULL
              AND NOT public.is_super_admin(_uid)
            ORDER BY ur.created_at ASC
            LIMIT 1
          )
          AND (
            public.is_admin_or_super(_uid)
            OR public.has_permission(_uid, 'obras', 'view')
            OR public.has_permission(_uid, 'financeiro', 'view')
            OR public.has_permission(_uid, 'faturamento', 'view')
            OR public.has_permission(_uid, 'orcamentos', 'view')
            OR EXISTS (
              SELECT 1
              FROM public.obra_responsaveis r
              JOIN public.pessoas p ON p.id = r.pessoa_id
              WHERE r.obra_id = _obra_id
                AND p.user_id = _uid
                AND p.status = 'ativo'
                AND p.empresa_id = o.empresa_id
            )
          )
        )
      )
  );
$$;