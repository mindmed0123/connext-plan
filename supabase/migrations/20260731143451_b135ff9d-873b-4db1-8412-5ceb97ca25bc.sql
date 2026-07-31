DELETE FROM public.lancamentos_financeiros a
USING public.lancamentos_financeiros b
WHERE a.origem IS NOT NULL AND a.origem_id IS NOT NULL
  AND a.origem = b.origem AND a.origem_id = b.origem_id
  AND a.created_at < b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS ux_lanc_origem
  ON public.lancamentos_financeiros (origem, origem_id);

CREATE INDEX IF NOT EXISTS idx_lanc_competencia
  ON public.lancamentos_financeiros (empresa_id, data_competencia);