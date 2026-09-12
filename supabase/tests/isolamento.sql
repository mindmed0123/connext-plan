-- =====================================================================
-- Prova automatica de isolamento multiempresa (multi-tenant)
--
-- Cria duas empresas de teste (A e B) com um usuario cada, popula os
-- dados de negocio das duas e, autenticado como o usuario de A, verifica:
--   (a) leitura: nenhuma linha de B aparece;
--   (b) escrita com FK apontando para registros de B: tudo falha;
--   (c) RPCs chamadas com ids/empresa_id de B: falham ou voltam vazio;
--   (d) storage: arquivo de B nao pode ser lido nem gravado.
--
-- Ao final apaga as duas empresas de teste, imprime uma linha por caso
-- (PASSOU/FALHOU) e encerra com erro se algum caso falhar.
--
-- Como rodar (Postgres local do Supabase):
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -v ON_ERROR_STOP=1 -f supabase/tests/isolamento.sql
-- =====================================================================

\set ON_ERROR_STOP on
\timing off
\pset pager off

-- ---------------------------------------------------------------------
-- 0. Infra do teste
-- ---------------------------------------------------------------------
DROP SCHEMA IF EXISTS iso_test CASCADE;
CREATE SCHEMA iso_test;
GRANT USAGE ON SCHEMA iso_test TO authenticated;

CREATE TABLE iso_test.resultados (
  id serial primary key,
  grupo text not null,
  nome text not null,
  passou boolean not null,
  detalhe text
);
GRANT SELECT, INSERT ON iso_test.resultados TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE iso_test.resultados_id_seq TO authenticated;

CREATE TABLE iso_test.ctx (chave text primary key, valor uuid not null);
GRANT SELECT ON iso_test.ctx TO authenticated;

CREATE FUNCTION iso_test.v(_chave text) RETURNS uuid
LANGUAGE sql STABLE AS 'select valor from iso_test.ctx where chave = $1';
GRANT EXECUTE ON FUNCTION iso_test.v(text) TO authenticated;

-- registra um caso
CREATE FUNCTION iso_test.reg(_grupo text, _nome text, _passou boolean, _detalhe text default null)
RETURNS void LANGUAGE sql AS $fn$
  INSERT INTO iso_test.resultados(grupo, nome, passou, detalhe)
  VALUES (_grupo, _nome, _passou, left(coalesce(_detalhe,''), 200));
$fn$;
GRANT EXECUTE ON FUNCTION iso_test.reg(text, text, boolean, text) TO authenticated;

-- espera que o comando seja BLOQUEADO (erro ou zero linhas afetadas)
CREATE FUNCTION iso_test.expect_bloqueado(_grupo text, _nome text, _sql text)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE n bigint;
BEGIN
  BEGIN
    EXECUTE _sql;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN
      PERFORM iso_test.reg(_grupo, _nome, true, 'bloqueado (0 linhas)');
    ELSE
      PERFORM iso_test.reg(_grupo, _nome, false, 'VAZOU: ' || n || ' linha(s) afetada(s)');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM iso_test.reg(_grupo, _nome, true, 'bloqueado: ' || SQLERRM);
  END;
END $fn$;
GRANT EXECUTE ON FUNCTION iso_test.expect_bloqueado(text, text, text) TO authenticated;

-- espera que o SELECT falhe OU volte vazio (usado nas RPCs)
CREATE FUNCTION iso_test.expect_vazio_ou_erro(_grupo text, _nome text, _sql text)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE n bigint;
BEGIN
  BEGIN
    EXECUTE 'SELECT count(*) FROM (' || _sql || ') t' INTO n;
    IF n = 0 THEN
      PERFORM iso_test.reg(_grupo, _nome, true, 'vazio');
    ELSE
      PERFORM iso_test.reg(_grupo, _nome, false, 'VAZOU: ' || n || ' linha(s)');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM iso_test.reg(_grupo, _nome, true, 'bloqueado: ' || SQLERRM);
  END;
END $fn$;
GRANT EXECUTE ON FUNCTION iso_test.expect_vazio_ou_erro(text, text, text) TO authenticated;

-- leitura: nenhuma linha da empresa B e pelo menos uma da empresa A
CREATE FUNCTION iso_test.check_leitura(_tabela text)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE n_b bigint; n_a bigint; col text;
BEGIN
  -- a tabela empresas identifica o tenant pela propria chave primaria
  col := CASE WHEN _tabela = 'empresas' THEN 'id' ELSE 'empresa_id' END;
  BEGIN
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I = %L', _tabela, col, iso_test.v('empresa_b')) INTO n_b;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I = %L', _tabela, col, iso_test.v('empresa_a')) INTO n_a;
    IF n_b > 0 THEN
      PERFORM iso_test.reg('a) leitura', _tabela, false, 'VAZOU: ' || n_b || ' linha(s) da empresa B');
    ELSIF n_a = 0 THEN
      PERFORM iso_test.reg('a) leitura', _tabela, false, 'teste invalido: nenhuma linha da empresa A visivel');
    ELSE
      PERFORM iso_test.reg('a) leitura', _tabela, true, n_a || ' linha(s) de A, 0 de B');
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      PERFORM iso_test.reg('a) leitura', _tabela, true, 'sem acesso a tabela (permission denied)');
    WHEN OTHERS THEN
      PERFORM iso_test.reg('a) leitura', _tabela, false, 'erro inesperado: ' || SQLERRM);
  END;

END $fn$;
GRANT EXECUTE ON FUNCTION iso_test.check_leitura(text) TO authenticated;

-- ---------------------------------------------------------------------
-- 1. Massa de teste (executada como postgres, sem RLS)
-- ---------------------------------------------------------------------
BEGIN;

SET LOCAL session_replication_role = replica; -- nao dispara triggers no seed

INSERT INTO iso_test.ctx(chave, valor) VALUES
  ('empresa_a', gen_random_uuid()), ('empresa_b', gen_random_uuid()),
  ('user_a',    gen_random_uuid()), ('user_b',    gen_random_uuid()),
  ('obra_a',    gen_random_uuid()), ('obra_b',    gen_random_uuid()),
  ('orc_a',     gen_random_uuid()), ('orc_b',     gen_random_uuid()),
  ('pessoa_a',  gen_random_uuid()), ('pessoa_b',  gen_random_uuid()),
  ('cliente_a', gen_random_uuid()), ('cliente_b', gen_random_uuid()),
  ('contr_a',   gen_random_uuid()), ('contr_b',   gen_random_uuid()),
  ('cartao_a',  gen_random_uuid()), ('cartao_b',  gen_random_uuid()),
  ('rec_a',     gen_random_uuid()), ('rec_b',     gen_random_uuid());

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
SELECT iso_test.v('user_' || s), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'iso-' || s || '@teste-isolamento.local', 'x', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
FROM unnest(array['a','b']) s;

INSERT INTO public.empresas (id, nome, slug, ativo, saldo_inicial, data_saldo_inicial)
SELECT iso_test.v('empresa_' || s), 'ISO TESTE ' || upper(s), 'iso-teste-' || s, true, 0, current_date - 60
FROM unnest(array['a','b']) s;

INSERT INTO public.assinaturas (empresa_id, status, periodo, current_period_start, current_period_end)
SELECT iso_test.v('empresa_' || s), 'active', 'mensal', now() - interval '10 days', now() + interval '300 days'
FROM unnest(array['a','b']) s;

INSERT INTO public.user_roles (user_id, role, empresa_id)
SELECT iso_test.v('user_' || s), 'admin'::app_role, iso_test.v('empresa_' || s)
FROM unnest(array['a','b']) s;

INSERT INTO public.profiles (user_id, nome)
SELECT iso_test.v('user_' || s), 'ISO ' || upper(s) FROM unnest(array['a','b']) s;

INSERT INTO public.pessoas (id, empresa_id, tipo, nome, email)
SELECT iso_test.v('pessoa_' || s), iso_test.v('empresa_' || s), 'terceirizado', 'Terceiro ' || upper(s), 'p-' || s || '@iso.local'
FROM unnest(array['a','b']) s;

INSERT INTO public.clientes (id, empresa_id, cnpj, nome)
SELECT iso_test.v('cliente_' || s), iso_test.v('empresa_' || s), '0000000000000' || s, 'Cliente ' || upper(s)
FROM unnest(array['a','b']) s;

INSERT INTO public.obras (id, empresa_id, codigo_chamado, origem, data_recebimento, status, cliente_id,
                          contrato_valor_unitario, contrato_qtd_contratada)
SELECT iso_test.v('obra_' || s), iso_test.v('empresa_' || s), 'ISO-' || upper(s) || '-001', 'iso', current_date,
       'em_execucao', iso_test.v('cliente_' || s), 100000, 1
FROM unnest(array['a','b']) s;

INSERT INTO public.orcamentos (id, empresa_id, obra_id, valor_orcamento, valor_total, data_orcamento, status)
SELECT iso_test.v('orc_' || s), iso_test.v('empresa_' || s), iso_test.v('obra_' || s), 10000, 10000, current_date, 'em_elaboracao'
FROM unnest(array['a','b']) s;

INSERT INTO public.orcamento_itens (orcamento_id, empresa_id, descricao, unidade, quantidade, preco_unitario, ordem)
SELECT iso_test.v('orc_' || s), iso_test.v('empresa_' || s), 'Item ISO', 'un', 1, 10000, 1
FROM unnest(array['a','b']) s;

INSERT INTO public.contratacoes_terceirizado (id, empresa_id, obra_id, terceirizado_id, valor_total, quantidade_parcelas)
SELECT iso_test.v('contr_' || s), iso_test.v('empresa_' || s), iso_test.v('obra_' || s), iso_test.v('pessoa_' || s), 5000, 2
FROM unnest(array['a','b']) s;

INSERT INTO public.parcelas_pagamento (empresa_id, contratacao_id, numero_parcela, valor, data_prevista)
SELECT iso_test.v('empresa_' || s), iso_test.v('contr_' || s), 1, 2500, current_date
FROM unnest(array['a','b']) s;

INSERT INTO public.cartoes_credito (id, empresa_id, apelido, limite, dia_fechamento, dia_vencimento)
SELECT iso_test.v('cartao_' || s), iso_test.v('empresa_' || s), 'Cartao ' || upper(s), 10000, 1, 10
FROM unnest(array['a','b']) s;

INSERT INTO public.cartao_despesas (empresa_id, cartao_id, obra_id, descricao, valor, data_compra, parcelas,
                                    fatura_vencimento, fatura_paga)
SELECT iso_test.v('empresa_' || s), iso_test.v('cartao_' || s), iso_test.v('obra_' || s), 'Despesa ISO', 300,
       current_date, 1, date_trunc('month', current_date)::date + 9, false
FROM unnest(array['a','b']) s;

INSERT INTO public.notas_fiscais (empresa_id, obra_id, numero_nf, data_emissao, valor, valor_bruto)
SELECT iso_test.v('empresa_' || s), iso_test.v('obra_' || s), 'NF-ISO-' || upper(s), current_date, 10000, 10000
FROM unnest(array['a','b']) s;

INSERT INTO public.recebimentos (id, empresa_id, obra_id, valor, valor_recebido, data_prevista, status)
SELECT iso_test.v('rec_' || s), iso_test.v('empresa_' || s), iso_test.v('obra_' || s), 10000, 0, current_date, 'a_receber'
FROM unnest(array['a','b']) s;

INSERT INTO public.recebimento_pagamentos (empresa_id, recebimento_id, valor, data)
SELECT iso_test.v('empresa_' || s), iso_test.v('rec_' || s), 1000, current_date
FROM unnest(array['a','b']) s;

INSERT INTO public.lancamentos_financeiros (empresa_id, obra_id, tipo, status, descricao, valor, data_competencia)
SELECT iso_test.v('empresa_' || s), iso_test.v('obra_' || s), 'receita', 'realizado', 'Lancamento ISO', 1000, current_date
FROM unnest(array['a','b']) s;

INSERT INTO public.materiais_obra (empresa_id, obra_id, descricao, quantidade, valor_unitario, valor_total, data_compra)
SELECT iso_test.v('empresa_' || s), iso_test.v('obra_' || s), 'Material ISO', 1, 500, 500, current_date
FROM unnest(array['a','b']) s;

INSERT INTO public.compradores (empresa_id, nome, tipo_instituicao)
SELECT iso_test.v('empresa_' || s), 'Comprador ' || upper(s), 'construtora'
FROM unnest(array['a','b']) s;

-- storage: um arquivo de cada empresa no bucket privado
INSERT INTO storage.objects (bucket_id, name, owner)
SELECT 'obras-contratos', iso_test.v('empresa_' || s) || '/iso-' || s || '.pdf', iso_test.v('user_' || s)
FROM unnest(array['a','b']) s
WHERE EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'obras-contratos');

COMMIT;

-- ---------------------------------------------------------------------
-- 2. Testes autenticado como o usuario da empresa A
-- ---------------------------------------------------------------------
BEGIN;

SELECT set_config('request.jwt.claims',
       json_build_object('sub', iso_test.v('user_a')::text, 'role', 'authenticated',
                         'email', 'iso-a@teste-isolamento.local')::text, true);
SET LOCAL ROLE authenticated;

-- (a) LEITURA -----------------------------------------------------------
SELECT iso_test.check_leitura(t) FROM unnest(array[
  'empresas','obras','orcamentos','orcamento_itens','contratacoes_terceirizado','parcelas_pagamento',
  'cartoes_credito','cartao_despesas','notas_fiscais','recebimentos','recebimento_pagamentos',
  'lancamentos_financeiros','materiais_obra','pessoas','clientes','compradores','assinaturas','user_roles'
]) t;

-- (b) ESCRITA COM FK DE OUTRA EMPRESA ------------------------------------
SELECT iso_test.expect_bloqueado('b) escrita FK', 'insert orcamento com obra_id de B', format(
  $q$INSERT INTO public.orcamentos (empresa_id, obra_id, valor_orcamento, data_orcamento)
     VALUES (%L, %L, 1, current_date)$q$, iso_test.v('empresa_a'), iso_test.v('obra_b')));

SELECT iso_test.expect_bloqueado('b) escrita FK', 'insert orcamento_itens em orcamento de B', format(
  $q$INSERT INTO public.orcamento_itens (empresa_id, orcamento_id, descricao, unidade, quantidade, preco_unitario, ordem)
     VALUES (%L, %L, 'invasor', 'un', 1, 999, 99)$q$, iso_test.v('empresa_a'), iso_test.v('orc_b')));

SELECT iso_test.expect_bloqueado('b) escrita FK', 'insert parcela em contratacao de B', format(
  $q$INSERT INTO public.parcelas_pagamento (empresa_id, contratacao_id, numero_parcela, valor)
     VALUES (%L, %L, 99, 999)$q$, iso_test.v('empresa_a'), iso_test.v('contr_b')));

SELECT iso_test.expect_bloqueado('b) escrita FK', 'insert despesa em cartao de B', format(
  $q$INSERT INTO public.cartao_despesas (empresa_id, cartao_id, descricao, valor, data_compra, parcelas)
     VALUES (%L, %L, 'invasor', 999, current_date, 1)$q$, iso_test.v('empresa_a'), iso_test.v('cartao_b')));

SELECT iso_test.expect_bloqueado('b) escrita FK', 'insert contratacao com obra/pessoa de B', format(
  $q$INSERT INTO public.contratacoes_terceirizado (empresa_id, obra_id, terceirizado_id, valor_total, quantidade_parcelas)
     VALUES (%L, %L, %L, 999, 1)$q$, iso_test.v('empresa_a'), iso_test.v('obra_b'), iso_test.v('pessoa_b')));

SELECT iso_test.expect_bloqueado('b) escrita FK', 'insert obra com cliente_id de B', format(
  $q$INSERT INTO public.obras (empresa_id, codigo_chamado, origem, data_recebimento, cliente_id)
     VALUES (%L, 'ISO-INVASOR', 'iso', current_date, %L)$q$, iso_test.v('empresa_a'), iso_test.v('cliente_b')));

SELECT iso_test.expect_bloqueado('b) escrita FK', 'insert NF em obra de B', format(
  $q$INSERT INTO public.notas_fiscais (empresa_id, obra_id, numero_nf, data_emissao, valor, valor_bruto)
     VALUES (%L, %L, 'NF-INVASOR', current_date, 999, 999)$q$, iso_test.v('empresa_a'), iso_test.v('obra_b')));

SELECT iso_test.expect_bloqueado('b) escrita FK', 'insert pagamento em recebimento de B', format(
  $q$INSERT INTO public.recebimento_pagamentos (empresa_id, recebimento_id, valor, data)
     VALUES (%L, %L, 999, current_date)$q$, iso_test.v('empresa_a'), iso_test.v('rec_b')));

SELECT iso_test.expect_bloqueado('b) escrita FK', 'insert lancamento em obra de B', format(
  $q$INSERT INTO public.lancamentos_financeiros (empresa_id, obra_id, tipo, status, descricao, valor, data_competencia)
     VALUES (%L, %L, 'despesa', 'realizado', 'invasor', 999, current_date)$q$,
  iso_test.v('empresa_a'), iso_test.v('obra_b')));

SELECT iso_test.expect_bloqueado('b) escrita FK', 'insert com empresa_id de B', format(
  $q$INSERT INTO public.obras (empresa_id, codigo_chamado, origem, data_recebimento)
     VALUES (%L, 'ISO-INVASOR-2', 'iso', current_date)$q$, iso_test.v('empresa_b')));

SELECT iso_test.expect_bloqueado('b) escrita FK', 'update obra de B', format(
  $q$UPDATE public.obras SET descricao_servico = 'invadido' WHERE id = %L$q$, iso_test.v('obra_b')));

SELECT iso_test.expect_bloqueado('b) escrita FK', 'update orcamento de B', format(
  $q$UPDATE public.orcamentos SET valor_total = 1 WHERE id = %L$q$, iso_test.v('orc_b')));

SELECT iso_test.expect_bloqueado('b) escrita FK', 'update pessoa de B', format(
  $q$UPDATE public.pessoas SET nome = 'invadido' WHERE id = %L$q$, iso_test.v('pessoa_b')));

SELECT iso_test.expect_bloqueado('b) escrita FK', 'update cartao de B', format(
  $q$UPDATE public.cartoes_credito SET limite = 1 WHERE id = %L$q$, iso_test.v('cartao_b')));

SELECT iso_test.expect_bloqueado('b) escrita FK', 'update recebimento de B', format(
  $q$UPDATE public.recebimentos SET valor = 1 WHERE id = %L$q$, iso_test.v('rec_b')));

SELECT iso_test.expect_bloqueado('b) escrita FK', 'delete obra de B', format(
  $q$DELETE FROM public.obras WHERE id = %L$q$, iso_test.v('obra_b')));

SELECT iso_test.expect_bloqueado('b) escrita FK', 'delete lancamentos de B', format(
  $q$DELETE FROM public.lancamentos_financeiros WHERE empresa_id = %L$q$, iso_test.v('empresa_b')));

SELECT iso_test.expect_bloqueado('b) escrita FK', 'virar super_admin (user_roles)',
  $q$INSERT INTO public.user_roles (user_id, role, empresa_id)
     SELECT iso_test.v('user_a'), 'super_admin'::app_role, iso_test.v('empresa_a')$q$);

-- (c) RPCs COM IDS/EMPRESA DE B ------------------------------------------
SELECT iso_test.expect_vazio_ou_erro('c) rpc', 'get_dre_obra(obra de B)', format(
  $q$SELECT * FROM public.get_dre_obra(%L, %L)$q$, iso_test.v('empresa_b'), iso_test.v('obra_b')));

SELECT iso_test.expect_vazio_ou_erro('c) rpc', 'get_obra_financeiro_resumo(obra de B)', format(
  $q$SELECT * FROM public.get_obra_financeiro_resumo(%L) WHERE receita_faturada <> 0 OR custo_total <> 0$q$,
  iso_test.v('obra_b')));

-- os KPIs devem bater exatamente com o que a empresa A enxerga no proprio razao:
-- qualquer valor da empresa B somado faria a comparacao divergir.
SELECT iso_test.expect_vazio_ou_erro('c) rpc', 'get_financeiro_kpis (nao ve valores de B)',
  $q$SELECT * FROM public.get_financeiro_kpis(NULL, NULL) k
     WHERE k.receita_realizada <> COALESCE((SELECT SUM(lf.valor) FROM public.lancamentos_financeiros lf
            WHERE lf.tipo = 'receita' AND lf.status = 'realizado' AND lf.impacto_caixa), 0)
        OR k.despesa_realizada <> COALESCE((SELECT SUM(lf.valor) FROM public.lancamentos_financeiros lf
            WHERE lf.tipo = 'despesa' AND lf.status = 'realizado' AND lf.impacto_caixa), 0)$q$);

SELECT iso_test.expect_vazio_ou_erro('c) rpc', 'get_fluxo_caixa_mensal(empresa B)', format(
  $q$SELECT * FROM public.get_fluxo_caixa_mensal(%L, 6, 6)
     WHERE receitas_real <> 0 OR despesas_real <> 0 OR receitas_prev <> 0 OR despesas_prev <> 0$q$,
  iso_test.v('empresa_b')));

SELECT iso_test.expect_vazio_ou_erro('c) rpc', 'verificar_razao (nao ve obras de B)', format(
  $q$SELECT * FROM public.verificar_razao() WHERE obra_id = %L$q$, iso_test.v('obra_b')));

SELECT iso_test.expect_bloqueado('c) rpc', 'salvar_orcamento(empresa B)', format(
  $q$SELECT public.salvar_orcamento(jsonb_build_object('empresa_id', %L::text, 'obra_id', %L::text), '[]'::jsonb)$q$,
  iso_test.v('empresa_b'), iso_test.v('obra_b')));

SELECT iso_test.expect_bloqueado('c) rpc', 'aprovar_orcamento(orcamento de B)', format(
  $q$SELECT public.aprovar_orcamento(%L)$q$, iso_test.v('orc_b')));

SELECT iso_test.expect_bloqueado('c) rpc', 'confirmar_recebimento(recebimento de B)', format(
  $q$SELECT public.confirmar_recebimento(%L, 500, current_date)$q$, iso_test.v('rec_b')));

SELECT iso_test.expect_bloqueado('c) rpc', 'pagar_fatura_cartao(cartao de B)', format(
  $q$SELECT public.pagar_fatura_cartao(%L, (date_trunc('month', current_date)::date + 9), current_date)$q$,
  iso_test.v('cartao_b')));

SELECT iso_test.expect_bloqueado('c) rpc', 'reabrir_fatura_cartao(cartao de B)', format(
  $q$SELECT public.reabrir_fatura_cartao(%L, (date_trunc('month', current_date)::date + 9))$q$,
  iso_test.v('cartao_b')));

SELECT iso_test.expect_bloqueado('c) rpc', 'seed_categorias_financeiras(empresa B)', format(
  $q$SELECT public.seed_categorias_financeiras(%L)$q$, iso_test.v('empresa_b')));

-- (a verificacao de que a fatura de B continua em aberto roda apos RESET ROLE)


-- (d) STORAGE -------------------------------------------------------------
SELECT iso_test.expect_vazio_ou_erro('d) storage', 'listar/baixar arquivo de B', format(
  $q$SELECT id FROM storage.objects WHERE bucket_id = 'obras-contratos' AND name LIKE %L$q$,
  iso_test.v('empresa_b')::text || '/%'));

SELECT iso_test.expect_bloqueado('d) storage', 'gravar arquivo na pasta de B', format(
  $q$INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('obras-contratos', %L, %L)$q$,
  iso_test.v('empresa_b')::text || '/invasor.pdf', iso_test.v('user_a')));

SELECT iso_test.expect_bloqueado('d) storage', 'apagar arquivo de B', format(
  $q$DELETE FROM storage.objects WHERE bucket_id = 'obras-contratos' AND name LIKE %L$q$,
  iso_test.v('empresa_b')::text || '/%'));

RESET ROLE;

-- confirma que nenhuma RPC de B foi executada de fato (fatura de B segue em aberto)
DO $chk$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.cartao_despesas
   WHERE empresa_id = iso_test.v('empresa_b') AND fatura_paga;
  PERFORM iso_test.reg('c) rpc', 'fatura de B continua em aberto', n = 0, 'faturas pagas: ' || n);
END $chk$;

COMMIT;


-- ---------------------------------------------------------------------
-- 3. Limpeza: apaga as duas empresas de teste
-- ---------------------------------------------------------------------
BEGIN;
SET LOCAL session_replication_role = replica;  -- ignora triggers de bloqueio e FKs

DO $cleanup$
DECLARE r record; a uuid := iso_test.v('empresa_a'); b uuid := iso_test.v('empresa_b');
BEGIN
  FOR r IN
    SELECT c.table_name FROM information_schema.columns c
     JOIN information_schema.tables t
       ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
     WHERE c.table_schema = 'public' AND c.column_name = 'empresa_id'
  LOOP
    EXECUTE format('DELETE FROM public.%I WHERE empresa_id IN (%L, %L)', r.table_name, a, b);
  END LOOP;

  DELETE FROM storage.objects WHERE name LIKE a::text || '/%' OR name LIKE b::text || '/%';
  DELETE FROM public.user_roles WHERE user_id IN (iso_test.v('user_a'), iso_test.v('user_b'));
  DELETE FROM public.profiles  WHERE user_id IN (iso_test.v('user_a'), iso_test.v('user_b'));
  DELETE FROM public.empresas  WHERE id IN (a, b);
  DELETE FROM auth.users       WHERE id IN (iso_test.v('user_a'), iso_test.v('user_b'));
END $cleanup$;

DO $chk$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.empresas WHERE id IN (iso_test.v('empresa_a'), iso_test.v('empresa_b'));
  PERFORM iso_test.reg('e) limpeza', 'empresas de teste removidas', n = 0, 'restaram: ' || n);
END $chk$;

COMMIT;

-- ---------------------------------------------------------------------
-- 4. Relatorio
-- ---------------------------------------------------------------------
SELECT grupo,
       nome AS caso,
       CASE WHEN passou THEN 'PASSOU' ELSE 'FALHOU' END AS resultado,
       detalhe
  FROM iso_test.resultados
 ORDER BY id;

DO $final$
DECLARE n_fail bigint; n_tot bigint;
BEGIN
  SELECT count(*) FILTER (WHERE NOT passou), count(*) INTO n_fail, n_tot FROM iso_test.resultados;
  RAISE NOTICE 'Isolamento multiempresa: % de % casos passaram', n_tot - n_fail, n_tot;
  IF n_tot = 0 THEN RAISE EXCEPTION 'Nenhum caso executado'; END IF;
  IF n_fail > 0 THEN RAISE EXCEPTION '% caso(s) de isolamento FALHARAM', n_fail; END IF;
END $final$;

DROP SCHEMA iso_test CASCADE;
