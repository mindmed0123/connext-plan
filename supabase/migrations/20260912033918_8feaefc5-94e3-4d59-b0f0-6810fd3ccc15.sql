-- 1) checkout_intents: somente service_role (edge functions)
REVOKE ALL ON public.checkout_intents FROM anon, authenticated;
GRANT ALL ON public.checkout_intents TO service_role;
CREATE POLICY "Somente serviços internos acessam checkout_intents"
  ON public.checkout_intents FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 2) Revogar EXECUTE de anon/public em TODAS as funções SECURITY DEFINER do schema public
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;

-- 3) Revogar EXECUTE de authenticated em funções internas:
--    (a) funções de gatilho, (b) seeds, (c) fila de e-mail, (d) numeração de documentos
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND (
        pg_catalog.pg_get_function_result(p.oid) = 'trigger'
        OR p.proname LIKE 'seed\_%'
        OR p.proname IN (
          'enqueue_email','delete_email','read_email_batch','move_to_dlq',
          'email_queue_dispatch','proximo_numero_documento','confirmar_recebimento',
          'verificar_razao','categoria_por_papel','obra_status_padrao',
          'ensure_obra_for_chamado','admin_list_empresas_contatos'
        )
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', f.sig);
  END LOOP;
END $$;

-- 4) Garantir EXECUTE para as funções realmente usadas pelas telas e pelas policies
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.proname IN (
        'aplicar_perfil_permissao','aprovar_orcamento','criar_obra_segura',
        'get_dre_obra','get_financeiro_kpis','get_fluxo_caixa_mensal',
        'get_obra_financeiro_resumo','get_retencoes_mensais','salvar_orcamento',
        'signup_create_company','pagar_fatura_cartao','reabrir_fatura_cartao',
        'has_role','has_permission','is_admin_or_super','is_super_admin',
        'get_user_empresa_id','tenant_match','tenant_can_write','mesmo_tenant',
        'can_access_obra','can_access_contratacao','empresa_assinatura_ativa',
        'suporte_sessao_ativa'
      )
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
  END LOOP;
END $$;