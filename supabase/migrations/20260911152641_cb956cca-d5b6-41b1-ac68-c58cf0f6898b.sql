DO $$
DECLARE nf public.notas_fiscais%ROWTYPE;
DECLARE rec public.recebimentos%ROWTYPE;
DECLARE prazo integer;
BEGIN
  FOR nf IN SELECT * FROM public.notas_fiscais WHERE NOT EXISTS (
    SELECT 1 FROM public.recebimentos r WHERE r.nota_fiscal_id=nf.id
  ) LOOP
    SELECT * INTO rec FROM public.recebimentos
    WHERE pedido_compra_id=nf.pedido_compra_id AND nf.pedido_compra_id IS NOT NULL AND nota_fiscal_id IS NULL
    LIMIT 1;
    IF FOUND THEN
      UPDATE public.recebimentos SET nota_fiscal_id=nf.id, valor=nf.valor_liquido,
        descricao='NF '||nf.numero_nf, updated_at=now() WHERE id=rec.id;
    ELSE
      SELECT COALESCE(c.prazo_pagamento_dias,30) INTO prazo
      FROM public.obras o LEFT JOIN public.clientes c ON c.id=o.cliente_id WHERE o.id=nf.obra_id;
      INSERT INTO public.recebimentos(empresa_id,obra_id,pedido_compra_id,nota_fiscal_id,valor,valor_recebido,data_prevista,status,descricao)
      VALUES(nf.empresa_id,nf.obra_id,nf.pedido_compra_id,nf.id,nf.valor_liquido,0,nf.data_emissao+COALESCE(prazo,30),'a_receber','NF '||nf.numero_nf);
    END IF;
  END LOOP;
END $$;