# Plano de execução

Registro do que foi entregue por etapa, em ordem de execução.

## Etapa 4 — Insumos, composições e cronograma de Gantt

Módulos: `orcamento_composicoes` e `cronograma`, ligados por padrão apenas no perfil **obra própria**.

| Item | Situação | Onde |
| --- | --- | --- |
| 4.1 Insumos + histórico de preços | pronto | tabelas `insumos`, `insumo_precos`; tela `/insumos` |
| 4.2 Composições e subcomposições (5 níveis, sem ciclo) | pronto | `composicoes`, `composicao_itens`; RPC `recalcular_composicao`; tela `/composicoes` |
| 4.3 Importação por planilha com conferência | pronto | `src/lib/base-custos.ts`, `ImportarBaseDialog`, RPC `importar_insumos`, tabela `importacoes_referencia` |
| 4.4 Orçamento com composição e atualizar preços | pronto | `orcamento_itens.insumo_id/composicao_id/preco_base/preco_aplicado` |
| 4.5 Gantt, dependências, caminho crítico, curva S, exportação | pronto | `cronograma_etapas` (datas, duração, % realizado), `cronograma_dependencias`; `src/lib/gantt.ts`; tela `/cronograma` |
| 4.6 Isolamento, README e testes de cálculo | pronto | `supabase/tests/isolamento.sql` (por introspecção), README, `src/lib/base-custos.test.ts` |

## Etapa 5 — Inteligência artificial (módulo `ia`, desligado por padrão)

| Item | Situação | Onde |
| --- | --- | --- |
| 5.1 Assistente de orçamento por m² | pronto | `custos_referencia_m2`; aba "Estimativa de orçamento" em `/ia` |
| 5.2 Leitura de cotação (PDF ou foto) | pronto | aba "Ler cotação" em `/ia` |
| 5.3 Relatório do período a partir do diário | pronto | aba "Relatório do período" em `/ia` |
| 5.4 Privacidade, auditoria, consumo e rascunho | pronto | edge function `ia-assistente`; `ia_usos`; `audit_log`; RPC `ia_consumo_mes`; marca "rascunho gerado por IA" |

Chaves por empresa em `empresa_config`: `ia_orcamento`, `ia_cotacao`, `ia_diario`.
Chave da API fica só no servidor (`LOVABLE_API_KEY`), nunca no navegador.

## Verificações desta entrega

- `tsgo --noEmit` — sem erros
- `eslint` nos arquivos novos — sem apontamentos
- `vitest` — 43 testes, todos passando
- `vite build` — concluído
- Isolamento: o teste é por introspecção, então as tabelas novas entram sozinhas no catálogo

## Fora de escopo / pendente de decisão

- Exportação do Gantt em PDF: hoje sai em imagem (PNG). Fazer o PDF com logo exige definir o formato da folha.
- Nenhuma tabela pública de preços (SINAPI etc.) é distribuída com o sistema: a base vem sempre da planilha que a empresa carrega.
- O custo estimado por pedido de IA usa um valor médio por token; o número exato depende do modelo contratado.
