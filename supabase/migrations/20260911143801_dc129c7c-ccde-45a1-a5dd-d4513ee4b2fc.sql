-- 1) Cliente da obra
ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_obras_cliente_id ON public.obras(cliente_id);

-- backfill a partir de contratos_clientes
UPDATE public.obras o
SET cliente_id = cc.cliente_id
FROM public.contratos_clientes cc
WHERE cc.obra_id = o.id
  AND cc.cliente_id IS NOT NULL
  AND o.cliente_id IS NULL;

-- backfill a partir do orçamento aprovado (match por CNPJ)
UPDATE public.obras o
SET cliente_id = c.id
FROM public.orcamentos orc
JOIN public.clientes c
  ON c.empresa_id = orc.empresa_id
 AND regexp_replace(coalesce(c.cnpj,''), '\D', '', 'g') = regexp_replace(coalesce(orc.cliente_cnpj,''), '\D', '', 'g')
 AND regexp_replace(coalesce(orc.cliente_cnpj,''), '\D', '', 'g') <> ''
WHERE orc.obra_id = o.id
  AND orc.status = 'aprovado'
  AND o.cliente_id IS NULL;

-- 2) FK do recebimento com o pedido de compra
ALTER TABLE public.recebimentos
  DROP CONSTRAINT IF EXISTS recebimentos_pedido_compra_id_fkey;

ALTER TABLE public.recebimentos
  ADD CONSTRAINT recebimentos_pedido_compra_id_fkey
  FOREIGN KEY (pedido_compra_id) REFERENCES public.pedidos_compra(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recebimentos_pedido_compra_id ON public.recebimentos(pedido_compra_id);

-- 3) Novo comportamento do trigger
CREATE OR REPLACE FUNCTION public.sync_pedido_compra_recebimento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rec        public.recebimentos%ROWTYPE;
  v_prazo      integer;
  v_prevista   date;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT * INTO v_rec FROM public.recebimentos WHERE pedido_compra_id = OLD.id LIMIT 1;
    IF FOUND THEN
      IF v_rec.status = 'recebido' THEN
        RAISE EXCEPTION 'Este pedido já tem recebimento confirmado. Estorne o recebimento antes.';
      END IF;
      DELETE FROM public.recebimentos WHERE id = v_rec.id;
    END IF;
    RETURN OLD;
  END IF;

  -- Sem obra / data / valor: nada a sincronizar (só remove se ainda estiver a receber)
  IF NEW.obra_id IS NULL OR NEW.data_recebimento IS NULL OR COALESCE(NEW.valor, 0) <= 0 THEN
    DELETE FROM public.recebimentos
    WHERE pedido_compra_id = NEW.id AND status = 'a_receber';
    RETURN NEW;
  END IF;

  -- prazo de pagamento do cliente da obra (30 dias quando não houver)
  SELECT c.prazo_pagamento_dias INTO v_prazo
  FROM public.obras o
  LEFT JOIN public.clientes c ON c.id = o.cliente_id
  WHERE o.id = NEW.obra_id;

  v_prevista := NEW.data_recebimento + COALESCE(v_prazo, 30);

  SELECT * INTO v_rec FROM public.recebimentos WHERE pedido_compra_id = NEW.id LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.recebimentos (
      obra_id, valor, data_prevista, data_recebido, status, pedido_compra_id, descricao
    ) VALUES (
      NEW.obra_id,
      NEW.valor,
      v_prevista,
      NULL,
      'a_receber'::recebimento_status,
      NEW.id,
      'PC ' || COALESCE(NEW.numero_pedido, '')
    );
  ELSIF v_rec.status = 'a_receber' THEN
    UPDATE public.recebimentos
       SET obra_id       = NEW.obra_id,
           valor         = NEW.valor,
           data_prevista = v_prevista,
           updated_at    = now()
     WHERE id = v_rec.id;
  END IF;
  -- status 'recebido': não altera nada

  RETURN NEW;
END;
$function$;