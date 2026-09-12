# Dados pessoais tratados pelo sistema

Resumo de quais dados pessoais o sistema guarda, onde ficam e por quanto tempo.
Cada empresa cliente é controladora dos dados que cadastra; o sistema atua como operador.

## O que é guardado

| Dado | Onde fica | Origem | Retenção |
| --- | --- | --- | --- |
| Nome, e-mail e senha (hash) de acesso | Autenticação gerenciada do backend + `profiles` | Cadastro/convite | Enquanto a conta existir |
| Aceite de termos e privacidade (data + versão) | `profiles.aceite_*` | Cadastro | Enquanto a conta existir (prova de consentimento) |
| Funcionários e terceirizados: nome, CPF, cargo, contato, dados bancários | `pessoas` | Cadastro pela empresa | Enquanto a empresa mantiver o registro; guarda fiscal após encerramento |
| Documentos de funcionários (ASO, NRs, ficha de registro) | Bucket privado `pessoa-documentos`, caminho `empresa_id/...` | Upload pela empresa | Enquanto a empresa mantiver o registro |
| Clientes, compradores e fornecedores: razão social, CNPJ/CPF, contato | `clientes`, `compradores`, `fornecedores` | Cadastro pela empresa | Guarda fiscal |
| Notas fiscais, contratos, medições e anexos | Tabelas fiscais + buckets privados por empresa | Operação | Guarda fiscal (5 anos) |
| Histórico de ações críticas (quem, quando, o quê) | `audit_log` | Automático | Enquanto a conta existir |
| Envios de e-mail e preferências de aviso | `email_send_log`, `notificacao_*` | Automático | 12 meses |
| Acessos ao portal do cliente (IP e navegador) | `obra_portal_acessos` | Link público | 12 meses |
| Erros da aplicação | Monitoramento externo (Sentry), quando configurado | Automático | Conforme retenção do provedor |

## O que nunca é registrado em log

CPF, CNPJ, dados bancários, chave PIX, senhas, tokens e cabeçalhos de autorização são
removidos antes do envio para o monitoramento (`src/lib/monitoring.ts` e
`supabase/functions/_shared/erro.ts`).

## Isolamento entre empresas

Todos os dados carregam `empresa_id`, com RLS por empresa, caminhos de arquivo
prefixados por `empresa_id/` e buckets privados.

## Direitos do titular

- **Exportar**: Configurações → Privacidade e dados → "Exportar dados da empresa" (ZIP com CSVs).
- **Excluir**: Configurações → Privacidade e dados → "Solicitar exclusão da conta"; concluída em até 30 dias.
- **Corrigir**: pelas próprias telas de cadastro.
