-- Atualizar can_access_obra para considerar permissão "view" no módulo "obras"
CREATE OR REPLACE FUNCTION public.can_access_obra(_uid uuid, _obra_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    public.is_admin_or_super(_uid)
    OR public.has_permission(_uid, 'obras', 'view')
    OR EXISTS (
      SELECT 1 FROM public.obra_responsaveis r
      JOIN public.pessoas p ON p.id = r.pessoa_id
      WHERE r.obra_id = _obra_id AND p.user_id = _uid AND p.status = 'ativo'
    );
$function$;

-- ===== OBRAS =====
DROP POLICY IF EXISTS obras_insert ON public.obras;
DROP POLICY IF EXISTS obras_update ON public.obras;
CREATE POLICY obras_insert ON public.obras FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'obras', 'create'));
CREATE POLICY obras_update ON public.obras FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'obras', 'edit'));

-- ===== ORCAMENTOS =====
DROP POLICY IF EXISTS orcamentos_sel ON public.orcamentos;
DROP POLICY IF EXISTS orcamentos_ins ON public.orcamentos;
DROP POLICY IF EXISTS orcamentos_upd ON public.orcamentos;
CREATE POLICY orcamentos_sel ON public.orcamentos FOR SELECT TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'orcamentos', 'view'));
CREATE POLICY orcamentos_ins ON public.orcamentos FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'orcamentos', 'create'));
CREATE POLICY orcamentos_upd ON public.orcamentos FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'orcamentos', 'edit'));

-- ===== VISTORIAS =====
DROP POLICY IF EXISTS vistorias_sel ON public.vistorias;
DROP POLICY IF EXISTS vistorias_ins ON public.vistorias;
DROP POLICY IF EXISTS vistorias_upd ON public.vistorias;
CREATE POLICY vistorias_sel ON public.vistorias FOR SELECT TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'vistorias', 'view'));
CREATE POLICY vistorias_ins ON public.vistorias FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'vistorias', 'create'));
CREATE POLICY vistorias_upd ON public.vistorias FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'vistorias', 'edit'));

-- ===== EXECUCOES =====
DROP POLICY IF EXISTS execucoes_sel ON public.execucoes;
DROP POLICY IF EXISTS execucoes_ins ON public.execucoes;
DROP POLICY IF EXISTS execucoes_upd ON public.execucoes;
CREATE POLICY execucoes_sel ON public.execucoes FOR SELECT TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'execucoes', 'view'));
CREATE POLICY execucoes_ins ON public.execucoes FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'execucoes', 'create'));
CREATE POLICY execucoes_upd ON public.execucoes FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'execucoes', 'edit'));

-- ===== DIARIO_OBRA (módulo etapas) =====
DROP POLICY IF EXISTS diario_obra_sel ON public.diario_obra;
DROP POLICY IF EXISTS diario_obra_ins ON public.diario_obra;
DROP POLICY IF EXISTS diario_obra_upd ON public.diario_obra;
CREATE POLICY diario_obra_sel ON public.diario_obra FOR SELECT TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'etapas', 'view'));
CREATE POLICY diario_obra_ins ON public.diario_obra FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'etapas', 'create'));
CREATE POLICY diario_obra_upd ON public.diario_obra FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'etapas', 'edit'));

-- ===== FINANCEIRO (contratacoes, parcelas, recebimentos, materiais, rcs, pedidos_compra) =====
DROP POLICY IF EXISTS contratacoes_sel ON public.contratacoes_terceirizado;
DROP POLICY IF EXISTS contratacoes_ins ON public.contratacoes_terceirizado;
DROP POLICY IF EXISTS contratacoes_upd ON public.contratacoes_terceirizado;
CREATE POLICY contratacoes_sel ON public.contratacoes_terceirizado FOR SELECT TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'view'));
CREATE POLICY contratacoes_ins ON public.contratacoes_terceirizado FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'create'));
CREATE POLICY contratacoes_upd ON public.contratacoes_terceirizado FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'edit'));

DROP POLICY IF EXISTS parcelas_sel ON public.parcelas_pagamento;
DROP POLICY IF EXISTS parcelas_ins ON public.parcelas_pagamento;
DROP POLICY IF EXISTS parcelas_upd ON public.parcelas_pagamento;
CREATE POLICY parcelas_sel ON public.parcelas_pagamento FOR SELECT TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'view'));
CREATE POLICY parcelas_ins ON public.parcelas_pagamento FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'create'));
CREATE POLICY parcelas_upd ON public.parcelas_pagamento FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'edit'));

DROP POLICY IF EXISTS recebimentos_sel ON public.recebimentos;
DROP POLICY IF EXISTS recebimentos_ins ON public.recebimentos;
DROP POLICY IF EXISTS recebimentos_upd ON public.recebimentos;
CREATE POLICY recebimentos_sel ON public.recebimentos FOR SELECT TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'view'));
CREATE POLICY recebimentos_ins ON public.recebimentos FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'create'));
CREATE POLICY recebimentos_upd ON public.recebimentos FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'edit'));

DROP POLICY IF EXISTS materiais_sel ON public.materiais_obra;
DROP POLICY IF EXISTS materiais_ins ON public.materiais_obra;
DROP POLICY IF EXISTS materiais_upd ON public.materiais_obra;
CREATE POLICY materiais_sel ON public.materiais_obra FOR SELECT TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'view') OR public.has_permission(auth.uid(), 'obras', 'view'));
CREATE POLICY materiais_ins ON public.materiais_obra FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'create'));
CREATE POLICY materiais_upd ON public.materiais_obra FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'edit'));

DROP POLICY IF EXISTS rcs_sel ON public.rcs;
DROP POLICY IF EXISTS rcs_ins ON public.rcs;
DROP POLICY IF EXISTS rcs_upd ON public.rcs;
CREATE POLICY rcs_sel ON public.rcs FOR SELECT TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'view'));
CREATE POLICY rcs_ins ON public.rcs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'create'));
CREATE POLICY rcs_upd ON public.rcs FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'edit'));

DROP POLICY IF EXISTS pedidos_compra_sel ON public.pedidos_compra;
DROP POLICY IF EXISTS pedidos_compra_ins ON public.pedidos_compra;
DROP POLICY IF EXISTS pedidos_compra_upd ON public.pedidos_compra;
CREATE POLICY pedidos_compra_sel ON public.pedidos_compra FOR SELECT TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'view'));
CREATE POLICY pedidos_compra_ins ON public.pedidos_compra FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'create'));
CREATE POLICY pedidos_compra_upd ON public.pedidos_compra FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'financeiro', 'edit'));

-- ===== FATURAMENTO (notas_fiscais) =====
DROP POLICY IF EXISTS notas_fiscais_sel ON public.notas_fiscais;
DROP POLICY IF EXISTS notas_fiscais_ins ON public.notas_fiscais;
DROP POLICY IF EXISTS notas_fiscais_upd ON public.notas_fiscais;
CREATE POLICY notas_fiscais_sel ON public.notas_fiscais FOR SELECT TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'faturamento', 'view'));
CREATE POLICY notas_fiscais_ins ON public.notas_fiscais FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'faturamento', 'create'));
CREATE POLICY notas_fiscais_upd ON public.notas_fiscais FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'faturamento', 'edit'));

-- ===== EQUIPES (pessoas) =====
DROP POLICY IF EXISTS pessoas_select ON public.pessoas;
DROP POLICY IF EXISTS pessoas_insert ON public.pessoas;
DROP POLICY IF EXISTS pessoas_update ON public.pessoas;
CREATE POLICY pessoas_select ON public.pessoas FOR SELECT TO authenticated
  USING (
    public.is_admin_or_super(auth.uid())
    OR user_id = auth.uid()
    OR public.has_permission(auth.uid(), 'equipes', 'view')
    OR public.has_permission(auth.uid(), 'obras', 'view')
    OR public.has_permission(auth.uid(), 'financeiro', 'view')
  );
CREATE POLICY pessoas_insert ON public.pessoas FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'equipes', 'create'));
CREATE POLICY pessoas_update ON public.pessoas FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'equipes', 'edit'));

-- ===== OBRA_RESPONSAVEIS =====
DROP POLICY IF EXISTS obra_resp_insert ON public.obra_responsaveis;
DROP POLICY IF EXISTS obra_resp_update ON public.obra_responsaveis;
DROP POLICY IF EXISTS obra_resp_delete ON public.obra_responsaveis;
CREATE POLICY obra_resp_insert ON public.obra_responsaveis FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'obras', 'edit'));
CREATE POLICY obra_resp_update ON public.obra_responsaveis FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'obras', 'edit'));
CREATE POLICY obra_resp_delete ON public.obra_responsaveis FOR DELETE TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'obras', 'delete'));

-- ===== FOTOS_OBRA (já usa can_access_obra que agora considera has_permission) =====
DROP POLICY IF EXISTS fotos_update ON public.fotos_obra;
CREATE POLICY fotos_update ON public.fotos_obra FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_permission(auth.uid(), 'obras', 'edit'));
