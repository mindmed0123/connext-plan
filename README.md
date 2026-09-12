# Gestão de Obra

Sistema de gestão de obras, orçamentos e financeiro para empresas de engenharia e manutenção
(multiempresa, com controle de permissões por funcionário).

Produção: https://gestaodeobra.online

---

## Módulos

| Módulo | O que faz |
| --- | --- |
| **Dashboard** | Indicadores da empresa: obras por situação, obras finalizadas, receitas/despesas, próximos vencimentos e gráficos de fluxo. |
| **Obras** | Cadastro da obra (chamado, cliente, comprador, contrato, região), adendos de contrato, fotos, diário, vistorias e a tela de detalhe com DRE. |
| **Orçamentos** | Proposta comercial com serviços, descontos por item e global, ISS, condições de pagamento e geração do PDF. Ao aprovar, o orçamento vira contrato/obra. |
| **Serviços** | Catálogo de serviços com código, unidade, preço, categoria e tributação (ISS, LC 116, NBS). |
| **Faturamento** | Fluxo documental da obra: RC → Pedido de Compra → Nota Fiscal → Recebimento. |
| **Recebimentos** | Contas a receber, com registro de pagamentos parciais e estorno. |
| **Financeiro** | Razão único de receitas e despesas, categorias, contas a pagar/receber, fluxo de caixa e relatório de retenções. |
| **Cartões** | Cartões de crédito da empresa, despesas por obra/categoria, parcelamento automático e fechamento/pagamento de fatura. |
| **Compradores** | Clientes institucionais (construtoras e outros), contratos anexados e histórico de obras. |
| **Equipes** | Pessoas (CLT, administrativo, terceirizado), documentos (NRs, ASO, ficha de registro) e permissões por módulo. |
| **Contratos** | Contratos com clientes: vigência, valor, reajuste, situação (ativo, suspenso, encerrado, em negociação) e obras vinculadas. |
| **Medições** | Boletins de medição por obra e etapa, do rascunho ao aprovado, com geração da nota fiscal a partir da medição aprovada. |
| **Contas a pagar** | Despesas a vencer com parcelamento, baixa de parcelas, vínculo com fornecedor, obra e centro de custo. |
| **Bancos e conciliação** | Contas bancárias, saldos, importação de extrato (OFX) e conciliação do extrato com os lançamentos do razão. |
| **Portal do cliente** | Link por obra (token próprio, fora dos buscadores) para o cliente acompanhar avanço, fotos e documentos sem precisar de login. |
| **Notificações** | Preferências por usuário e canal, resumo diário de vencimentos e prazos, envio por e-mail com registro do que foi enviado. |
| **RDO / aplicativo de campo** | Diário de obra, fotos e apontamentos direto do canteiro, em tela de celular instalável (PWA). |
| **Privacidade e LGPD** | Aceite de termos e política, exportação completa dos dados da empresa em CSV e pedido de exclusão da conta. |
| **Configurações** | Dados da empresa, regime tributário, saldo inicial de caixa, rótulos e assinatura do plano. |

---

## Fluxo financeiro

```text
Pedido de Compra (PC)      documento recebido do cliente
        |                  -> gera Recebimento previsto (a_receber)
        v
Nota Fiscal (NF)           valor bruto + retenções (INSS, ISS, IRRF, PCC)
        |                  -> valor líquido = bruto - retenções
        v
Recebimento                saldo em aberto = lançamento PREVISTO no razão
        |
        v
Pagamentos                 cada pagamento (valor + data) vira um lançamento
(recebimento_pagamentos)   REALIZADO na data em que o dinheiro entrou
        |
        v
Razão (lancamentos_financeiros)   fonte única de caixa
```

Regras que sustentam esse fluxo:

- **PC "recebido" = documento recebido**, não dinheiro recebido.
- Um recebimento pode ter vários pagamentos. A situação (`a_receber` / `parcial` / `recebido`)
  e o valor recebido são calculados pelo banco a partir da soma dos pagamentos.
- Recebimento com pagamento registrado não pode ser excluído: é preciso estornar o pagamento.
- Materiais, despesas de cartão, parcelas de terceirizados, recebimentos e retenções de NF
  **geram automaticamente** o lançamento no razão. Esses lançamentos não são editáveis no
  Financeiro — a alteração é feita na tela de origem (botão "Abrir origem").
- A função `verificar_razao` compara as telas de origem com o razão e deve devolver diferença zero.

### Competência × caixa

- **Competência** (`data_competencia`): o mês a que o fato pertence — a NF emitida, o material
  comprado, a compra no cartão. É o que a DRE da obra usa.
- **Caixa** (`data_realizado` / `data_vencimento`): o mês em que o dinheiro entra ou sai — o
  pagamento do recebimento, o pagamento da fatura do cartão. É o que o fluxo de caixa usa.
- Lançamento `previsto` = ainda não movimentou caixa. Lançamento `realizado` = movimentou.
- Saldo acumulado do fluxo = **saldo inicial + realizado a partir da data do saldo inicial**.
  Meses anteriores a essa data mostram o movimento, mas não o acumulado.
- Compra parcelada no cartão: a competência é a data da compra; cada parcela cai no caixa
  na data de vencimento da respectiva fatura.

---

## Como rodar localmente

Requisitos: Node 18+ (ou Bun) e npm.

```sh
git clone <URL_DO_REPOSITORIO>
cd <PASTA_DO_PROJETO>
npm install
npm run dev          # http://localhost:8080
```

Variáveis de ambiente (arquivo `.env`, já gerado pelo Lovable Cloud):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```

Outros comandos:

```sh
npm test             # testes (Vitest)
npm run test:watch   # testes em modo watch
npm run lint         # ESLint
npm run build        # build de produção
npm run preview      # serve o build
```

### Stack

React 18 + Vite + TypeScript, Tailwind CSS e shadcn/ui no front; backend Lovable Cloud
(Postgres com RLS por empresa, autenticação, storage e edge functions); TanStack Query
para cache e sincronização em tempo real entre as telas.

### Testes

Os testes cobrem as regras críticas de cálculo em `src/lib`:
datas (`date.test.ts`), dinheiro e parcelamento (`money.test.ts`),
faturas de cartão (`cartao-helpers.test.ts`) e totais do orçamento (`orcamento-calc.test.ts`).

## Isolamento entre empresas (multiempresa)

O sistema é usado por várias construtoras no mesmo banco. Existe uma prova automática de
que uma empresa não alcança os dados de outra: `supabase/tests/isolamento.sql`.

O script cria duas empresas de teste (A e B) com um usuário administrador cada, popula
obra, orçamento, contratação, parcela, cartão, despesa, nota fiscal, recebimento e
pagamento nas duas e, autenticado como o usuário de A, verifica:

- **(a) Leitura** — nenhuma linha da empresa B aparece em nenhuma tabela.
- **(b) Escrita** — inserções e alterações apontando para registros de B (obra, orçamento,
  contratação, cartão, recebimento, cliente, pessoa) são todas recusadas.
- **(c) Funções do banco** — `get_dre_obra`, `get_obra_financeiro_resumo`,
  `get_financeiro_kpis`, `get_fluxo_caixa_mensal`, `salvar_orcamento`, `aprovar_orcamento`,
  `confirmar_recebimento`, `pagar_fatura_cartao`, `reabrir_fatura_cartao`,
  `verificar_razao` e `seed_categorias_financeiras` chamadas com ids da empresa B falham
  ou voltam vazias.
- **(d) Arquivos** — arquivos da empresa B não podem ser lidos, gravados nem apagados.

No fim o script apaga as duas empresas de teste, imprime uma linha por caso
(`PASSOU` / `FALHOU`) e encerra com erro se algum caso falhar.

### Rodar localmente

Requisitos: Docker e [Supabase CLI](https://supabase.com/docs/guides/cli).

```sh
supabase start                # sobe Postgres + Storage e aplica todas as migrations
npm run test:isolamento       # roda a prova de isolamento
supabase stop --no-backup
```

Sem o script npm, o comando equivalente é:

```sh
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -f supabase/tests/isolamento.sql
```

### No CI

O workflow `.github/workflows/isolamento.yml` roda em todo pull request: sobe o Postgres,
aplica todas as migrations e executa o script. Pull request com qualquer caso `FALHOU`
não passa.

### Regra de cobertura

**Toda tabela nova entra no script de isolamento no mesmo pull request em que é criada.**
Na prática: adicionar o nome da tabela na lista de leitura (seção "a) LEITURA") e, se ela
tiver chave estrangeira para outra tabela de negócio, incluir um caso de escrita cruzada
na seção "b) ESCRITA COM FK DE OUTRA EMPRESA". Toda função nova em `SECURITY DEFINER`
também ganha um caso na seção "c) RPCs".

