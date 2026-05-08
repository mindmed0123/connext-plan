Plano para melhorar a integração com a Cakto

1. Resolver primeiro o webhook que não está configurando na Cakto
- Confirmar o formato aceito pela documentação da Cakto e ajustar a URL para um endpoint mais simples e compatível.
- Criar/usar uma URL limpa sem query string obrigatória para evitar a validação do painel da Cakto, por exemplo um endpoint curto dedicado ao webhook.
- Manter segurança sem depender da query string: aceitar o segredo por header quando disponível e, se a Cakto não enviar assinatura, registrar o webhook via API da própria Cakto usando a chave já configurada.
- Testar OPTIONS, GET/healthcheck e POST para garantir que a Cakto consiga validar a URL sem receber erro.
- Deixar logs mais claros para distinguir: URL inválida, token inválido, JSON inválido, evento sem empresa, assinatura atualizada com sucesso.

2. Deixar o processamento do webhook mais robusto
- Normalizar os principais formatos de evento da Cakto: compra aprovada, pagamento aprovado, pagamento recusado/falhou, assinatura criada, assinatura renovada, cancelada, expirada e reembolsada.
- Melhorar a extração de identificadores: assinatura, cliente, e-mail, produto/plano, período e referência da empresa.
- Garantir idempotência para não processar o mesmo evento duas vezes.
- Salvar todos os eventos em histórico e marcar claramente quando foram processados, ignorados ou deram erro.
- Atualizar a assinatura da empresa mesmo quando o evento vier sem `ref`, usando fallback por e-mail do cliente ou produto/plano.

3. Melhorar a página de assinatura/billing
- Mostrar plano atual, status, período, trial, próxima cobrança, ID da assinatura Cakto e alertas de pagamento.
- Adicionar histórico recente de eventos/pagamentos da Cakto para o cliente ou para admin.
- Melhorar ações: mudar plano, atualizar status, abrir portal/página Cakto e reativar assinatura.
- Exibir mensagens mais claras quando o acesso estiver bloqueado por trial expirado, pagamento atrasado ou cancelamento.

4. E-mails automáticos de cobrança
- Configurar e-mails transacionais para eventos importantes:
  - pagamento aprovado;
  - pagamento recusado/falhou;
  - assinatura cancelada;
  - trial acabando;
  - assinatura ativada.
- Usar a infraestrutura de e-mail do Lovable Cloud já disponível, com fila e retries, para evitar perda de envio.
- Os envios serão disparados pelo webhook quando os eventos da Cakto chegarem.

5. Testes finais
- Testar a URL do webhook diretamente com payloads simulados.
- Testar um evento válido de pagamento aprovado e confirmar atualização em `assinaturas`.
- Testar pagamento falho/cancelamento e confirmar bloqueio correto pelo sistema.
- Testar carregamento da página `/billing` e da página de planos.
- Conferir logs do webhook e histórico de eventos para garantir que tudo ficou rodando.