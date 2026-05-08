CREATE POLICY "Empresa vê seus billing events"
ON public.billing_events
FOR SELECT
TO authenticated
USING (tenant_match(empresa_id));