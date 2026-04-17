-- Permitir que o usuário que enviou a foto possa excluí-la, além do super_admin
DROP POLICY IF EXISTS fotos_delete ON public.fotos_obra;

CREATE POLICY fotos_delete ON public.fotos_obra
FOR DELETE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR uploaded_by = auth.uid()
  OR public.is_admin_or_super(auth.uid())
);