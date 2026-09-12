
-- b) NF sem PC: reaproveita o recebimento único do PC em aberto
CREATE OR REPLACE FUNCTION public.fn_nf_to_recebimento_retencao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_rec public.recebimentos%ROWTYPE;
  v_prazo integer := 30;
  v_cat uuid;
  v_ret numeric(14,2);
  v_found boolean := false;
  v_cnt integer;
BEGIN
  PERFORM set_config('app.sync', 'on', true);
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lancamentos_financeiros WHERE origem='retencao_nf' AND origem_id=OLD.id;
    RETURN OLD;
  END IF;

  v_ret := NEW.ret_inss + NEW.ret_iss + NEW.ret_irrf + NEW.ret_pcc;
  SELECT c.prazo_pagamento_dias INTO v_prazo
  FROM public.obras o LEFT JOIN public.clientes c ON c.id=o.cliente_id
  WHERE o.id=NEW.obra_id;
  v_prazo := COALESCE(v_prazo, 30);

  SELECT * INTO v_rec FROM public.recebimentos WHERE nota_fiscal_id=NEW.id LIMIT 1;
  v_found := FOUND;

  IF NOT v_found AND NEW.pedido_compra_id IS NOT NULL THEN
    SELECT * INTO v_rec FROM public.recebimentos
    WHERE pedido_compra_id=NEW.pedido_compra_id AND nota_fiscal_id IS NULL LIMIT 1;
    v_found := FOUND;
  END IF;

  -- sem PC informado: usa o único recebimento de PC em aberto da obra
  IF NOT v_found AND NEW.pedido_compra_id IS NULL AND NEW.obra_id IS NOT NULL THEN
    SELECT count(*) INTO v_cnt
    FROM public.recebimentos r
    WHERE r.obra_id = NEW.obra_id
      AND r.pedido_compra_id IS NOT NULL
      AND r.nota_fiscal_id IS NULL
      AND COALESCE(r.valor_recebido,0) = 0
      AND NOT EXISTS (SELECT 1 FROM public.recebimento_pagamentos p WHERE p.recebimento_id = r.id);
    IF v_cnt = 1 THEN
      SELECT * INTO v_rec FROM public.recebimentos r
      WHERE r.obra_id = NEW.obra_id
        AND r.pedido_compra_id IS NOT NULL
        AND r.nota_fiscal_id IS NULL
        AND COALESCE(r.valor_recebido,0) = 0
        AND NOT EXISTS (SELECT 1 FROM public.recebimento_pagamentos p WHERE p.recebimento_id = r.id)
      LIMIT 1;
      v_found := FOUND;
    END IF;
  END IF;

  IF NOT v_found THEN
    INSERT INTO public.recebimentos (
      empresa_id, obra_id, pedido_compra_id, nota_fiscal_id, valor, valor_recebido,
      data_prevista, status, descricao
    ) VALUES (
      NEW.empresa_id, NEW.obra_id, NEW.pedido_compra_id, NEW.id, NEW.valor_liquido, 0,
      NEW.data_emissao + v_prazo, 'a_receber', 'NF ' || NEW.numero_nf
    );
  ELSE
    UPDATE public.recebimentos SET
      nota_fiscal_id=NEW.id, obra_id=NEW.obra_id, valor=NEW.valor_liquido,
      data_prevista=CASE WHEN valor_recebido > 0 THEN data_prevista ELSE NEW.data_emissao + v_prazo END,
      descricao='NF ' || NEW.numero_nf, updated_at=now()
    WHERE id=v_rec.id;
  END IF;

  SELECT id INTO v_cat FROM public.categorias_financeiras
  WHERE empresa_id=NEW.empresa_id AND nome='Impostos retidos na fonte' LIMIT 1;
  IF v_cat IS NULL THEN
    INSERT INTO public.categorias_financeiras(empresa_id,nome,grupo,tipo,cor,ativo)
    VALUES(NEW.empresa_id,'Impostos retidos na fonte','custo_imposto','despesa','#64748b',true)
    ON CONFLICT DO NOTHING RETURNING id INTO v_cat;
    IF v_cat IS NULL THEN
      SELECT id INTO v_cat FROM public.categorias_financeiras
      WHERE empresa_id=NEW.empresa_id AND nome='Impostos retidos na fonte' LIMIT 1;
    END IF;
  END IF;

  IF v_ret > 0 THEN
    INSERT INTO public.lancamentos_financeiros(
      empresa_id,obra_id,categoria_id,tipo,status,descricao,valor,data_competencia,
      data_vencimento,data_realizado,origem,origem_id,impacto_caixa
    ) VALUES(
      NEW.empresa_id,NEW.obra_id,v_cat,'despesa','realizado','Retenções NF '||NEW.numero_nf,
      v_ret,NEW.data_emissao,NEW.data_emissao,NEW.data_emissao,'retencao_nf',NEW.id,false
    ) ON CONFLICT(origem,origem_id) DO UPDATE SET
      obra_id=EXCLUDED.obra_id,categoria_id=EXCLUDED.categoria_id,descricao=EXCLUDED.descricao,
      valor=EXCLUDED.valor,data_competencia=EXCLUDED.data_competencia,
      data_vencimento=EXCLUDED.data_vencimento,data_realizado=EXCLUDED.data_realizado,
      impacto_caixa=false,updated_at=now();
  ELSE
    DELETE FROM public.lancamentos_financeiros WHERE origem='retencao_nf' AND origem_id=NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

-- c) PC não altera recebimento com NF ou pagamento; DELETE sai deste trigger
CREATE OR REPLACE FUNCTION public.sync_pedido_compra_recebimento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_rec        public.recebimentos%ROWTYPE;
  v_prazo      integer;
  v_prevista   date;
  v_empresa    uuid;
  v_tem_pag    boolean;
BEGIN
  SELECT * INTO v_rec FROM public.recebimentos WHERE pedido_compra_id = NEW.id LIMIT 1;

  IF FOUND THEN
    v_tem_pag := EXISTS (SELECT 1 FROM public.recebimento_pagamentos p WHERE p.recebimento_id = v_rec.id)
                 OR COALESCE(v_rec.valor_recebido,0) > 0;
    IF v_rec.nota_fiscal_id IS NOT NULL OR v_tem_pag THEN
      RETURN NEW; -- congelado: NF ou pagamento mandam no valor
    END IF;
  END IF;

  IF NEW.obra_id IS NULL OR NEW.data_recebimento IS NULL OR COALESCE(NEW.valor, 0) <= 0 THEN
    DELETE FROM public.recebimentos
    WHERE pedido_compra_id = NEW.id AND status = 'a_receber'
      AND nota_fiscal_id IS NULL AND COALESCE(valor_recebido,0) = 0;
    RETURN NEW;
  END IF;

  SELECT c.prazo_pagamento_dias, o.empresa_id INTO v_prazo, v_empresa
  FROM public.obras o LEFT JOIN public.clientes c ON c.id = o.cliente_id
  WHERE o.id = NEW.obra_id;

  v_empresa := COALESCE(NEW.empresa_id, v_empresa);
  v_prevista := NEW.data_recebimento + COALESCE(v_prazo, 30);

  IF v_rec.id IS NULL THEN
    INSERT INTO public.recebimentos (
      empresa_id, obra_id, valor, data_prevista, data_recebido, status, pedido_compra_id, descricao
    ) VALUES (
      v_empresa, NEW.obra_id, NEW.valor, v_prevista, NULL,
      'a_receber'::recebimento_status, NEW.id, 'PC ' || COALESCE(NEW.numero_pedido, '')
    );
  ELSIF v_rec.status = 'a_receber' THEN
    UPDATE public.recebimentos
       SET obra_id = NEW.obra_id, valor = NEW.valor, data_prevista = v_prevista, updated_at = now()
     WHERE id = v_rec.id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_pedido_compra_recebimento_iud ON public.pedidos_compra;
CREATE TRIGGER trg_sync_pedido_compra_recebimento_iu
AFTER INSERT OR UPDATE ON public.pedidos_compra
FOR EACH ROW EXECUTE FUNCTION public.sync_pedido_compra_recebimento();

-- d) exclusão de PC
CREATE OR REPLACE FUNCTION public.fn_before_delete_pedido_compra()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_rec public.recebimentos%ROWTYPE;
BEGIN
  SELECT * INTO v_rec FROM public.recebimentos WHERE pedido_compra_id = OLD.id LIMIT 1;
  IF FOUND THEN
    IF EXISTS (SELECT 1 FROM public.recebimento_pagamentos p WHERE p.recebimento_id = v_rec.id)
       OR COALESCE(v_rec.valor_recebido,0) > 0 THEN
      RAISE EXCEPTION 'Este pedido já tem pagamento recebido. Estorne os pagamentos antes de excluir.';
    END IF;
    IF v_rec.nota_fiscal_id IS NOT NULL THEN
      RAISE EXCEPTION 'Este pedido tem uma nota fiscal vinculada. Exclua a nota fiscal antes.';
    END IF;
    DELETE FROM public.recebimentos WHERE id = v_rec.id;
  END IF;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_before_delete_pedido_compra ON public.pedidos_compra;
CREATE TRIGGER trg_before_delete_pedido_compra
BEFORE DELETE ON public.pedidos_compra
FOR EACH ROW EXECUTE FUNCTION public.fn_before_delete_pedido_compra();

-- e) exclusão de NF
CREATE OR REPLACE FUNCTION public.fn_before_delete_nota_fiscal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_rec public.recebimentos%ROWTYPE;
  v_pc  public.pedidos_compra%ROWTYPE;
  v_prazo integer;
BEGIN
  PERFORM set_config('app.sync', 'on', true);
  SELECT * INTO v_rec FROM public.recebimentos WHERE nota_fiscal_id = OLD.id LIMIT 1;
  IF FOUND THEN
    IF EXISTS (SELECT 1 FROM public.recebimento_pagamentos p WHERE p.recebimento_id = v_rec.id)
       OR COALESCE(v_rec.valor_recebido,0) > 0 THEN
      RAISE EXCEPTION 'Esta NF já tem recebimento. Estorne os pagamentos antes.';
    END IF;
    IF v_rec.pedido_compra_id IS NOT NULL THEN
      SELECT * INTO v_pc FROM public.pedidos_compra WHERE id = v_rec.pedido_compra_id;
      SELECT c.prazo_pagamento_dias INTO v_prazo
      FROM public.obras o LEFT JOIN public.clientes c ON c.id=o.cliente_id WHERE o.id = v_pc.obra_id;
      UPDATE public.recebimentos SET
        nota_fiscal_id = NULL,
        valor = COALESCE(v_pc.valor, valor),
        data_prevista = COALESCE(v_pc.data_recebimento + COALESCE(v_prazo,30), data_prevista),
        descricao = 'PC ' || COALESCE(v_pc.numero_pedido,''),
        updated_at = now()
      WHERE id = v_rec.id;
    ELSE
      DELETE FROM public.recebimentos WHERE id = v_rec.id;
    END IF;
  END IF;
  DELETE FROM public.lancamentos_financeiros WHERE origem='retencao_nf' AND origem_id = OLD.id;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_before_delete_nota_fiscal ON public.notas_fiscais;
CREATE TRIGGER trg_before_delete_nota_fiscal
BEFORE DELETE ON public.notas_fiscais
FOR EACH ROW EXECUTE FUNCTION public.fn_before_delete_nota_fiscal();
