-- ===== PLANOS (catálogo público) =====
create table public.planos (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nome text not null,
  descricao text,
  preco_mensal numeric(10,2) not null default 0,
  preco_anual numeric(10,2) not null default 0,
  paddle_price_id_mensal text,
  paddle_price_id_anual text,
  limite_obras integer,
  limite_usuarios integer,
  recursos jsonb not null default '[]'::jsonb,
  destaque boolean not null default false,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.planos enable row level security;

create policy "Planos são públicos para leitura"
  on public.planos for select using (ativo = true or public.is_super_admin(auth.uid()));

create policy "Apenas super_admin gerencia planos"
  on public.planos for all
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

create trigger update_planos_updated_at
  before update on public.planos
  for each row execute function public.update_updated_at_column();

-- Seed dos planos iniciais
insert into public.planos (slug, nome, descricao, preco_mensal, preco_anual, limite_obras, limite_usuarios, recursos, destaque, ordem) values
  ('basico',     'Básico',     'Para empresas pequenas começando agora',     149.00, 1490.00, 5,    5,    '["Gestão de obras","Equipes","Financeiro básico"]'::jsonb,                                       false, 1),
  ('pro',        'Pro',        'Para equipes em crescimento',                 349.00, 3490.00, 25,   20,   '["Tudo do Básico","Vistorias","Orçamentos","Recebimentos","Pedidos de compra","Suporte prioritário"]'::jsonb, true,  2),
  ('enterprise', 'Enterprise', 'Para grandes operações com necessidades específicas', 899.00, 8990.00, null, null, '["Tudo do Pro","Obras ilimitadas","Usuários ilimitados","SLA dedicado","Onboarding assistido"]'::jsonb, false, 3);

-- ===== ASSINATURAS (uma por empresa) =====
create type public.assinatura_status as enum ('trialing','active','past_due','paused','canceled','expired');
create type public.assinatura_periodo as enum ('mensal','anual');

create table public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null unique references public.empresas(id) on delete cascade,
  plano_id uuid references public.planos(id) on delete restrict,
  status public.assinatura_status not null default 'trialing',
  periodo public.assinatura_periodo not null default 'mensal',
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  paddle_customer_id text,
  paddle_subscription_id text unique,
  paddle_transaction_id text,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assinaturas enable row level security;

create policy "Empresa vê sua assinatura"
  on public.assinaturas for select
  using (public.tenant_match(empresa_id));

create policy "Super admin gerencia assinaturas"
  on public.assinaturas for all
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

create trigger update_assinaturas_updated_at
  before update on public.assinaturas
  for each row execute function public.update_updated_at_column();

create index idx_assinaturas_empresa on public.assinaturas(empresa_id);
create index idx_assinaturas_paddle_sub on public.assinaturas(paddle_subscription_id);

-- ===== BILLING EVENTS (log de webhooks) =====
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  event_id text unique,
  event_type text not null,
  empresa_id uuid references public.empresas(id) on delete set null,
  paddle_subscription_id text,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.billing_events enable row level security;

create policy "Super admin vê billing events"
  on public.billing_events for select
  using (public.is_super_admin(auth.uid()));

create index idx_billing_events_empresa on public.billing_events(empresa_id);
create index idx_billing_events_sub on public.billing_events(paddle_subscription_id);

-- ===== Trigger: cria trial automático ao criar empresa =====
create or replace function public.criar_trial_para_empresa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plano_id uuid;
begin
  select id into v_plano_id from public.planos where slug = 'pro' limit 1;
  insert into public.assinaturas (empresa_id, plano_id, status, periodo, trial_ends_at)
  values (NEW.id, v_plano_id, 'trialing', 'mensal', now() + interval '14 days')
  on conflict (empresa_id) do nothing;
  return NEW;
end;
$$;

drop trigger if exists trg_criar_trial on public.empresas;
create trigger trg_criar_trial
  after insert on public.empresas
  for each row execute function public.criar_trial_para_empresa();

-- Backfill: cria trial para empresas existentes que ainda não têm assinatura
insert into public.assinaturas (empresa_id, plano_id, status, periodo, trial_ends_at)
select e.id,
       (select id from public.planos where slug = 'pro' limit 1),
       'trialing',
       'mensal',
       now() + interval '14 days'
from public.empresas e
left join public.assinaturas a on a.empresa_id = e.id
where a.id is null;

-- ===== Helper: assinatura está ativa? =====
create or replace function public.empresa_assinatura_ativa(_empresa_id uuid)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.assinaturas
    where empresa_id = _empresa_id
      and status in ('trialing','active','past_due')
      and (trial_ends_at is null or trial_ends_at > now() or status = 'active')
  );
$$;