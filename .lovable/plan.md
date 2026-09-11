# Cadeia NF → retenções → recebimento

## Solução escolhida

As retenções serão registradas em `lancamentos_financeiros` na categoria **Impostos retidos na fonte**, mas marcadas como **sem impacto no caixa**. O recebimento continuará sendo a única entrada de caixa e usará o valor líquido.

Isso evita a dupla redução que ocorreria se o sistema lançasse o recebimento líquido e também tratasse as retenções como saída de dinheiro.

## Banco de dados

- Adicionar `cprb` em empresas.
- Ampliar notas fiscais com valor bruto, deduções/base e campos editáveis de INSS, ISS, IRRF e PCC; `valor_liquido` será calculado pelo banco.
- Preservar NFs antigas com `valor_bruto = valor` e retenções zeradas.
- Adicionar em recebimentos o vínculo com NF, valor efetivamente recebido e status parcial.
- Adicionar ao razão um indicador de impacto no caixa.
- Criar a categoria **Impostos retidos na fonte** para cada empresa.
- Sincronizar cada NF com um lançamento informativo de retenção, sem impacto no caixa.
- Sincronizar recebimentos previstos, parciais e completos sem duplicar valores:
  - previsto: saldo integral em aberto;
  - parcial: valor pago como realizado e saldo restante como previsto;
  - completo: valor líquido integral como realizado.
- Criar uma função transacional para salvar NF e criar ou vincular seu recebimento ao PC existente.
- Atualizar os resumos financeiros para excluir lançamentos sem impacto do fluxo de caixa e incluí-los somente na DRE.
- Criar relatório mensal de INSS, ISS, IRRF e PCC por competência.

## Regras sugeridas ao lançar uma NF

- INSS: base = bruto − deduções; alíquota sugerida de 11%, ou 3,5% quando a empresa estiver em CPRB.
- ISS: alíquota sugerida do cliente.
- IRRF: sugestão de 1,5% quando o cliente retiver IRRF.
- PCC: sugestão conjunta de 4,65% quando o cliente retiver CSRF/PCC.
- Todas as bases, alíquotas e valores retidos continuarão editáveis antes de salvar.
- O vencimento sugerido será emissão + prazo de pagamento do cliente.

## Telas

- Cadastro e edição da NF: mostrar bruto, deduções, bases, alíquotas, retenções e líquido em tempo real.
- Recebimentos: informar o valor recebido; valor menor mantém o saldo como parcial e aberto.
- Dashboard: “em aberto” será líquido faturado menos o efetivamente recebido.
- DRE da obra: Receita bruta faturada, Retenções, Receita líquida, Recebido e Em aberto.
- Financeiro: adicionar relatório mensal simples das quatro retenções.

## Validação

- Conferir NFs antigas sem alteração financeira.
- Testar NF sem retenção, com retenção, vinculada a PC e sem PC.
- Testar recebimento parcial e quitação posterior.
- Confirmar que caixa recebe apenas o líquido e que DRE não duplica retenções.
- Comparar Dashboard, DRE, recebimentos e razão para a mesma obra.
