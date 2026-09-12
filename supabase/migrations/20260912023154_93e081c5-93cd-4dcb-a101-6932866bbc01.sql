-- 1) Função utilitária de mesma empresa
CREATE OR REPLACE FUNCTION public.mesmo_tenant(_tabela regclass, _id uuid, _empresa uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_ok boolean;
BEGIN
  IF _id IS NULL THEN RETURN true; END IF;
  IF _empresa IS NULL THEN RETURN false; END IF;
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s p WHERE p.id = $1 AND p.empresa_id = $2)', _tabela)
    INTO v_ok USING _id, _empresa;
  RETURN COALESCE(v_ok, false);
END $$;

REVOKE EXECUTE ON FUNCTION public.mesmo_tenant(regclass, uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mesmo_tenant(regclass, uuid, uuid) TO authenticated;

-- 2) Aplica a prova de mesma empresa no WITH CHECK (INSERT) e USING/WITH CHECK (UPDATE)
DO $do$
DECLARE
  r record;
  p record;
  cond text;
  cur_qual text;
  cur_check text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('parcelas_pagamento','contratacao_id','contratacoes_terceirizado'),
      ('orcamento_itens','orcamento_id','orcamentos'),
      ('orcamento_itens','servico_id','servicos'),
      ('cartao_despesas','cartao_id','cartoes_credito'),
      ('cartao_despesas','obra_id','obras'),
      ('cartao_despesas','comprador_id','compradores'),
      ('cartao_despesas','categoria_id','categorias_financeiras'),
      ('orcamentos','obra_id','obras'),
      ('orcamentos','comprador_id','compradores'),
      ('contratacoes_terceirizado','obra_id','obras'),
      ('contratacoes_terceirizado','terceirizado_id','pessoas'),
      ('notas_fiscais','obra_id','obras'),
      ('notas_fiscais','pedido_compra_id','pedidos_compra'),
      ('pedidos_compra','obra_id','obras'),
      ('pedidos_compra','comprador_id','compradores'),
      ('rcs','obra_id','obras'),
      ('recebimentos','obra_id','obras'),
      ('recebimentos','nota_fiscal_id','notas_fiscais'),
      ('recebimentos','pedido_compra_id','pedidos_compra'),
      ('recebimento_pagamentos','recebimento_id','recebimentos'),
      ('materiais_obra','obra_id','obras'),
      ('materiais_obra','comprador_id','compradores'),
      ('medicoes','obra_id','obras'),
      ('medicoes','contrato_id','contratos_clientes'),
      ('obra_adendos','obra_id','obras'),
      ('execucoes','obra_id','obras'),
      ('execucoes','terceirizado_id','pessoas'),
      ('vistorias','obra_id','obras'),
      ('fotos_obra','obra_id','obras'),
      ('diario_obra','obra_id','obras'),
      ('obra_responsaveis','obra_id','obras'),
      ('obra_responsaveis','pessoa_id','pessoas'),
      ('lancamentos_financeiros','obra_id','obras'),
      ('lancamentos_financeiros','categoria_id','categorias_financeiras'),
      ('lancamentos_financeiros','pessoa_id','pessoas'),
      ('contratos_clientes','obra_id','obras'),
      ('contratos_clientes','cliente_id','clientes'),
      ('obras','cliente_id','clientes'),
      ('pessoa_permissoes','pessoa_id','pessoas'),
      ('pessoa_documentos','pessoa_id','pessoas'),
      ('comprador_contratos','comprador_id','compradores'),
      ('servicos','categoria_id','categorias_servico'),
      ('cartao_despesas','comprador_id','compradores')
    ) AS v(tabela, coluna, pai)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=r.tabela AND column_name=r.coluna
    ) THEN
      RAISE NOTICE 'ignorado: %.% nao existe', r.tabela, r.coluna;
      CONTINUE;
    END IF;

    cond := format('public.mesmo_tenant(%L::regclass, %I, empresa_id)', 'public.'||r.pai, r.coluna);

    FOR p IN
      SELECT pol.polname, pol.polcmd,
             pg_get_expr(pol.polqual, pol.polrelid) AS qual,
             pg_get_expr(pol.polwithcheck, pol.polrelid) AS wcheck
      FROM pg_policy pol
      WHERE pol.polrelid = format('public.%I', r.tabela)::regclass
        AND pol.polcmd IN ('a','w')
    LOOP
      cur_qual := p.qual;
      cur_check := p.wcheck;

      IF p.polcmd = 'a' THEN
        IF cur_check IS NULL OR position(cond in cur_check) = 0 THEN
          EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK ((%s) AND %s)',
                         p.polname, r.tabela, COALESCE(cur_check,'true'), cond);
        END IF;
      ELSE
        cur_check := COALESCE(cur_check, cur_qual);
        IF cur_qual IS NULL OR position(cond in cur_qual) = 0 THEN
          cur_qual := format('(%s) AND %s', COALESCE(cur_qual,'true'), cond);
        END IF;
        IF cur_check IS NULL OR position(cond in cur_check) = 0 THEN
          cur_check := format('(%s) AND %s', COALESCE(cur_check,'true'), cond);
        END IF;
        EXECUTE format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)',
                       p.polname, r.tabela, cur_qual, cur_check);
      END IF;
    END LOOP;
  END LOOP;
END $do$;

-- 6) obra_adendos: acrescenta tenant nas policies de select/update/delete
ALTER POLICY obra_adendos_select ON public.obra_adendos
  USING (public.tenant_match(empresa_id) AND public.can_access_obra(auth.uid(), obra_id));
ALTER POLICY obra_adendos_delete ON public.obra_adendos
  USING (public.tenant_can_write(empresa_id) AND public.can_access_obra(auth.uid(), obra_id));

-- 3) Triggers: nunca derivar empresa_id do pai
CREATE OR REPLACE FUNCTION public.fn_parcela_to_lancamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cat uuid; v_empresa uuid; v_obra uuid; v_ct_emp uuid;
BEGIN
  PERFORM set_config('app.sync', 'on', true);
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lancamentos_financeiros
      WHERE origem = 'parcela_pagamento' AND origem_id = OLD.id AND empresa_id = OLD.empresa_id;
    RETURN OLD;
  END IF;

  SELECT ct.empresa_id, ct.obra_id INTO v_ct_emp, v_obra
    FROM public.contratacoes_terceirizado ct WHERE ct.id = NEW.contratacao_id;
  IF v_ct_emp IS NULL OR v_ct_emp IS DISTINCT FROM NEW.empresa_id THEN
    RAISE EXCEPTION 'Registro de outra empresa';
  END IF;
  v_empresa := NEW.empresa_id;

  SELECT id INTO v_cat FROM public.categorias_financeiras
    WHERE empresa_id = v_empresa AND grupo = 'custo_subcontratado' ORDER BY nome LIMIT 1;
  IF v_cat IS NULL THEN
    SELECT id INTO v_cat FROM public.categorias_financeiras
      WHERE empresa_id = v_empresa AND tipo = 'despesa' ORDER BY nome LIMIT 1;
  END IF;

  INSERT INTO public.lancamentos_financeiros (
    empresa_id, obra_id, categoria_id, tipo, status, descricao, valor,
    data_competencia, data_vencimento, data_realizado, forma_pagamento, origem, origem_id
  ) VALUES (
    v_empresa, v_obra, v_cat, 'despesa'::public.lancamento_tipo,
    (CASE WHEN NEW.status = 'pago' THEN 'realizado' ELSE 'previsto' END)::public.lancamento_status,
    'Parcela ' || NEW.numero_parcela || ' - contratação', NEW.valor,
    COALESCE(NEW.data_pagamento, NEW.data_prevista, CURRENT_DATE),
    NEW.data_prevista, NEW.data_pagamento, NEW.forma_pagamento, 'parcela_pagamento', NEW.id
  )
  ON CONFLICT (origem, origem_id) DO UPDATE SET
    empresa_id = EXCLUDED.empresa_id, obra_id = EXCLUDED.obra_id, categoria_id = EXCLUDED.categoria_id,
    status = EXCLUDED.status, descricao = EXCLUDED.descricao, valor = EXCLUDED.valor,
    data_competencia = EXCLUDED.data_competencia, data_vencimento = EXCLUDED.data_vencimento,
    data_realizado = EXCLUDED.data_realizado, forma_pagamento = EXCLUDED.forma_pagamento,
    updated_at = now();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.recalcular_status_contratacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid; v_emp uuid; v_ct_emp uuid; v_total numeric; v_pago numeric;
  v_novo public.contratacao_status;
BEGIN
  v_id := COALESCE(NEW.contratacao_id, OLD.contratacao_id);
  v_emp := COALESCE(NEW.empresa_id, OLD.empresa_id);

  SELECT empresa_id, valor_total INTO v_ct_emp, v_total
    FROM public.contratacoes_terceirizado WHERE id = v_id;
  IF v_ct_emp IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF v_ct_emp IS DISTINCT FROM v_emp THEN RAISE EXCEPTION 'Registro de outra empresa'; END IF;

  SELECT COALESCE(SUM(valor), 0) INTO v_pago FROM public.parcelas_pagamento
    WHERE contratacao_id = v_id AND empresa_id = v_emp AND status = 'pago';

  IF v_pago <= 0 THEN v_novo := 'pendente';
  ELSIF v_pago >= v_total THEN v_novo := 'pago';
  ELSE v_novo := 'parcialmente_pago'; END IF;

  UPDATE public.contratacoes_terceirizado
     SET status_financeiro = v_novo, updated_at = now()
   WHERE id = v_id AND empresa_id = v_emp AND status_financeiro <> 'cancelado';
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE OR REPLACE FUNCTION public.recalc_totais_orcamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_orc_id uuid := COALESCE(NEW.orcamento_id, OLD.orcamento_id);
  v_emp uuid := COALESCE(NEW.empresa_id, OLD.empresa_id);
  v_orc_emp uuid; v_subtotal numeric(14,2); v_impostos numeric(14,2);
  v_desc_pct numeric(5,2); v_desc_valor numeric(14,2);
BEGIN
  IF TG_OP <> 'DELETE' THEN
    NEW.subtotal := ROUND(COALESCE(NEW.quantidade,0) * COALESCE(NEW.preco_unitario,0) * (1 - COALESCE(NEW.desconto_pct,0)/100.0), 2);
  END IF;

  SELECT empresa_id, COALESCE(desconto_global_pct,0) INTO v_orc_emp, v_desc_pct
    FROM public.orcamentos WHERE id = v_orc_id;
  IF v_orc_emp IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF v_orc_emp IS DISTINCT FROM v_emp THEN RAISE EXCEPTION 'Registro de outra empresa'; END IF;
  v_desc_pct := COALESCE(v_desc_pct, 0);

  SELECT COALESCE(SUM(subtotal), 0),
         COALESCE(SUM(ROUND(subtotal * (1 - v_desc_pct/100.0) * COALESCE(aliquota_iss,0) / 100.0, 2)), 0)
    INTO v_subtotal, v_impostos
    FROM public.orcamento_itens WHERE orcamento_id = v_orc_id AND empresa_id = v_emp;

  v_desc_valor := ROUND(v_subtotal * v_desc_pct / 100.0, 2);

  UPDATE public.orcamentos
     SET subtotal = v_subtotal, desconto_global_valor = v_desc_valor, valor_impostos = v_impostos,
         valor_total = v_subtotal - v_desc_valor + v_impostos,
         valor_orcamento = v_subtotal - v_desc_valor + v_impostos, updated_at = now()
   WHERE id = v_orc_id AND empresa_id = v_emp;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE OR REPLACE FUNCTION public.recalc_totais_apos_desc_global()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_subtotal numeric(14,2); v_impostos numeric(14,2);
  v_desc_pct numeric(5,2) := COALESCE(NEW.desconto_global_pct, 0);
  v_desc_valor numeric(14,2);
BEGIN
  SELECT COALESCE(SUM(subtotal),0),
         COALESCE(SUM(ROUND(subtotal * (1 - v_desc_pct/100.0) * COALESCE(aliquota_iss,0)/100.0, 2)),0)
    INTO v_subtotal, v_impostos
    FROM public.orcamento_itens WHERE orcamento_id = NEW.id AND empresa_id = NEW.empresa_id;

  v_desc_valor := ROUND(v_subtotal * v_desc_pct / 100.0, 2);
  NEW.subtotal := v_subtotal;
  NEW.desconto_global_valor := v_desc_valor;
  NEW.valor_impostos := v_impostos;
  NEW.valor_total := v_subtotal - v_desc_valor + v_impostos;
  NEW.valor_orcamento := NEW.valor_total;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.recalc_obra_contrato()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_obra uuid := COALESCE(NEW.obra_id, OLD.obra_id);
  v_emp uuid := COALESCE(NEW.empresa_id, OLD.empresa_id);
  v_obra_emp uuid;
BEGIN
  SELECT empresa_id INTO v_obra_emp FROM public.obras WHERE id = v_obra;
  IF v_obra_emp IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF v_obra_emp IS DISTINCT FROM v_emp THEN RAISE EXCEPTION 'Registro de outra empresa'; END IF;

  UPDATE public.obras o
     SET contrato_qtd_contratada = COALESCE((
           SELECT SUM(a.quantidade) FROM public.obra_adendos a
            WHERE a.obra_id = v_obra AND a.empresa_id = v_emp
              AND a.status IN ('assinado','em_execucao','concluido')
         ), 0), updated_at = now()
   WHERE o.id = v_obra AND o.empresa_id = v_emp;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE OR REPLACE FUNCTION public.fn_cartao_set_fatura()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_f int; v_v int; v_ref date; v_emp uuid;
BEGIN
  SELECT empresa_id, dia_fechamento, dia_vencimento INTO v_emp, v_f, v_v
    FROM public.cartoes_credito WHERE id = NEW.cartao_id;
  IF v_emp IS NULL OR v_emp IS DISTINCT FROM NEW.empresa_id THEN
    RAISE EXCEPTION 'Registro de outra empresa';
  END IF;
  v_ref := COALESCE(NEW.competencia_fatura, NEW.data_compra);
  NEW.fatura_vencimento := COALESCE(public.calc_fatura_vencimento(v_ref, v_f, v_v, 0), NEW.data_compra);
  IF NOT NEW.fatura_paga THEN NEW.fatura_paga_em := NULL; END IF;
  IF NEW.fatura_paga AND NEW.fatura_paga_em IS NULL THEN
    NEW.fatura_paga_em := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.fn_recebimento_to_lancamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cat uuid; v_saldo numeric(14,2); v_obra_emp uuid;
BEGIN
  PERFORM set_config('app.sync','on',true);
  IF TG_OP='DELETE' THEN
    DELETE FROM public.lancamentos_financeiros
     WHERE origem IN ('recebimento','recebimento_saldo') AND origem_id=OLD.id AND empresa_id = OLD.empresa_id;
    RETURN OLD;
  END IF;

  IF NEW.obra_id IS NOT NULL THEN
    SELECT empresa_id INTO v_obra_emp FROM public.obras WHERE id = NEW.obra_id;
    IF v_obra_emp IS NULL OR v_obra_emp IS DISTINCT FROM NEW.empresa_id THEN
      RAISE EXCEPTION 'Registro de outra empresa';
    END IF;
  END IF;

  SELECT id INTO v_cat FROM public.categorias_financeiras
   WHERE empresa_id=NEW.empresa_id AND grupo='receita_servico' ORDER BY nome LIMIT 1;
  IF v_cat IS NULL THEN
    SELECT id INTO v_cat FROM public.categorias_financeiras
     WHERE empresa_id=NEW.empresa_id AND tipo='receita' ORDER BY nome LIMIT 1;
  END IF;

  DELETE FROM public.lancamentos_financeiros
   WHERE origem='recebimento_saldo' AND origem_id=NEW.id AND empresa_id = NEW.empresa_id;
  v_saldo := GREATEST(COALESCE(NEW.valor,0) - COALESCE(NEW.valor_recebido,0), 0);

  IF v_saldo > 0 THEN
    INSERT INTO public.lancamentos_financeiros(
      empresa_id,obra_id,categoria_id,tipo,status,descricao,valor,
      data_competencia,data_vencimento,data_realizado,origem,origem_id,impacto_caixa
    ) VALUES (
      NEW.empresa_id,NEW.obra_id,v_cat,'receita','previsto',
      COALESCE(NEW.descricao,'Recebimento de obra'), v_saldo,
      COALESCE(NEW.data_prevista,CURRENT_DATE), NEW.data_prevista, NULL,'recebimento',NEW.id,true
    )
    ON CONFLICT (origem,origem_id) DO UPDATE SET
      obra_id=EXCLUDED.obra_id, categoria_id=EXCLUDED.categoria_id, status='previsto',
      descricao=EXCLUDED.descricao, valor=EXCLUDED.valor,
      data_competencia=EXCLUDED.data_competencia, data_vencimento=EXCLUDED.data_vencimento,
      data_realizado=NULL, impacto_caixa=true, updated_at=now();
  ELSE
    DELETE FROM public.lancamentos_financeiros
     WHERE origem='recebimento' AND origem_id=NEW.id AND empresa_id = NEW.empresa_id;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.fn_pagamento_to_lancamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rec public.recebimentos%ROWTYPE; v_cat uuid;
BEGIN
  PERFORM set_config('app.sync','on',true);
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lancamentos_financeiros
     WHERE origem='recebimento_pagamento' AND origem_id=OLD.id AND empresa_id = OLD.empresa_id;
    RETURN OLD;
  END IF;

  SELECT * INTO v_rec FROM public.recebimentos WHERE id = NEW.recebimento_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recebimento não encontrado'; END IF;
  IF v_rec.empresa_id IS DISTINCT FROM NEW.empresa_id THEN
    RAISE EXCEPTION 'Registro de outra empresa';
  END IF;

  SELECT id INTO v_cat FROM public.categorias_financeiras
   WHERE empresa_id=NEW.empresa_id AND grupo='receita_servico' ORDER BY nome LIMIT 1;
  IF v_cat IS NULL THEN
    SELECT id INTO v_cat FROM public.categorias_financeiras
     WHERE empresa_id=NEW.empresa_id AND tipo='receita' ORDER BY nome LIMIT 1;
  END IF;

  INSERT INTO public.lancamentos_financeiros(
    empresa_id,obra_id,categoria_id,tipo,status,descricao,valor,
    data_competencia,data_vencimento,data_realizado,forma_pagamento,origem,origem_id,impacto_caixa
  ) VALUES (
    NEW.empresa_id, v_rec.obra_id, v_cat,'receita','realizado',
    COALESCE(v_rec.descricao,'Recebimento de obra')||' — pagamento', NEW.valor,
    NEW.data, v_rec.data_prevista, NEW.data, NEW.forma_pagamento,'recebimento_pagamento',NEW.id,true
  )
  ON CONFLICT (origem,origem_id) DO UPDATE SET
    obra_id=EXCLUDED.obra_id, categoria_id=EXCLUDED.categoria_id, descricao=EXCLUDED.descricao,
    valor=EXCLUDED.valor, data_competencia=EXCLUDED.data_competencia,
    data_vencimento=EXCLUDED.data_vencimento, data_realizado=EXCLUDED.data_realizado,
    forma_pagamento=EXCLUDED.forma_pagamento, impacto_caixa=true, updated_at=now();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.fn_nf_to_recebimento_retencao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rec public.recebimentos%ROWTYPE;
  v_prazo integer := 30; v_cat uuid; v_ret numeric(14,2);
  v_found boolean := false; v_cnt integer; v_emp uuid;
BEGIN
  PERFORM set_config('app.sync', 'on', true);
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lancamentos_financeiros
     WHERE origem='retencao_nf' AND origem_id=OLD.id AND empresa_id = OLD.empresa_id;
    RETURN OLD;
  END IF;

  IF NEW.obra_id IS NOT NULL THEN
    SELECT empresa_id INTO v_emp FROM public.obras WHERE id = NEW.obra_id;
    IF v_emp IS NULL OR v_emp IS DISTINCT FROM NEW.empresa_id THEN
      RAISE EXCEPTION 'Registro de outra empresa';
    END IF;
  END IF;
  IF NEW.pedido_compra_id IS NOT NULL THEN
    SELECT empresa_id INTO v_emp FROM public.pedidos_compra WHERE id = NEW.pedido_compra_id;
    IF v_emp IS NULL OR v_emp IS DISTINCT FROM NEW.empresa_id THEN
      RAISE EXCEPTION 'Registro de outra empresa';
    END IF;
  END IF;

  v_ret := NEW.ret_inss + NEW.ret_iss + NEW.ret_irrf + NEW.ret_pcc;
  SELECT c.prazo_pagamento_dias INTO v_prazo
  FROM public.obras o LEFT JOIN public.clientes c ON c.id=o.cliente_id AND c.empresa_id = o.empresa_id
  WHERE o.id=NEW.obra_id AND o.empresa_id = NEW.empresa_id;
  v_prazo := COALESCE(v_prazo, 30);

  SELECT * INTO v_rec FROM public.recebimentos
   WHERE nota_fiscal_id=NEW.id AND empresa_id = NEW.empresa_id LIMIT 1;
  v_found := FOUND;

  IF NOT v_found AND NEW.pedido_compra_id IS NOT NULL THEN
    SELECT * INTO v_rec FROM public.recebimentos
    WHERE pedido_compra_id=NEW.pedido_compra_id AND nota_fiscal_id IS NULL
      AND empresa_id = NEW.empresa_id LIMIT 1;
    v_found := FOUND;
  END IF;

  IF NOT v_found AND NEW.pedido_compra_id IS NULL AND NEW.obra_id IS NOT NULL THEN
    SELECT count(*) INTO v_cnt FROM public.recebimentos r
    WHERE r.obra_id = NEW.obra_id AND r.empresa_id = NEW.empresa_id
      AND r.pedido_compra_id IS NOT NULL AND r.nota_fiscal_id IS NULL
      AND COALESCE(r.valor_recebido,0) = 0
      AND NOT EXISTS (SELECT 1 FROM public.recebimento_pagamentos p WHERE p.recebimento_id = r.id);
    IF v_cnt = 1 THEN
      SELECT * INTO v_rec FROM public.recebimentos r
      WHERE r.obra_id = NEW.obra_id AND r.empresa_id = NEW.empresa_id
        AND r.pedido_compra_id IS NOT NULL AND r.nota_fiscal_id IS NULL
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
    WHERE id=v_rec.id AND empresa_id = NEW.empresa_id;
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
    DELETE FROM public.lancamentos_financeiros
     WHERE origem='retencao_nf' AND origem_id=NEW.id AND empresa_id = NEW.empresa_id;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.sync_pedido_compra_recebimento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rec public.recebimentos%ROWTYPE; v_prazo integer; v_prevista date;
  v_empresa uuid; v_obra_emp uuid; v_tem_pag boolean;
BEGIN
  v_empresa := NEW.empresa_id;

  IF NEW.obra_id IS NOT NULL THEN
    SELECT empresa_id INTO v_obra_emp FROM public.obras WHERE id = NEW.obra_id;
    IF v_obra_emp IS NULL OR v_obra_emp IS DISTINCT FROM v_empresa THEN
      RAISE EXCEPTION 'Registro de outra empresa';
    END IF;
  END IF;

  SELECT * INTO v_rec FROM public.recebimentos
   WHERE pedido_compra_id = NEW.id AND empresa_id = v_empresa LIMIT 1;

  IF FOUND THEN
    v_tem_pag := EXISTS (SELECT 1 FROM public.recebimento_pagamentos p WHERE p.recebimento_id = v_rec.id)
                 OR COALESCE(v_rec.valor_recebido,0) > 0;
    IF v_rec.nota_fiscal_id IS NOT NULL OR v_tem_pag THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.obra_id IS NULL OR NEW.data_recebimento IS NULL OR COALESCE(NEW.valor, 0) <= 0 THEN
    DELETE FROM public.recebimentos
    WHERE pedido_compra_id = NEW.id AND empresa_id = v_empresa AND status = 'a_receber'
      AND nota_fiscal_id IS NULL AND COALESCE(valor_recebido,0) = 0;
    RETURN NEW;
  END IF;

  SELECT c.prazo_pagamento_dias INTO v_prazo
  FROM public.obras o LEFT JOIN public.clientes c ON c.id = o.cliente_id AND c.empresa_id = o.empresa_id
  WHERE o.id = NEW.obra_id AND o.empresa_id = v_empresa;

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
     WHERE id = v_rec.id AND empresa_id = v_empresa;
  END IF;
  RETURN NEW;
END $$;

-- 4) Funções SECURITY DEFINER com UPDATE: filtrar empresa
CREATE OR REPLACE FUNCTION public.pagar_fatura_cartao(_cartao_id uuid, _vencimento date, _data_pagamento date DEFAULT NULL::date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid; v_n integer;
BEGIN
  SELECT empresa_id INTO v_emp FROM public.cartoes_credito WHERE id = _cartao_id;
  IF v_emp IS NULL OR NOT public.tenant_can_write(v_emp) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  UPDATE public.cartao_despesas
     SET fatura_paga = true,
         fatura_paga_em = COALESCE(_data_pagamento, (now() AT TIME ZONE 'America/Sao_Paulo')::date)
   WHERE cartao_id = _cartao_id AND fatura_vencimento = _vencimento AND empresa_id = v_emp;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

CREATE OR REPLACE FUNCTION public.reabrir_fatura_cartao(_cartao_id uuid, _vencimento date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid; v_n integer;
BEGIN
  SELECT empresa_id INTO v_emp FROM public.cartoes_credito WHERE id = _cartao_id;
  IF v_emp IS NULL OR NOT public.tenant_can_write(v_emp) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  UPDATE public.cartao_despesas SET fatura_paga = false, fatura_paga_em = NULL
   WHERE cartao_id = _cartao_id AND fatura_vencimento = _vencimento AND empresa_id = v_emp;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

-- 5) Índice único global de obras.codigo_chamado
ALTER TABLE public.obras DROP CONSTRAINT IF EXISTS obras_codigo_chamado_key;
CREATE UNIQUE INDEX IF NOT EXISTS ux_obras_empresa_codigo_chamado
  ON public.obras (empresa_id, codigo_chamado);
