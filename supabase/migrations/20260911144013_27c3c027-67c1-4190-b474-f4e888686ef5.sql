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
  v_empresa    uuid;
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

  IF NEW.obra_id IS NULL OR NEW.data_recebimento IS NULL OR COALESCE(NEW.valor, 0) <= 0 THEN
    DELETE FROM public.recebimentos
    WHERE pedido_compra_id = NEW.id AND status = 'a_receber';
    RETURN NEW;
  END IF;

  SELECT c.prazo_pagamento_dias, o.empresa_id INTO v_prazo, v_empresa
  FROM public.obras o
  LEFT JOIN public.clientes c ON c.id = o.cliente_id
  WHERE o.id = NEW.obra_id;

  v_empresa := COALESCE(NEW.empresa_id, v_empresa);
  v_prevista := NEW.data_recebimento + COALESCE(v_prazo, 30);

  SELECT * INTO v_rec FROM public.recebimentos WHERE pedido_compra_id = NEW.id LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.recebimentos (
      empresa_id, obra_id, valor, data_prevista, data_recebido, status, pedido_compra_id, descricao
    ) VALUES (
      v_empresa,
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

  RETURN NEW;
END;
$function$;