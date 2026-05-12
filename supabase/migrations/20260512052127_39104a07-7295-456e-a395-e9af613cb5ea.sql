-- Permite criar obras automaticamente a partir de orçamentos (campos opcionais)
ALTER TABLE public.obras ALTER COLUMN engenheiro_responsavel DROP NOT NULL;
ALTER TABLE public.obras ALTER COLUMN regiao DROP NOT NULL;
ALTER TABLE public.obras ALTER COLUMN descricao_servico DROP NOT NULL;
ALTER TABLE public.obras ALTER COLUMN endereco DROP NOT NULL;

-- Índice único por empresa + código do chamado para upsert
CREATE UNIQUE INDEX IF NOT EXISTS obras_empresa_chamado_uk
  ON public.obras (empresa_id, codigo_chamado);