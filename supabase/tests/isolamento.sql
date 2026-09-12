-- =====================================================================
-- Prova automatica de isolamento multiempresa (multi-tenant)
--
-- Os casos NAO sao uma lista fixa: sao gerados por introspeccao do
-- catalogo do Postgres. Cria duas empresas de teste (A e B), popula as
-- duas (massa manual das tabelas centrais + massa generica para todas
-- as demais tabelas com empresa_id) e, autenticado como o usuario de A:
--
--   (a) leitura   : para TODA tabela public com empresa_id, nenhuma
--                   linha da empresa B pode aparecer;
--   (b) escrita   : insert com empresa_id de B, update e delete de
--                   linhas de B precisam ser bloqueados;
--   (c) FK cruzada: para TODA chave estrangeira que aponta para outra
--                   tabela com empresa_id, insert com empresa_id de A
--                   e a FK apontando para um registro de B;
--   (d) RPC       : TODA funcao do schema public e chamada com ids da
--                   empresa B; falha se a resposta contiver dado de B;
--   (e) storage   : arquivo de B nao pode ser lido, gravado nem apagado.
--
-- Cada chamada de RPC roda em subtransacao que SEMPRE e desfeita.
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

-- registro da massa gerada: qual id existe em qual tabela/empresa
CREATE TABLE iso_test.seeded (tabela text not null, empresa uuid not null, id uuid not null);
GRANT SELECT ON iso_test.seeded TO authenticated;

CREATE FUNCTION iso_test.v(_chave text) RETURNS uuid
LANGUAGE sql STABLE AS 'select valor from iso_test.ctx where chave = $1';
GRANT EXECUTE ON FUNCTION iso_test.v(text) TO authenticated;

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

-- leitura: nenhuma linha da empresa B
CREATE FUNCTION iso_test.check_leitura(_tabela text)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE n_b bigint; n_a bigint; col text; existe_b bigint;
BEGIN
  col := CASE WHEN _tabela = 'empresas' THEN 'id' ELSE 'empresa_id' END;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE %I = %L', _tabela, col, iso_test.v('empresa_b')) INTO n_b;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE %I = %L', _tabela, col, iso_test.v('empresa_a')) INTO n_a;
  SELECT count(*) INTO existe_b FROM iso_test.seeded WHERE tabela = _tabela AND empresa = iso_test.v('empresa_b');
  IF n_b > 0 THEN
    PERFORM iso_test.reg('a) leitura', _tabela, false, 'VAZOU: ' || n_b || ' linha(s) da empresa B');
  ELSE
    PERFORM iso_test.reg('a) leitura', _tabela, true,
      n_a || ' linha(s) de A, 0 de B' || CASE WHEN existe_b = 0 THEN ' (sem massa de B)' ELSE '' END);
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    PERFORM iso_test.reg('a) leitura', _tabela, true, 'sem acesso a tabela (permission denied)');
  WHEN OTHERS THEN
    PERFORM iso_test.reg('a) leitura', _tabela, false, 'erro inesperado: ' || SQLERRM);
END $fn$;
GRANT EXECUTE ON FUNCTION iso_test.check_leitura(text) TO authenticated;

-- ---------------------------------------------------------------------
-- 0.1 Catalogo: tabelas com empresa_id e FKs entre tabelas de negocio
-- ---------------------------------------------------------------------
CREATE VIEW iso_test.tabelas AS
SELECT c.relname::text AS tabela
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind = 'r'
   AND EXISTS (SELECT 1 FROM pg_attribute a
                WHERE a.attrelid = c.oid AND a.attname = 'empresa_id' AND a.attnum > 0 AND NOT a.attisdropped);
GRANT SELECT ON iso_test.tabelas TO authenticated;

-- FKs de coluna unica; guarda tambem o schema/coluna do pai
CREATE VIEW iso_test.fks AS
SELECT c.relname::text  AS tabela,
       a.attname::text  AS coluna,
       pn.nspname::text AS pai_schema,
       p.relname::text  AS pai,
       pa.attname::text AS pai_coluna,
       EXISTS (SELECT 1 FROM pg_attribute x
                WHERE x.attrelid = p.oid AND x.attname = 'empresa_id' AND x.attnum > 0 AND NOT x.attisdropped) AS pai_tem_empresa
  FROM pg_constraint k
  JOIN pg_class c      ON c.oid = k.conrelid
  JOIN pg_namespace n  ON n.oid = c.relnamespace
  JOIN pg_class p      ON p.oid = k.confrelid
  JOIN pg_namespace pn ON pn.oid = p.relnamespace
  JOIN pg_attribute a  ON a.attrelid = c.oid  AND a.attnum = k.conkey[1]
  JOIN pg_attribute pa ON pa.attrelid = p.oid AND pa.attnum = k.confkey[1]
 WHERE k.contype = 'f' AND n.nspname = 'public'
   AND array_length(k.conkey, 1) = 1;
GRANT SELECT ON iso_test.fks TO authenticated;

-- expressao SQL de valor para uma coluna (NULL = tipo desconhecido)
CREATE FUNCTION iso_test.val(_tabela text, _coluna text, _empresa uuid)
RETURNS text LANGUAGE plpgsql STABLE AS $fn$
DECLARE fk record; tipo text; udt text; rotulo text;
BEGIN
  IF _coluna = 'empresa_id' THEN RETURN quote_literal(_empresa) || '::uuid'; END IF;

  SELECT * INTO fk FROM iso_test.fks f
   WHERE f.tabela = _tabela AND f.coluna = _coluna LIMIT 1;

  IF FOUND THEN
    IF fk.pai_schema = 'auth' AND fk.pai = 'users' THEN
      RETURN format('(SELECT valor FROM iso_test.ctx WHERE chave = %L)',
                    CASE WHEN _empresa = iso_test.v('empresa_a') THEN 'user_a' ELSE 'user_b' END);
    ELSIF fk.pai_tem_empresa THEN
      RETURN format('(SELECT p.%I FROM %I.%I p WHERE p.empresa_id = %L ORDER BY p.%I LIMIT 1)',
                    fk.pai_coluna, fk.pai_schema, fk.pai, _empresa, fk.pai_coluna);
    ELSE
      RETURN format('(SELECT p.%I FROM %I.%I p ORDER BY p.%I LIMIT 1)',
                    fk.pai_coluna, fk.pai_schema, fk.pai, fk.pai_coluna);
    END IF;
  END IF;

  IF _coluna = 'id' THEN RETURN 'gen_random_uuid()'; END IF;

  SELECT data_type, udt_name INTO tipo, udt
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = _tabela AND column_name = _coluna;

  IF tipo IS NULL THEN RETURN NULL; END IF;

  RETURN CASE
    WHEN tipo IN ('text','character varying','character') THEN quote_literal('ISO-' || left(md5(random()::text), 8))
    WHEN tipo = 'uuid' THEN 'gen_random_uuid()'
    WHEN tipo IN ('integer','bigint','smallint','numeric','double precision','real') THEN '1'
    WHEN tipo = 'boolean' THEN 'false'
    WHEN tipo = 'date' THEN 'current_date'
    WHEN tipo LIKE 'timestamp%' THEN 'now()'
    WHEN tipo = 'time without time zone' THEN quote_literal('08:00')
    WHEN tipo IN ('json','jsonb') THEN quote_literal('{}') || '::' || tipo
    WHEN tipo = 'ARRAY' THEN quote_literal('{}') || '::' || udt
    WHEN tipo = 'USER-DEFINED' THEN (
      SELECT quote_literal(e.enumlabel) || '::public.' || quote_ident(udt)
        FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
       WHERE t.typname = udt ORDER BY e.enumsortorder LIMIT 1)
    ELSE NULL
  END;
END $fn$;
GRANT EXECUTE ON FUNCTION iso_test.val(text, text, uuid) TO authenticated;

-- monta um INSERT generico (colunas obrigatorias + id + empresa_id + override)
CREATE FUNCTION iso_test.insert_sql(_tabela text, _empresa uuid,
                                    _col_override text DEFAULT NULL, _val_override text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql STABLE AS $fn$
DECLARE r record; cols text[] := '{}'; vals text[] := '{}'; e text;
BEGIN
  FOR r IN
    SELECT column_name
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = _tabela
       AND is_generated = 'NEVER' AND is_identity = 'NO'
       AND ( column_name IN ('id','empresa_id')
          OR column_name = _col_override
          OR (is_nullable = 'NO' AND column_default IS NULL) )
     ORDER BY ordinal_position
  LOOP
    IF r.column_name = _col_override THEN
      e := _val_override;
    ELSE
      e := iso_test.val(_tabela, r.column_name, _empresa);
    END IF;
    IF e IS NULL THEN RETURN NULL; END IF;   -- tipo desconhecido: pula a tabela
    cols := cols || quote_ident(r.column_name);
    vals := vals || e;
  END LOOP;

  IF array_length(cols, 1) IS NULL THEN RETURN NULL; END IF;

  RETURN format('INSERT INTO public.%I (%s) VALUES (%s)',
                _tabela, array_to_string(cols, ', '), array_to_string(vals, ', '));
END $fn$;
GRANT EXECUTE ON FUNCTION iso_test.insert_sql(text, uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------
-- 1. Massa de teste (como postgres, sem RLS e sem triggers)
-- ---------------------------------------------------------------------
BEGIN;

SET LOCAL session_replication_role = replica;

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
-- 1.1 Massa GENERICA: uma linha em cada tabela com empresa_id, nas duas
--     empresas. Varias passadas, porque uma tabela pode depender de
--     outra que ainda nao foi populada.
-- ---------------------------------------------------------------------
BEGIN;
SET LOCAL session_replication_role = replica;

DO $seed$
DECLARE
  passada int; emp uuid; s text; t record; sql text; novo uuid; faltando int; tem_id boolean;
BEGIN
  FOR passada IN 1..6 LOOP
    faltando := 0;
    FOREACH s IN ARRAY array['a','b'] LOOP
      emp := iso_test.v('empresa_' || s);
      FOR t IN SELECT tabela FROM iso_test.tabelas ORDER BY tabela LOOP
        -- ja tem linha dessa empresa? nada a fazer
        EXECUTE format('SELECT 1 FROM public.%I WHERE empresa_id = %L LIMIT 1', t.tabela, emp);
        IF FOUND THEN CONTINUE; END IF;

        sql := iso_test.insert_sql(t.tabela, emp);
        IF sql IS NULL THEN faltando := faltando + 1; CONTINUE; END IF;

        SELECT EXISTS (SELECT 1 FROM information_schema.columns c
                        WHERE c.table_schema = 'public' AND c.table_name = t.tabela
                          AND c.column_name = 'id' AND c.udt_name = 'uuid')
          INTO tem_id;

        BEGIN
          IF tem_id THEN
            EXECUTE sql || ' RETURNING id' INTO novo;
          ELSE
            EXECUTE sql;
            novo := NULL;
          END IF;
          INSERT INTO iso_test.seeded(tabela, empresa, id)
          VALUES (t.tabela, emp, coalesce(novo, '00000000-0000-0000-0000-000000000000'::uuid));
        EXCEPTION WHEN OTHERS THEN
          faltando := faltando + 1;
        END;
      END LOOP;
    END LOOP;
    EXIT WHEN faltando = 0;
  END LOOP;
END $seed$;

COMMIT;

-- ---------------------------------------------------------------------
-- 2. Testes autenticado como o usuario da empresa A
-- ---------------------------------------------------------------------
BEGIN;

SELECT set_config('request.jwt.claims',
       json_build_object('sub', iso_test.v('user_a')::text, 'role', 'authenticated',
                         'email', 'iso-a@teste-isolamento.local')::text, true);
SET LOCAL ROLE authenticated;

-- (a) LEITURA: toda tabela com empresa_id ------------------------------
SELECT iso_test.check_leitura(tabela) FROM iso_test.tabelas ORDER BY tabela;
SELECT iso_test.check_leitura('empresas');

-- (b) ESCRITA CRUZADA: insert com empresa de B, update e delete de B ---
DO $esc$
DECLARE t record; b uuid := iso_test.v('empresa_b'); sql text;
BEGIN
  FOR t IN SELECT tabela FROM iso_test.tabelas ORDER BY tabela LOOP
    sql := iso_test.insert_sql(t.tabela, b);
    IF sql IS NOT NULL THEN
      PERFORM iso_test.expect_bloqueado('b) escrita', 'insert em ' || t.tabela || ' com empresa_id de B', sql);
    END IF;

    PERFORM iso_test.expect_bloqueado('b) escrita', 'update de linhas de B em ' || t.tabela,
      format('UPDATE public.%I SET empresa_id = empresa_id WHERE empresa_id = %L', t.tabela, b));

    PERFORM iso_test.expect_bloqueado('b) escrita', 'delete de linhas de B em ' || t.tabela,
      format('DELETE FROM public.%I WHERE empresa_id = %L', t.tabela, b));
  END LOOP;
END $esc$;

-- (c) FK CRUZADA: cada FK para tabela de negocio, apontando para B -----
DO $fkx$
DECLARE f record; a uuid := iso_test.v('empresa_a'); b uuid := iso_test.v('empresa_b');
        alvo uuid; sql text;
BEGIN
  FOR f IN
    SELECT * FROM iso_test.fks
     WHERE pai_tem_empresa
       AND tabela IN (SELECT tabela FROM iso_test.tabelas)
     ORDER BY tabela, coluna
  LOOP
    EXECUTE format('SELECT p.%I FROM %I.%I p WHERE p.empresa_id = %L ORDER BY p.%I LIMIT 1',
                   f.pai_coluna, f.pai_schema, f.pai, b, f.pai_coluna) INTO alvo;
    IF alvo IS NULL THEN CONTINUE; END IF;  -- sem massa de B nesse pai

    sql := iso_test.insert_sql(f.tabela, a, f.coluna, quote_literal(alvo) || '::uuid');
    IF sql IS NULL THEN CONTINUE; END IF;

    PERFORM iso_test.expect_bloqueado('c) FK cruzada',
      f.tabela || '.' || f.coluna || ' -> ' || f.pai || ' de B', sql);
  END LOOP;
END $fkx$;

-- (d) RPCs: toda funcao do schema public chamada com ids de B ----------
-- cada chamada roda em subtransacao que e SEMPRE desfeita (RAISE forcado)
DO $rpc$
DECLARE
  fn record; args text; a_arg record; expr text; res text; nome text;
  ids uuid[]; vazou boolean; i uuid; msg text;
  bloqueadas text[] := array['disparar_rotina','email_queue_dispatch','email_queue_wake',
                             'enqueue_email','read_email_batch','delete_email','move_to_dlq',
                             'handle_new_user','handle_nova_empresa'];
BEGIN
  SELECT array_agg(valor) INTO ids FROM iso_test.ctx WHERE chave LIKE '%_b';
  ids := ids || COALESCE((SELECT array_agg(id) FROM iso_test.seeded
                           WHERE empresa = iso_test.v('empresa_b')
                             AND id <> '00000000-0000-0000-0000-000000000000'::uuid), '{}'::uuid[]);

  FOR fn IN
    SELECT p.oid, p.proname::text AS nome, pg_get_function_identity_arguments(p.oid) AS assinatura
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prokind = 'f'
       AND p.prorettype <> 'trigger'::regtype
       AND NOT (p.proname = ANY (bloqueadas))
     ORDER BY p.proname, p.oid
  LOOP
    args := '';
    expr := NULL;
    FOR a_arg IN
      SELECT t.typname::text AS tipo, t.oid AS toid, ord
        FROM unnest(coalesce(
               (SELECT p.proargtypes::oid[] FROM pg_proc p WHERE p.oid = fn.oid), '{}'::oid[])
             ) WITH ORDINALITY AS u(toid, ord)
        JOIN pg_type t ON t.oid = u.toid
       ORDER BY ord
    LOOP
      expr := CASE
        WHEN a_arg.tipo = 'uuid'    THEN quote_literal(ids[1 + (a_arg.ord % greatest(array_length(ids,1),1))]) || '::uuid'
        WHEN a_arg.tipo IN ('text','varchar','bpchar') THEN quote_literal('ISO')
        WHEN a_arg.tipo IN ('int2','int4','int8','numeric','float4','float8') THEN '1'
        WHEN a_arg.tipo = 'bool'    THEN 'false'
        WHEN a_arg.tipo = 'date'    THEN 'current_date'
        WHEN a_arg.tipo LIKE 'timestamp%' THEN 'now()'
        WHEN a_arg.tipo IN ('json','jsonb') THEN quote_literal('{}') || '::' || a_arg.tipo
        WHEN a_arg.tipo = 'regclass' THEN quote_literal('public.obras') || '::regclass'
        WHEN EXISTS (SELECT 1 FROM pg_enum e WHERE e.enumtypid = a_arg.toid)
          THEN (SELECT quote_literal(e.enumlabel) || '::public.' || quote_ident(a_arg.tipo)
                  FROM pg_enum e WHERE e.enumtypid = a_arg.toid ORDER BY e.enumsortorder LIMIT 1)
        ELSE NULL END;
      IF expr IS NULL THEN args := NULL; EXIT; END IF;
      args := CASE WHEN args = '' THEN expr ELSE args || ', ' || expr END;
    END LOOP;

    IF args IS NULL THEN CONTINUE; END IF;  -- tipo de argumento nao suportado

    nome := fn.nome || '(' || coalesce(fn.assinatura, '') || ') com ids de B';

    BEGIN
      EXECUTE format('SELECT coalesce(string_agg(x::text, %L), %L) FROM (SELECT public.%I(%s) AS x) x',
                     '|', '', fn.nome, coalesce(args, '')) INTO res;
      -- desfaz qualquer efeito colateral da chamada
      RAISE EXCEPTION 'ISO_OK:%', left(coalesce(res, ''), 4000);
    EXCEPTION WHEN OTHERS THEN
      msg := SQLERRM;
      IF msg LIKE 'ISO_OK:%' THEN
        res := substr(msg, 8);
        vazou := false;
        FOREACH i IN ARRAY ids LOOP
          IF position(i::text in res) > 0 THEN vazou := true; EXIT; END IF;
        END LOOP;
        PERFORM iso_test.reg('d) rpc', nome, NOT vazou,
          CASE WHEN vazou THEN 'VAZOU dado de B: ' || left(res, 150) ELSE 'sem dado de B' END);
      ELSE
        PERFORM iso_test.reg('d) rpc', nome, true, 'bloqueado: ' || left(msg, 150));
      END IF;
    END;
  END LOOP;
END $rpc$;

-- (e) STORAGE ----------------------------------------------------------
SELECT iso_test.expect_vazio_ou_erro('e) storage', 'listar/baixar arquivo de B', format(
  $q$SELECT id FROM storage.objects WHERE bucket_id = 'obras-contratos' AND name LIKE %L$q$,
  iso_test.v('empresa_b')::text || '/%'));

SELECT iso_test.expect_bloqueado('e) storage', 'gravar arquivo na pasta de B', format(
  $q$INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('obras-contratos', %L, %L)$q$,
  iso_test.v('empresa_b')::text || '/invasor.pdf', iso_test.v('user_a')));

SELECT iso_test.expect_bloqueado('e) storage', 'apagar arquivo de B', format(
  $q$DELETE FROM storage.objects WHERE bucket_id = 'obras-contratos' AND name LIKE %L$q$,
  iso_test.v('empresa_b')::text || '/%'));

-- escalonamento de privilegio
SELECT iso_test.expect_bloqueado('b) escrita', 'virar super_admin (user_roles)',
  $q$INSERT INTO public.user_roles (user_id, role, empresa_id)
     SELECT iso_test.v('user_a'), 'super_admin'::app_role, iso_test.v('empresa_a')$q$);

RESET ROLE;

-- confirma que nenhuma RPC de B teve efeito (fatura de B segue em aberto)
DO $chk$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.cartao_despesas
   WHERE empresa_id = iso_test.v('empresa_b') AND fatura_paga;
  PERFORM iso_test.reg('d) rpc', 'fatura de B continua em aberto', n = 0, 'faturas pagas: ' || n);
END $chk$;

COMMIT;

-- ---------------------------------------------------------------------
-- 3. Limpeza: apaga as duas empresas de teste
-- ---------------------------------------------------------------------
BEGIN;
SET LOCAL session_replication_role = replica;

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
  PERFORM iso_test.reg('f) limpeza', 'empresas de teste removidas', n = 0, 'restaram: ' || n);
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

SELECT grupo, count(*) AS casos, count(*) FILTER (WHERE NOT passou) AS falhas
  FROM iso_test.resultados GROUP BY grupo ORDER BY grupo;

DO $final$
DECLARE n_fail bigint; n_tot bigint;
BEGIN
  SELECT count(*) FILTER (WHERE NOT passou), count(*) INTO n_fail, n_tot FROM iso_test.resultados;
  RAISE NOTICE 'Isolamento multiempresa: % de % casos passaram', n_tot - n_fail, n_tot;
  IF n_tot < 200 THEN RAISE EXCEPTION 'Cobertura suspeita: apenas % casos gerados', n_tot; END IF;
  IF n_fail > 0 THEN RAISE EXCEPTION '% caso(s) de isolamento FALHARAM', n_fail; END IF;
END $final$;

DROP SCHEMA iso_test CASCADE;
