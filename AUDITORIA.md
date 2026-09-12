# Auditoria geral do sistema

Data: 12/09/2026 (UTC)
Escopo: correções financeiras, governança multiempresa, configuração por empresa e as entregas T1 a T6
(contratos e medições, orçado × realizado e cronograma, contas a pagar e conciliação, diário de obra e
celular, portal do cliente e notificações, limites de plano, monitoramento, CI e LGPD).

Nenhum dado de negócio foi alterado nesta auditoria.

---

## 1. Resultado em números

| Verificação | Resultado |
|---|---|
| Typecheck (`tsgo --noEmit`) | passou |
| Testes unitários (`npm test`) | 5 arquivos, 32 testes, todos passaram |
| Lint (`npm run lint`) | 0 erros, 327 avisos |
| Build de produção (`npm run build`) | passou |
| Migrations aplicadas num banco vazio | 115 de 115, sem falha |
| Diferença de estrutura entre repositório e ambiente ativo | 0 tabelas, 0 colunas, 0 índices, 0 policies, 0 triggers |
| Teste de isolamento entre empresas | 52 de 52 casos passaram |
| Conferência do razão × origens | 0 diferença |
| Tabelas no banco / policies / funções privilegiadas | 71 / 268 / 103 |
| Tabelas em tempo real | 26 |
| Áreas de arquivo privadas | 11 de 12 (só a de logotipos é pública) |
| Empresas cadastradas | 8 |

## 2. O que foi verificado

### 2.1 Compilação, testes e migrations
- Subi um banco Postgres vazio, apliquei as 115 migrations na ordem e todas rodaram sem erro.
  Confirma que o sistema pode ser reconstruído do zero.
- Comparei o banco reconstruído com o ambiente ativo: estrutura idêntica (tabelas, colunas, índices,
  policies e gatilhos). Não existe alteração feita "por fora" das migrations, com uma exceção
  registrada no item 5.

### 2.2 Isolamento entre empresas
O teste automático cria duas empresas de teste com dados completos e, logado como usuário da empresa A,
tenta ler, gravar, alterar, apagar, chamar relatórios e acessar arquivos da empresa B. Resultado:
52 de 52 casos bloqueados corretamente, incluindo:
- leitura de 18 tabelas: nenhuma linha da outra empresa aparece;
- 18 tentativas de gravar/alterar/apagar apontando para registros da outra empresa: todas bloqueadas;
- tentativa de se tornar super admin: bloqueada;
- 9 relatórios e rotinas financeiras chamados com dados da outra empresa: recusados ou vazios;
- arquivos da outra empresa: não podem ser listados, gravados nem apagados;
- as empresas de teste são apagadas ao final (restaram 0).

### 2.3 Razão único e duplicidades
Confrontei, empresa por empresa e obra por obra, a soma de cada origem (recebimentos, parcelas de
contratação, materiais, cartões, retenções de nota fiscal e contas a pagar) com o que está no razão:
**nenhuma diferença**. Não há valor somado duas vezes nem valor faltando.

### 2.4 Funções privilegiadas e permissões
- Todas as 103 funções privilegiadas têm caminho de busca fixo (`search_path`), condição obrigatória de
  segurança. Nenhuma é executável por visitante não autenticado.
- Os índices únicos que não citam a empresa são todos amarrados a um registro-pai que já pertence a uma
  única empresa (obra, pessoa, contratação, nota fiscal), portanto não permitem cruzamento de dados.

### 2.5 Arquivos e portal do cliente
Das 12 áreas de arquivo, 11 são privadas. Só a de logotipos é pública, o que é esperado porque o
logotipo aparece em documentos e no portal. O portal do cliente continua funcionando apenas por link com
token, sem acesso direto ao banco.

## 3. Falhas encontradas e corrigidas

1. **Permissões de banco existiam só no ambiente ativo.** As autorizações de acesso às tabelas nunca
   tinham sido escritas em migration; vinham do padrão do projeto. Numa reconstrução do banco a partir do
   repositório, o sistema ficaria sem acesso a obras, financeiro, pessoas e orçamentos.
   Corrigido por migration nova, que também deixou as tabelas de e-mail restritas apenas ao serviço
   interno. O isolamento por empresa continua garantido pelas regras de acesso já existentes.
2. **Dois casos do teste de isolamento estavam errados** (não era falha do sistema):
   - a verificação da tabela de empresas procurava uma coluna que ali não existe;
   - a verificação dos indicadores financeiros exigia que o resultado fosse zero, quando o correto é que
     ele bata exatamente com o que a própria empresa enxerga. Ambos foram corrigidos no arquivo de teste.

## 4. Falhas encontradas e não corrigidas (aguardam sua decisão)

1. **16 recebimentos antigos suspeitos**, todos da POTÊNCIA SOLUÇÕES, criados em 11/09/2026 por uma
   migration de ajuste, ligados a notas fiscais sem pedido de compra, somando **R$ 430.933,89**, nenhum
   deles com pagamento registrado. Inclui a duplicidade clara da nota 77 (R$ 40.007,00).
   Conforme sua orientação anterior, **nada foi alterado**: as regras novas valem só daqui para frente.
   Consulta usada:
   ```sql
   select r.* from recebimentos r
     join notas_fiscais nf on nf.id = r.nota_fiscal_id
    where nf.pedido_compra_id is null
      and r.created_at::date = '2026-09-11'
      and not exists (select 1 from recebimento_pagamentos p where p.recebimento_id = r.id);
   ```
2. **Acesso amplo do perfil "visitante" às tabelas** no ambiente ativo. Na prática ninguém vê nada,
   porque as regras de acesso por empresa barram tudo, mas o ideal é retirar essa autorização.
   Não mexi para não arriscar quebrar o portal e as páginas públicas sem seu aval.

## 5. Observações e pendências

- **Duas rotinas de e-mail** (`email_queue_dispatch` e `email_queue_wake`) existem no ambiente ativo mas
  não em migration: são criadas pela infraestrutura de e-mail da plataforma e apontam para o endereço do
  próprio projeto. Não foram trazidas para o repositório de propósito, para não conflitar com a
  plataforma.
- **34 avisos do verificador de segurança** sobre funções privilegiadas chamáveis por usuário logado.
  São os relatórios e rotinas do próprio sistema; todos conferem a empresa do usuário por dentro, o que
  ficou comprovado no teste de isolamento. Mantidos de propósito.
- **327 avisos de estilo de código** (uso de tipos genéricos, principalmente em telas antigas). Não
  quebram nada; ficam como melhoria futura.
- **Não foi possível testar nesta execução**: fluxo de ponta a ponta com usuário real (precisa de
  e-mail e senha de teste nos segredos), monitoramento de erros (falta a chave do serviço), textos
  jurídicos definitivos (os atuais são provisórios) e o ciclo completo de uma empresa de teste em
  produção.
- **Teste de isolamento na esteira automática**: roda contra um banco local do Supabase, conforme
  instruções no início do arquivo `supabase/tests/isolamento.sql`. Não foi ligado à esteira porque o
  ambiente dela não tem banco Postgres com as extensões do Supabase.

## 6. Como cada item criado nesta auditoria cumpre as regras 1 a 11

Nesta auditoria foram criados apenas dois itens, nenhum deles tabela nova:

| Item | Como cumpre |
|---|---|
| Migration de permissões de acesso | Regra 1 e 2: não cria tabela; concede acesso somente ao perfil autenticado nas tabelas que já têm as quatro regras por empresa, e ao serviço interno. Tabelas de e-mail passaram a ser exclusivas do serviço. Regras 3 a 11 não são afetadas: nenhuma chave estrangeira, função, gatilho, índice, tempo real ou arquivo foi alterado. |
| Correções no teste de isolamento | Regra 12 (prova): o teste continua criando duas empresas isoladas, exercitando leitura, escrita, chaves estrangeiras cruzadas, relatórios e arquivos, e apagando tudo ao final. Agora mede o indicador financeiro comparando com o que a própria empresa enxerga, o que detecta qualquer vazamento de valores. |
