CREATE OR REPLACE FUNCTION public.fn_parcela_to_lancamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cat uuid;
  v_empresa uuid;
  v_obra uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lancamentos_financeiros
      WHERE origem = 'parcela_pagamento' AND origem_id = OLD.id;
    RETURN OLD;
  END IF;

  SELECT ct.empresa_id, ct.obra_id INTO v_empresa, v_obra
    FROM public.contratacoes_terceirizado ct
   WHERE ct.id = NEW.contratacao_id;

  v_empresa := COALESCE(v_empresa, NEW.empresa_id);

  SELECT id INTO v_cat FROM public.categorias_financeiras
    WHERE empresa_id = v_empresa AND grupo = 'custo_subcontratado'
    ORDER BY nome LIMIT 1;

  IF v_cat IS NULL THEN
    SELECT id INTO v_cat FROM public.categorias_financeiras
      WHERE empresa_id = v_empresa AND tipo = 'despesa'
      ORDER BY nome LIMIT 1;
  END IF;

  INSERT INTO public.lancamentos_financeiros (
    empresa_id, obra_id, categoria_id, tipo, status, descricao, valor,
    data_competencia, data_vencimento, data_realizado, forma_pagamento, origem, origem_id
  ) VALUES (
    v_empresa, v_obra, v_cat, 'despesa',
    CASE WHEN NEW.status = 'pago' THEN 'realizado' ELSE 'previsto' END,
    'Parcela ' || NEW.numero_parcela || ' - contratação',
    NEW.valor,
    COALESCE(NEW.data_pagamento, NEW.data_prevista, CURRENT_DATE),
    NEW.data_prevista,
    NEW.data_pagamento,
    NEW.forma_pagamento,
    'parcela_pagamento', NEW.id
  )
  ON CONFLICT (origem, origem_id) DO UPDATE SET
    empresa_id       = EXCLUDED.empresa_id,
    obra_id          = EXCLUDED.obra_id,
    categoria_id     = EXCLUDED.categoria_id,
    status           = EXCLUDED.status,
    descricao        = EXCLUDED.descricao,
    valor            = EXCLUDED.valor,
    data_competencia = EXCLUDED.data_competencia,
    data_vencimento  = EXCLUDED.data_vencimento,
    data_realizado   = EXCLUDED.data_realizado,
    forma_pagamento  = EXCLUDED.forma_pagamento,
    updated_at       = now();

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_parcela_to_lanc ON public.parcelas_pagamento;
CREATE TRIGGER trg_parcela_to_lanc
  AFTER INSERT OR UPDATE OR DELETE ON public.parcelas_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.fn_parcela_to_lancamento();