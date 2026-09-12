
ALTER TABLE public.diario_obra
  ADD COLUMN IF NOT EXISTS clima_manha text,
  ADD COLUMN IF NOT EXISTS clima_tarde text,
  ADD COLUMN IF NOT EXISTS condicao_trabalho text NOT NULL DEFAULT 'praticavel',
  ADD COLUMN IF NOT EXISTS efetivo jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS equipamentos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS atividades_executadas text,
  ADD COLUMN IF NOT EXISTS ocorrencias text,
  ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES public.pessoas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz;

ALTER TABLE public.diario_obra ALTER COLUMN observacoes DROP NOT NULL;
ALTER TABLE public.diario_obra ALTER COLUMN observacoes SET DEFAULT '';

ALTER TABLE public.diario_obra
  DROP CONSTRAINT IF EXISTS diario_obra_clima_manha_chk,
  DROP CONSTRAINT IF EXISTS diario_obra_clima_tarde_chk,
  DROP CONSTRAINT IF EXISTS diario_obra_condicao_chk;
ALTER TABLE public.diario_obra
  ADD CONSTRAINT diario_obra_clima_manha_chk CHECK (clima_manha IS NULL OR clima_manha IN ('sol','nublado','chuva_fraca','chuva_forte')),
  ADD CONSTRAINT diario_obra_clima_tarde_chk CHECK (clima_tarde IS NULL OR clima_tarde IN ('sol','nublado','chuva_fraca','chuva_forte')),
  ADD CONSTRAINT diario_obra_condicao_chk CHECK (condicao_trabalho IN ('praticavel','impraticavel'));

CREATE UNIQUE INDEX IF NOT EXISTS diario_obra_unico_dia
  ON public.diario_obra (empresa_id, obra_id, data_envio);
CREATE INDEX IF NOT EXISTS diario_obra_emp_data_idx ON public.diario_obra (empresa_id, data_envio DESC);

-- Fotos do dia vinculadas ao RDO
ALTER TABLE public.fotos_obra
  ADD COLUMN IF NOT EXISTS diario_id uuid REFERENCES public.diario_obra(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS fotos_obra_diario_idx ON public.fotos_obra (empresa_id, diario_id);

-- Garante que a foto e o diário sejam da mesma empresa e da mesma obra
CREATE OR REPLACE FUNCTION public.fn_valida_foto_diario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.diario_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.diario_obra d
      WHERE d.id = NEW.diario_id
        AND d.empresa_id = NEW.empresa_id
        AND d.obra_id = NEW.obra_id
    ) THEN
      RAISE EXCEPTION 'Diário informado não pertence a esta obra/empresa';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fn_valida_foto_diario() FROM anon, authenticated, public;
DROP TRIGGER IF EXISTS trg_valida_foto_diario ON public.fotos_obra;
CREATE TRIGGER trg_valida_foto_diario
  BEFORE INSERT OR UPDATE OF diario_id ON public.fotos_obra
  FOR EACH ROW EXECUTE FUNCTION public.fn_valida_foto_diario();

-- Policies do diário: módulo próprio 'diario' + restrição por obra vinculada
DROP POLICY IF EXISTS diario_sel ON public.diario_obra;
DROP POLICY IF EXISTS diario_ins ON public.diario_obra;
DROP POLICY IF EXISTS diario_upd ON public.diario_obra;
DROP POLICY IF EXISTS diario_del ON public.diario_obra;

CREATE POLICY diario_sel ON public.diario_obra FOR SELECT TO authenticated
USING (
  tenant_match(empresa_id)
  AND can_access_obra(auth.uid(), obra_id)
  AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(), 'diario', 'view'))
);

CREATE POLICY diario_ins ON public.diario_obra FOR INSERT TO authenticated
WITH CHECK (
  tenant_can_write(empresa_id)
  AND can_access_obra(auth.uid(), obra_id)
  AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(), 'diario', 'create'))
  AND EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_id AND o.empresa_id = diario_obra.empresa_id)
  AND (responsavel_id IS NULL OR EXISTS (
    SELECT 1 FROM public.pessoas p WHERE p.id = responsavel_id AND p.empresa_id = diario_obra.empresa_id))
);

CREATE POLICY diario_upd ON public.diario_obra FOR UPDATE TO authenticated
USING (
  tenant_can_write(empresa_id)
  AND can_access_obra(auth.uid(), obra_id)
  AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(), 'diario', 'edit'))
  AND EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_id AND o.empresa_id = diario_obra.empresa_id)
)
WITH CHECK (
  tenant_can_write(empresa_id)
  AND can_access_obra(auth.uid(), obra_id)
  AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(), 'diario', 'edit'))
  AND EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_id AND o.empresa_id = diario_obra.empresa_id)
  AND (responsavel_id IS NULL OR EXISTS (
    SELECT 1 FROM public.pessoas p WHERE p.id = responsavel_id AND p.empresa_id = diario_obra.empresa_id))
);

CREATE POLICY diario_del ON public.diario_obra FOR DELETE TO authenticated
USING (
  tenant_can_write(empresa_id)
  AND can_access_obra(auth.uid(), obra_id)
  AND (is_admin_or_super(auth.uid()) OR has_permission(auth.uid(), 'diario', 'delete'))
);
