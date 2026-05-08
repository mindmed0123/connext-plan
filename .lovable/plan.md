
# Plano: Transformar em SaaS Multi-Empresa

Transformação grande e de alto risco — RLS muda em ~13 tabelas e altera a forma como TODOS os dados são consultados. Vou executar em fases incrementais, com aprovação de migration entre cada bloco.

## Fase 1 — Banco de dados (migrations)

### 1.1 — Estrutura base + tenancy
- Criar tabela `empresas` (nome, slug, logo_url, plano, ativo).
- Adicionar coluna `empresa_id uuid` (nullable inicialmente) em: `obras`, `pessoas`, `execucoes`, `contratacoes_terceirizado`, `materiais_obra`, `fotos_obra`, `vistorias`, `diario_obra`, `pedidos_compra`, `recebimentos`, `pessoa_permissoes`, `user_roles`, `orcamentos`, `notas_fiscais`, `rcs`, `parcelas_pagamento`, `obra_responsaveis`, `obra_timeline` (incluo as que faltaram na lista para evitar buracos no isolamento).
- Criar função `get_user_empresa_id()` SECURITY DEFINER.
- Atualizar `handle_new_user()` para NÃO atribuir mais super_admin/admin automaticamente baseado em e-mail (esse fluxo agora é via cadastro de empresa).

### 1.2 — Migrar dados existentes
- Inserir empresa "Potência Soluções" (slug `potencia`).
- `UPDATE` em todas as tabelas acima setando `empresa_id` para a empresa Potência.
- Tornar `empresa_id` `NOT NULL` em todas elas.

### 1.3 — Reescrever policies RLS
- Para cada tabela com `empresa_id`, dropar policies atuais e recriar combinando:
  - Permissão por módulo (mantém `has_permission` / `is_admin_or_super`) **E**
  - `empresa_id = get_user_empresa_id()`
- Super admin global (sem empresa) ignora filtro (vê tudo) — útil para o painel /admin.
- Atualizar `can_access_obra` para também checar empresa.

### 1.4 — Origens de obra dinâmicas
- Criar tabela `origens_obra` (empresa_id, nome) com RLS por empresa.
- Seed das origens "Veman" e "Sabesp" para a empresa Potência.
- (O enum `obra_origem` permanece no banco por compatibilidade; UI passa a usar a tabela. Migração total do enum fica fora do escopo desta fase para não quebrar dados existentes.)

## Fase 2 — Auth & Contexto (frontend)

- `AuthContext`: adicionar `empresaId` e `empresaNome`, buscar via `user_roles` + join `empresas` após login.
- `useUserRole`: incluir `empresa_id` no select e expor.
- Atualizar `RequirePermission` se necessário (não muda lógica, só consome contexto).

## Fase 3 — Tela de Auth

- Remover "Gestão de obras Sabesp / V&S" → "Gestão de Obras".
- Adicionar terceira aba "Cadastrar empresa":
  - Campos: nome empresa, nome usuário, email, senha.
  - Fluxo: `signUp` → criar `empresa` (slug auto a partir do nome) → criar `user_roles` (role `admin`, com empresa_id) → criar `pessoas` vinculando o user.
  - Como a sessão pode demorar a confirmar email, usar a sessão retornada do signUp para os inserts.

## Fase 4 — Origem dinâmica no formulário de obra

- `ObraFormDialog`: trocar Select hardcoded por query a `origens_obra` filtrada pela empresa.
- Salvar como texto livre na coluna `origem` (mantendo enum) — mapeio "Sabesp"/"Veman" para o enum quando bater, senão default `sabesp`. (Plano realista: para suportar nomes arbitrários precisaria converter a coluna `origem` para `text` — proponho fazer isso também na migration da fase 1.4.)

## Fase 5 — Painel Super Admin

- Página `/pages/Admin.tsx` lista empresas, ativar/desativar, plano.
- Rota protegida por `isSuperAdmin` global (super_admin sem empresa_id).
- Item "Admin" no `AppSidebar` visível só para super admin.

## Fase 6 — Convite de usuários

- `InviteUserDialog` em Equipes.
- Edge function `invite-user` (porque `auth.admin.inviteUserByEmail` exige service role — não pode rodar no client).
- Função: valida que o caller é admin da empresa, envia convite e cria `user_roles` + `pessoas` com `empresa_id`.

## Detalhes técnicos relevantes

- **handle_new_user** precisa ser atualizado: hoje promove `pedro@potenciasolucoes.com.br` a super_admin e o primeiro user a admin. Isso vira: NÃO criar role automaticamente — role é criada explicitamente pelo fluxo "cadastrar empresa" ou pelo convite. O Pedro continua super_admin via seed manual.
- **Super admin sem empresa**: `user_roles.empresa_id` será `NULL` para super_admin global. Policies precisam permitir esse caso (`empresa_id = get_user_empresa_id() OR is_super_admin(auth.uid())`).
- **Risco de quebra**: se algum INSERT no código não setar `empresa_id`, o RLS vai bloquear. Vou adicionar trigger `BEFORE INSERT` em cada tabela tenant que preenche `empresa_id` automaticamente com `get_user_empresa_id()` se vier NULL — assim o código existente continua funcionando sem alterações.
- **storage**: buckets continuam compartilhados; isolamento real exigiria prefixar paths por empresa. Fora do escopo desta fase (posso fazer depois se quiser).

## Ordem de execução

1. Migration grande (fases 1.1 → 1.4 num único arquivo) — pedir aprovação.
2. Editar `AuthContext`, `useUserRole`, `Auth.tsx`, `ObraFormDialog.tsx`.
3. Criar `Admin.tsx` + rota + sidebar.
4. Criar edge function `invite-user` + `InviteUserDialog`.

## Pergunta antes de começar

Confirma estes 3 pontos? Se sim, executo a migration da fase 1 imediatamente:

1. **Trigger automático de `empresa_id`** em INSERTs (recomendado — evita refatorar dezenas de arquivos).
2. **Coluna `origem` da tabela `obras`** vira `text` livre (em vez do enum) para suportar origens customizadas por empresa.
3. **Storage compartilhado** por enquanto (paths não serão prefixados por empresa nesta fase).
