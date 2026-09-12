-- Auditoria: as GRANTs abaixo existiam apenas no ambiente ativo (privilégios padrão
-- do projeto) e não estavam em nenhuma migration. Sem elas, uma reconstrução do banco
-- a partir do repositório deixaria o aplicativo sem acesso às tabelas.
-- O isolamento entre empresas continua garantido pelas policies de RLS já existentes.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cartao_despesas','cartoes_credito','categorias_financeiras','categorias_servico',
    'clientes','compradores','contratacoes_terceirizado','contratos_clientes','diario_obra',
    'empresa_dashboard_config','execucoes','fotos_obra','lancamentos_financeiros',
    'materiais_obra','notas_fiscais','obra_responsaveis','obra_timeline','obras',
    'orcamento_itens','orcamentos','origens_obra','parcelas_pagamento','pedidos_compra',
    'pessoa_permissoes','pessoas','rcs','recebimentos','regioes_obra','servicos','vistorias'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- Empresas e papéis: escrita continua restrita pelas policies (super admin / admin da empresa).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.empresas TO service_role;
GRANT ALL ON public.user_roles TO service_role;
GRANT ALL ON public.profiles TO service_role;

-- Cobrança: autenticado apenas consulta (policies limitam à própria empresa).
GRANT SELECT ON public.planos TO authenticated;
GRANT SELECT ON public.planos TO anon;
GRANT SELECT ON public.assinaturas TO authenticated;
GRANT SELECT ON public.billing_events TO authenticated;
GRANT ALL ON public.planos TO service_role;
GRANT ALL ON public.assinaturas TO service_role;
GRANT ALL ON public.billing_events TO service_role;

-- Infraestrutura de e-mail: exclusiva do service_role, sem acesso de autenticado/anônimo.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['email_send_log','email_send_state','email_unsubscribe_tokens','suppressed_emails'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;