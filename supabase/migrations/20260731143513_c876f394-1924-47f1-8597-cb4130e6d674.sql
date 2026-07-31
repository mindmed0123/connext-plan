CREATE OR REPLACE FUNCTION public.fn_recebimento_to_lancamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cat uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lancamentos_financeiros
      WHERE origem = 'recebimento' AND origem_id = OLD.id;
    RETURN OLD;
  END IF;

  SELECT id INTO v_cat FROM public.categorias_financeiras
    WHERE empresa_id = NEW.empresa_id AND tipo = 'receita'
    ORDER BY nome LIMIT 1;

  INSERT INTO public.lancamentos_financeiros (
    empresa_id, obra_id, categoria_id, tipo, status, descricao, valor,
    data_competencia, data_vencimento, data_realizado, origem, origem_id
  ) VALUES (
    NEW.empresa_id, NEW.obra_id, v_cat, 'receita',
    CASE WHEN NEW.status = 'recebido' THEN 'realizado' ELSE 'previsto' END,
    COALESCE(NEW.descricao, 'Recebimento de obra'),
    NEW.valor,
    COALESCE(NEW.data_recebido, NEW.data_prevista, CURRENT_DATE),
    NEW.data_prevista,
    NEW.data_recebido,
    'recebimento', NEW.id
  )
  ON CONFLICT (origem, origem_id) DO UPDATE SET
    obra_id          = EXCLUDED.obra_id,
    status           = EXCLUDED.status,
    descricao        = EXCLUDED.descricao,
    valor            = EXCLUDED.valor,
    data_competencia = EXCLUDED.data_competencia,
    data_vencimento  = EXCLUDED.data_vencimento,
    data_realizado   = EXCLUDED.data_realizado,
    updated_at       = now();

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_receb_to_lanc ON public.recebimentos;
CREATE TRIGGER trg_receb_to_lanc
  AFTER INSERT OR UPDATE OR DELETE ON public.recebimentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_recebimento_to_lancamento();