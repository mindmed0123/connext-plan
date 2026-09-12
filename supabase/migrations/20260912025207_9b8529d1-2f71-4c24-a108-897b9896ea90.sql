
-- 1) get_dre_obra: qualificar colunas (ambiguidade com os parâmetros de saída)
CREATE OR REPLACE FUNCTION public.get_dre_obra(_empresa_id uuid, _obra_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(obra_id uuid, obra_codigo text, receita_contratada numeric, receita_medida numeric, receita_recebida numeric, custo_subcontratado numeric, custo_materiais numeric, custo_total_real numeric, margem_bruta numeric, margem_pct numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
BEGIN
 IF NOT(public.is_super_admin(auth.uid()) OR _empresa_id=public.get_user_empresa_id()) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
 RETURN QUERY WITH base AS(
  SELECT o.id AS b_id, o.codigo_chamado AS b_cod,
   COALESCE((SELECT SUM(COALESCE(orc.valor_total,orc.valor_orcamento)) FROM orcamentos orc WHERE orc.obra_id=o.id AND orc.empresa_id=_empresa_id AND orc.status='aprovado'),0)
   +COALESCE((SELECT SUM(ad.valor_total) FROM obra_adendos ad WHERE ad.obra_id=o.id AND ad.empresa_id=_empresa_id AND ad.status IN('assinado','em_execucao','concluido')),0) AS b_contratada,
   COALESCE((SELECT SUM(md.valor_medido) FROM medicoes md WHERE md.obra_id=o.id AND md.empresa_id=_empresa_id AND md.status='aprovada'),0) AS b_medida,
   COALESCE((SELECT SUM(lf.valor) FROM lancamentos_financeiros lf WHERE lf.obra_id=o.id AND lf.empresa_id=_empresa_id AND lf.tipo='receita' AND lf.status='realizado' AND lf.impacto_caixa),0) AS b_recebida,
   COALESCE((SELECT SUM(lf.valor) FROM lancamentos_financeiros lf WHERE lf.obra_id=o.id AND lf.empresa_id=_empresa_id AND lf.tipo='despesa' AND lf.status='realizado' AND lf.origem='parcela_pagamento' AND lf.impacto_caixa),0) AS b_terc,
   COALESCE((SELECT SUM(lf.valor) FROM lancamentos_financeiros lf WHERE lf.obra_id=o.id AND lf.empresa_id=_empresa_id AND lf.tipo='despesa' AND lf.status='realizado' AND lf.origem='material' AND lf.impacto_caixa),0) AS b_mat,
   COALESCE((SELECT SUM(lf.valor) FROM lancamentos_financeiros lf WHERE lf.obra_id=o.id AND lf.empresa_id=_empresa_id AND lf.tipo='despesa' AND lf.status='realizado' AND lf.impacto_caixa AND COALESCE(lf.origem,'manual') NOT IN('material','parcela_pagamento','cartao')),0)
   +COALESCE((SELECT SUM(lf.valor) FROM lancamentos_financeiros lf WHERE lf.obra_id=o.id AND lf.empresa_id=_empresa_id AND lf.tipo='despesa' AND lf.status<>'cancelado' AND lf.origem='cartao' AND lf.impacto_caixa),0) AS b_outras,
   o.created_at AS b_created
  FROM obras o WHERE o.empresa_id=_empresa_id AND(_obra_id IS NULL OR o.id=_obra_id)
 )
 SELECT b.b_id,b.b_cod,b.b_contratada,b.b_medida,b.b_recebida,b.b_terc,b.b_mat,
  b.b_terc+b.b_mat+b.b_outras,
  b.b_recebida-(b.b_terc+b.b_mat+b.b_outras),
  CASE WHEN b.b_contratada=0 THEN 0 ELSE round(((b.b_recebida-(b.b_terc+b.b_mat+b.b_outras))/NULLIF(b.b_contratada,0))*100,2) END
 FROM base b ORDER BY b.b_created DESC;
END;$function$;

REVOKE EXECUTE ON FUNCTION public.get_dre_obra(uuid,uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_dre_obra(uuid,uuid) TO authenticated;

-- 2) Bloquear pagamento acima do saldo em aberto
CREATE OR REPLACE FUNCTION public.fn_pagamento_nao_excede_saldo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_valor numeric; v_pago numeric; v_saldo numeric;
BEGIN
  SELECT r.valor INTO v_valor FROM recebimentos r
   WHERE r.id = NEW.recebimento_id AND r.empresa_id = NEW.empresa_id;
  IF v_valor IS NULL THEN
    RAISE EXCEPTION 'Registro de outra empresa';
  END IF;
  SELECT COALESCE(SUM(p.valor),0) INTO v_pago
    FROM recebimento_pagamentos p
   WHERE p.recebimento_id = NEW.recebimento_id
     AND p.empresa_id = NEW.empresa_id
     AND (TG_OP = 'INSERT' OR p.id <> NEW.id);
  v_saldo := round(v_valor - v_pago, 2);
  IF NEW.valor > v_saldo + 0.005 THEN
    RAISE EXCEPTION 'O pagamento passa do saldo em aberto de R$ %', to_char(GREATEST(v_saldo,0),'FM999999999D00');
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_pagamento_nao_excede_saldo ON public.recebimento_pagamentos;
CREATE TRIGGER trg_pagamento_nao_excede_saldo
BEFORE INSERT OR UPDATE OF valor, recebimento_id ON public.recebimento_pagamentos
FOR EACH ROW EXECUTE FUNCTION public.fn_pagamento_nao_excede_saldo();

-- 3) Não permitir reduzir o valor do recebimento abaixo do total pago
CREATE OR REPLACE FUNCTION public.fn_recebimento_valor_minimo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_pago numeric;
BEGIN
  IF NEW.valor IS DISTINCT FROM OLD.valor THEN
    SELECT COALESCE(SUM(p.valor),0) INTO v_pago
      FROM recebimento_pagamentos p
     WHERE p.recebimento_id = OLD.id AND p.empresa_id = OLD.empresa_id;
    IF NEW.valor < v_pago - 0.005 THEN
      RAISE EXCEPTION 'O valor não pode ficar abaixo do que já foi pago (R$ %)', to_char(v_pago,'FM999999999D00');
    END IF;
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_recebimento_valor_minimo ON public.recebimentos;
CREATE TRIGGER trg_recebimento_valor_minimo
BEFORE UPDATE OF valor ON public.recebimentos
FOR EACH ROW EXECUTE FUNCTION public.fn_recebimento_valor_minimo();

-- 4) Propagar obra/descrição do recebimento para os lançamentos dos pagamentos
CREATE OR REPLACE FUNCTION public.fn_recebimento_sync_lancamentos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.obra_id IS DISTINCT FROM OLD.obra_id
     OR COALESCE(NEW.descricao,'') IS DISTINCT FROM COALESCE(OLD.descricao,'') THEN
    UPDATE lancamentos_financeiros lf
       SET obra_id = NEW.obra_id,
           descricao = COALESCE(NEW.descricao,'Recebimento'),
           updated_at = now()
     WHERE lf.empresa_id = NEW.empresa_id
       AND lf.origem IN ('recebimento','recebimento_saldo','recebimento_pagamento')
       AND (lf.origem_id = NEW.id
            OR lf.origem_id IN (SELECT p.id FROM recebimento_pagamentos p
                                 WHERE p.recebimento_id = NEW.id AND p.empresa_id = NEW.empresa_id));
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_recebimento_sync_lancamentos ON public.recebimentos;
CREATE TRIGGER trg_recebimento_sync_lancamentos
AFTER UPDATE OF obra_id, descricao ON public.recebimentos
FOR EACH ROW EXECUTE FUNCTION public.fn_recebimento_sync_lancamentos();
