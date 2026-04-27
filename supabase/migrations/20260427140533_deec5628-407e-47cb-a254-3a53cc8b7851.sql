-- Adiciona referência opcional do recebimento ao pedido de compra de origem
ALTER TABLE public.recebimentos
  ADD COLUMN IF NOT EXISTS pedido_compra_id uuid;

CREATE INDEX IF NOT EXISTS idx_recebimentos_pedido_compra_id
  ON public.recebimentos(pedido_compra_id);

-- Função que sincroniza pedido_compra -> recebimento
CREATE OR REPLACE FUNCTION public.sync_pedido_compra_recebimento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_id uuid;
BEGIN
  -- DELETE: remove o recebimento associado
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.recebimentos WHERE pedido_compra_id = OLD.id;
    RETURN OLD;
  END IF;

  -- INSERT/UPDATE
  -- Só cria/atualiza se houver obra vinculada, data de recebimento e valor > 0
  IF NEW.obra_id IS NOT NULL AND NEW.data_recebimento IS NOT NULL AND COALESCE(NEW.valor, 0) > 0 THEN
    SELECT id INTO v_existing_id FROM public.recebimentos WHERE pedido_compra_id = NEW.id LIMIT 1;

    IF v_existing_id IS NULL THEN
      INSERT INTO public.recebimentos (obra_id, valor, data_prevista, data_recebido, status, pedido_compra_id)
      VALUES (
        NEW.obra_id,
        NEW.valor,
        NEW.data_recebimento,
        CASE WHEN NEW.status = 'recebido' THEN NEW.data_recebimento ELSE NULL END,
        CASE WHEN NEW.status = 'recebido' THEN 'recebido'::recebimento_status ELSE 'a_receber'::recebimento_status END,
        NEW.id
      );
    ELSE
      UPDATE public.recebimentos
        SET obra_id = NEW.obra_id,
            valor = NEW.valor,
            data_prevista = NEW.data_recebimento,
            data_recebido = CASE WHEN NEW.status = 'recebido' THEN NEW.data_recebimento ELSE NULL END,
            status = CASE WHEN NEW.status = 'recebido' THEN 'recebido'::recebimento_status ELSE 'a_receber'::recebimento_status END,
            updated_at = now()
        WHERE id = v_existing_id;
    END IF;
  ELSE
    -- Se as condições não são mais satisfeitas, remove o recebimento sincronizado
    DELETE FROM public.recebimentos WHERE pedido_compra_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_pedido_compra_recebimento_iud ON public.pedidos_compra;
CREATE TRIGGER trg_sync_pedido_compra_recebimento_iud
AFTER INSERT OR UPDATE OR DELETE ON public.pedidos_compra
FOR EACH ROW
EXECUTE FUNCTION public.sync_pedido_compra_recebimento();

-- Backfill: cria recebimentos para PCs já existentes que tenham data + valor + obra
INSERT INTO public.recebimentos (obra_id, valor, data_prevista, data_recebido, status, pedido_compra_id)
SELECT
  pc.obra_id,
  pc.valor,
  pc.data_recebimento,
  CASE WHEN pc.status = 'recebido' THEN pc.data_recebimento ELSE NULL END,
  CASE WHEN pc.status = 'recebido' THEN 'recebido'::recebimento_status ELSE 'a_receber'::recebimento_status END,
  pc.id
FROM public.pedidos_compra pc
WHERE pc.obra_id IS NOT NULL
  AND pc.data_recebimento IS NOT NULL
  AND COALESCE(pc.valor, 0) > 0
  AND NOT EXISTS (SELECT 1 FROM public.recebimentos r WHERE r.pedido_compra_id = pc.id);