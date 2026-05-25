
## Objetivo
Remodelar as páginas **Serviços** e **Orçamentos** seguindo o prompt enviado (nível Omie ERP), **preservando os dados atuais**: 7 serviços, 31 orçamentos e 3 itens de orçamento.

## Adaptações necessárias ao prompt original

O prompt assume um schema que não bate 100% com o que existe no projeto. Vou adaptar:

- O prompt faz `DROP TABLE servicos / orcamentos / orcamento_itens CASCADE` → **não vou dropar**. Vou usar `ALTER TABLE ADD COLUMN IF NOT EXISTS` para acrescentar os campos novos preservando os dados.
- O prompt referencia tabela `perfis` (não existe — usaremos `profiles`).
- O prompt referencia `obras.titulo` (não existe — vou usar `codigo_chamado` + `descricao_servico`).
- O prompt referencia `obra_timeline.descricao` e `tipo` (campos reais são `evento` e `detalhes`).
- O prompt referencia `compradores.cnpj_cpf` (campo real é `cpf_cnpj`). Vou só garantir os campos extras (cidade, estado, endereco).
- Trigger `sync_obra_aprovado` do prompt conflita com o `sync_obra_status_from_orcamento` já existente — vou remover/substituir o antigo para evitar duplicidade.
- `numero_orcamento` (existente) vira `numero` no formato `ORC-YYYY-0001` via trigger; manter `numero_orcamento` como alias/coluna existente para não quebrar listagens antigas.
- Cores hardcoded `#0B1F42`, `#EE6616` do prompt → vou converter para tokens semânticos do design system (`primary`, `accent`) seguindo as regras do projeto.

## Migration (1 migration única)

1. Criar enum/tabela `categorias_servico` + RLS + seed por empresa.
2. `ALTER TABLE servicos` adicionando: `descricao_detalhada`, `categoria_id`, `desconto_padrao_pct`, `codigo_servico_municipio`, `codigo_lc116`, `codigo_nbs`, `aliquota_iss`, `iss_retido`, `tipo_tributacao`. Mantém `codigo`, `nome`, `unidade`, `preco_unitario`, `ativo`.
3. Trigger `gerar_codigo_servico` (gera `SRV00001` por empresa) — só dispara se `codigo IS NULL`.
4. `ALTER TABLE orcamentos` adicionando: `numero` (gerado), `comprador_id`, `vendedor_id`, `data_emissao`, `data_validade`, `data_resposta`, `subtotal`, `desconto_global_pct`, `desconto_global_valor`, `valor_impostos`, `valor_total`, `condicao_pagamento`, `numero_parcelas`, `intervalo_parcelas`, `percentual_entrada`, `objeto`, `local_execucao`, `prazo_execucao`, `observacoes_internas`. Adiciona valores `em_negociacao` e `cancelado` ao enum `orcamento_status` se faltarem.
5. Backfill: copiar `valor_orcamento → valor_total`, `data_envio → data_emissao` para registros existentes; gerar `numero` para os 31 orçamentos antigos.
6. `ALTER TABLE orcamento_itens` adicionando: `tipo`, `codigo`, `descricao_detalhada`, `aliquota_iss`. Tornar `subtotal` calculado (drop coluna e recriar como GENERATED).
7. Trigger `recalc_totais_orcamento` (recalcula `subtotal`, `valor_impostos`, `valor_total` a cada mudança em itens).
8. Substituir trigger antigo `sync_obra_status_from_orcamento` por versão atualizada que usa os campos novos.
9. `ALTER TABLE compradores` adicionando `endereco`, `cidade`, `estado` (e-mail/telefone já existem).
10. Índices novos.

## Código frontend

- `src/types/servicos.ts` (tipos)
- `src/pages/Servicos.tsx` — lista estilo Omie (tabela densa, filtros, paginação, painel lateral).
- `src/components/servicos/ServicoDetalhePanel.tsx` — painel lateral de detalhe.
- `src/components/servicos/ServicoFormDialog.tsx` — substitui o existente, com abas (Serviço, Impostos, Descrição).
- `src/pages/Orcamentos.tsx` — lista com chips de status, busca, totais.
- `src/components/orcamentos/OrcamentoFormDialog.tsx` — substitui o existente, com abas (Cliente, Itens, Pagamento, Observações) e itens vinculados ao catálogo de serviços.
- `src/components/orcamentos/OrcamentoDetalheSheet.tsx` — sheet de detalhe + ações (enviar, aprovar, reprovar, baixar PDF).
- `src/lib/orcamento-pdf.ts` — PDF formatado nível Omie com jsPDF + autoTable (lib já está no projeto).
- Atualizar `OrcamentoDetailSheet.tsx` existente (renomear/redirecionar para o novo Sheet) e remover imports quebrados.
- `usePermissions` + sidebar: garantir que `categorias_servico` está atrelado à permissão `servicos`.

## Detalhes técnicos
- Tokens HSL/semânticos no lugar das cores hex hardcoded do prompt.
- `useAuth().empresaId` já existe no projeto.
- `formatCurrency` está em `@/lib/obra-helpers` (não em `@/lib/utils`) — vou ajustar imports.
- Datas usando `@/lib/date.ts` (helpers do projeto p/ evitar shift de fuso).
- `jspdf` + `jspdf-autotable` precisam ser instalados (verificar `package.json`).

## Riscos
- Backfill de `numero` em orçamentos antigos: vou gerar `ORC-YYYY-0001`, `0002`… ordenado por `created_at` por empresa.
- Trigger `recalc_totais_orcamento` substitui o `recalculate_orcamento_total` existente — comportamento equivalente, sem risco.
- A coluna `subtotal` em `orcamento_itens` hoje é nullable normal; transformar em `GENERATED` exige drop+recreate. Não há perda (é derivada).

## Ordem de execução
1. Migration única (com backfill).
2. Após aprovação da migration: instalar `jspdf`/`jspdf-autotable` se faltar.
3. Criar types + páginas + componentes + PDF em paralelo.
4. Atualizar rotas/sidebar se necessário (provavelmente já estão).
