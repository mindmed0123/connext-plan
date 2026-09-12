-- 1) Corrige tautologias do tipo "x.empresa_id = x.empresa_id" em TODAS as policies
DO $do$
DECLARE
  p record;
  novo_qual text;
  novo_check text;
  pat text := '\(([a-z_]+)\.empresa_id = \1\.empresa_id\)';
  n int := 0;
BEGIN
  FOR p IN
    SELECT c.relname AS tabela, pol.polname, pol.polcmd,
           pg_get_expr(pol.polqual, pol.polrelid) AS qual,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS wcheck
      FROM pg_policy pol
      JOIN pg_class c ON c.oid = pol.polrelid
      JOIN pg_namespace ns ON ns.oid = c.relnamespace
     WHERE ns.nspname = 'public'
       AND (coalesce(pg_get_expr(pol.polqual, pol.polrelid),'') ~ pat
         OR coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid),'') ~ pat)
  LOOP
    novo_qual  := regexp_replace(p.qual,   pat, '(\1.empresa_id = ' || quote_ident(p.tabela) || '.empresa_id)', 'g');
    novo_check := regexp_replace(p.wcheck, pat, '(\1.empresa_id = ' || quote_ident(p.tabela) || '.empresa_id)', 'g');

    IF p.polcmd = 'a' THEN
      EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)', p.polname, p.tabela, novo_check);
    ELSIF novo_qual IS NOT NULL AND novo_check IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)', p.polname, p.tabela, novo_qual, novo_check);
    ELSIF novo_qual IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)', p.polname, p.tabela, novo_qual);
    END IF;
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'policies corrigidas (tautologia): %', n;
END $do$;

-- 2) Endurecimento de FK: exige mesma empresa nas 5 colunas que faltavam
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
      ('lancamentos_financeiros','conta_bancaria_id','contas_bancarias'),
      ('notas_fiscais','medicao_id','medicoes'),
      ('parcelas_pagamento','conta_bancaria_id','contas_bancarias'),
      ('recebimento_pagamentos','conta_bancaria_id','contas_bancarias'),
      ('extrato_bancario','lancamento_id','lancamentos_financeiros')
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