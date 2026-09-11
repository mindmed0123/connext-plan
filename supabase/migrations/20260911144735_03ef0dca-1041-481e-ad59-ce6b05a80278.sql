-- 1) dinheiro com escala fixa
ALTER TABLE public.cartao_despesas ALTER COLUMN valor TYPE numeric(14,2);
ALTER TABLE public.cartoes_credito ALTER COLUMN limite TYPE numeric(14,2);
ALTER TABLE public.comprador_contratos ALTER COLUMN valor TYPE numeric(14,2);
ALTER TABLE public.execucoes ALTER COLUMN valor_terceirizado TYPE numeric(14,2);
ALTER TABLE public.materiais_obra ALTER COLUMN valor_total TYPE numeric(14,2);
ALTER TABLE public.materiais_obra ALTER COLUMN valor_unitario TYPE numeric(14,2);
ALTER TABLE public.obra_adendos ALTER COLUMN valor_total TYPE numeric(14,2);
ALTER TABLE public.obra_adendos ALTER COLUMN valor_unitario TYPE numeric(14,2);

-- 2) valores nao negativos
ALTER TABLE public.lancamentos_financeiros ADD CONSTRAINT chk_lanc_valor_nao_negativo CHECK (valor >= 0);
ALTER TABLE public.recebimentos ADD CONSTRAINT chk_receb_valor_nao_negativo CHECK (valor >= 0);
ALTER TABLE public.notas_fiscais ADD CONSTRAINT chk_nf_valor_nao_negativo CHECK (valor >= 0);
ALTER TABLE public.pedidos_compra ADD CONSTRAINT chk_pc_valor_nao_negativo CHECK (valor >= 0);
ALTER TABLE public.parcelas_pagamento ADD CONSTRAINT chk_parcela_valor_nao_negativo CHECK (valor >= 0);
ALTER TABLE public.materiais_obra ADD CONSTRAINT chk_material_valores_nao_negativos CHECK (valor_total >= 0 AND valor_unitario >= 0 AND quantidade >= 0);
ALTER TABLE public.cartao_despesas ADD CONSTRAINT chk_cartao_desp_valor_nao_negativo CHECK (valor >= 0);

-- 3) regras de dominio
ALTER TABLE public.cartao_despesas ADD CONSTRAINT chk_cartao_desp_parcelas CHECK (parcelas >= 1);
ALTER TABLE public.cartoes_credito ADD CONSTRAINT chk_cartao_dias CHECK (
  (dia_fechamento IS NULL OR (dia_fechamento BETWEEN 1 AND 31))
  AND (dia_vencimento IS NULL OR (dia_vencimento BETWEEN 1 AND 31))
);
ALTER TABLE public.orcamentos ADD CONSTRAINT chk_orc_desconto_global_pct CHECK (desconto_global_pct BETWEEN 0 AND 100);
ALTER TABLE public.orcamento_itens ADD CONSTRAINT chk_orc_item_desconto_pct CHECK (desconto_pct BETWEEN 0 AND 100);

-- 4) chaves estrangeiras faltantes
ALTER TABLE public.cartao_despesas
  ADD CONSTRAINT cartao_despesas_categoria_id_fkey
  FOREIGN KEY (categoria_id) REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL;
ALTER TABLE public.cartoes_credito
  ADD CONSTRAINT cartoes_credito_empresa_id_fkey
  FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.compradores
  ADD CONSTRAINT compradores_empresa_id_fkey
  FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;