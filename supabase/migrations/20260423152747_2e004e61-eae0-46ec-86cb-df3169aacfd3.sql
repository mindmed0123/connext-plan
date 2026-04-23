-- 1) Permitir admin/gestor (além de super_admin) excluir obras
DROP POLICY IF EXISTS obras_delete ON public.obras;
CREATE POLICY obras_delete ON public.obras
  FOR DELETE TO authenticated
  USING (
    public.is_admin_or_super(auth.uid())
    OR public.has_permission(auth.uid(), 'obras', 'delete')
  );

-- 2) Permitir delete em cascata nas tabelas filhas (apenas quando vier via cascade da obra mãe)
-- Como não há FK declaradas com ON DELETE CASCADE, vamos recriar as FKs com CASCADE.

-- Helper: recriar FK obra_id -> obras(id) ON DELETE CASCADE
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tc.table_schema, tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
     AND rc.constraint_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.constraint_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_name = 'obras'
      AND ccu.column_name = 'id'
      AND kcu.column_name = 'obra_id'
      AND rc.delete_rule <> 'CASCADE'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.table_name, r.constraint_name);
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (obra_id) REFERENCES public.obras(id) ON DELETE CASCADE',
      r.table_name, r.constraint_name
    );
  END LOOP;
END$$;

-- 3) Cascade nas parcelas quando a contratação for removida (que por sua vez cai com a obra)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
     AND rc.constraint_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.constraint_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = 'parcelas_pagamento'
      AND ccu.table_name = 'contratacoes_terceirizado'
      AND rc.delete_rule <> 'CASCADE'
  LOOP
    EXECUTE format('ALTER TABLE public.parcelas_pagamento DROP CONSTRAINT %I', r.constraint_name);
    EXECUTE format(
      'ALTER TABLE public.parcelas_pagamento ADD CONSTRAINT %I FOREIGN KEY (contratacao_id) REFERENCES public.contratacoes_terceirizado(id) ON DELETE CASCADE',
      r.constraint_name
    );
  END LOOP;
END$$;