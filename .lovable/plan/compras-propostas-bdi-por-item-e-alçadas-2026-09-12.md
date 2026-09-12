# Compras, propostas, BDI por item e alçadas

Quatro blocos grandes, todos ligados ao que já existe (orçamento, obra, etapa, centro de custo, contas a pagar, razão). Proponho entregar em quatro etapas, nesta ordem, para você conferir cada uma funcionando antes da seguinte.

## Etapa 1 — Compras: solicitação → cotação → ordem de compra

Novas tabelas: `solicitacoes_compra`, `solicitacao_itens`, `cotacoes`, `cotacao_itens`, `ordens_compra`, `ordem_compra_itens`, `ordem_compra_recebimentos` e `ordem_compra_recebimento_itens`.

Telas:
- **Compras > Solicitações**: cria a solicitação ligada a obra e etapa, com itens (descrição, unidade, quantidade, item do orçamento opcional).
- **Mapa de cotação**: fornecedores lado a lado por item, melhor preço destacado em cada linha e melhor total; permite escolher fornecedor item a item e gerar uma ordem de compra por fornecedor.
- **Ordem de compra**: número sequencial por empresa, condição, prazo, itens e valor.
- **Recebimento**: total ou parcial, por quantidade. Cada recebimento gera o título em contas a pagar com as parcelas conforme a condição de pagamento, e só o recebido vira custo da obra (o material entra no recebimento, nunca na emissão da ordem).
- **PDF da ordem de compra** com a logo da empresa, no mesmo padrão visual do orçamento.

## Etapa 2 — Propostas comerciais

- Tabela `modelos_proposta` (nome, capa, introdução, condições, rodapé, mostra BDI, padrão) com tela de cadastro em Configurações.
- Botão **Gerar proposta** no orçamento: escolhe o modelo, opção de mostrar itens por etapa ou resumidos, e sai o PDF com dados do cliente, condições, validade e assinatura.
- Tabela `proposta_versoes` guarda cada proposta gerada (data, quem gerou, modelo e conteúdo), para reimprimir idêntica depois.

## Etapa 3 — BDI por item e importação de planilha

- `orcamento_itens` ganha BDI próprio; vazio significa "usa o BDI do orçamento". A tela do orçamento passa a mostrar custo, BDI e preço de venda por linha.
- **Importar planilha** (Excel ou CSV): tela de conferência mostrando cada coluna reconhecida (descrição, unidade, quantidade, preço, etapa), com correção antes de gravar. A gravação é tudo-ou-nada: nunca importa pela metade.

## Etapa 4 — Alçada de aprovação

- Tabela `alcadas` (documento, faixa de valor, perfil ou pessoa, ordem).
- Documento acima do valor entra em **aguardando aprovação**; tela **Minhas aprovações** com a fila, aprovar e reprovar com justificativa, tudo registrado no histórico de auditoria.
- E-mail para quem precisa aprovar, usando a fila de e-mails que já existe.

## Multiempresa

Toda tabela nova nasce com empresa obrigatória ligada a empresas, preenchida pela empresa do usuário, proteção por linha ligada e as quatro permissões separadas; leitura por `tenant_match`, escrita por `tenant_can_write` somada a administrador ou permissão do módulo; toda ligação entre tabelas (solicitação, cotação, ordem, obra, etapa, fornecedor) prova ser da mesma empresa na gravação e na alteração; funções com caminho de busca fixo, validação de empresa e permissão, e execução liberada só para quem está logado; numeração sequencial e demais índices únicos sempre por empresa; consultas do front começam pelo identificador da empresa. Ao final de cada etapa eu digo item por item como cada regra foi cumprida.

## Critério de aceite

Solicitação com 3 itens → 2 cotações → ordem de compra pelo melhor preço → recebimento parcial → título em contas a pagar e custo na obra apenas pelo recebido. Vou executar esse roteiro e mostrar o resultado.

## Perguntas

1. Começo pela Etapa 1 (Compras) e sigo nas demais, ou você quer outra ordem?
2. A numeração da ordem de compra pode seguir o mesmo padrão de máscara das configurações (ex.: `OC-{ano}-{seq}`)?
