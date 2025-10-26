-- Baseline de clientes e veículos (idempotente)

-- Extensões e função de atualização de timestamp
create extension if not exists pgcrypto;
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Tabela clients
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('PF','PJ')),
  doc text not null,
  phone text not null,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices clients
do $$ begin
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='clients_doc_key') then
    execute 'create unique index clients_doc_key on public.clients (doc)';
  end if;
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='idx_clients_name') then
    execute 'create index idx_clients_name on public.clients (name)';
  end if;
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='idx_clients_phone') then
    execute 'create index idx_clients_phone on public.clients (phone)';
  end if;
end $$;

-- Trigger updated_at clients
do $$ begin
  if not exists (
    select 1 from information_schema.triggers
    where event_object_table='clients' and trigger_name='trg_clients_updated_at'
  ) then
    create trigger trg_clients_updated_at before update on public.clients
    for each row execute procedure set_updated_at();
  end if;
end $$;

-- Tabela client_vehicles
create table if not exists public.client_vehicles (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  plate text not null,
  model text not null,
  year int,
  color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- FK client_vehicles -> clients (idempotente)
do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_name='client_vehicles' and constraint_name='client_vehicles_client_id_fkey'
  ) then
    alter table public.client_vehicles
    add constraint client_vehicles_client_id_fkey
    foreign key (client_id) references public.clients(id) on delete cascade;
  end if;
end $$;

-- Índices client_vehicles
do $$ begin
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='client_vehicles_client_id_plate_key') then
    execute 'create unique index client_vehicles_client_id_plate_key on public.client_vehicles (client_id, plate)';
  end if;
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='idx_vehicles_plate') then
    execute 'create index idx_vehicles_plate on public.client_vehicles (plate)';
  end if;
end $$;

-- Trigger updated_at client_vehicles
do $$ begin
  if not exists (
    select 1 from information_schema.triggers
    where event_object_table='client_vehicles' and trigger_name='trg_client_vehicles_updated_at'
  ) then
    create trigger trg_client_vehicles_updated_at before update on public.client_vehicles
    for each row execute procedure set_updated_at();
  end if;
end $$;

-- RLS e Policies (idempotente)
-- Garantir colunas necessárias quando as tabelas já existem
alter table public.clients add column if not exists is_active boolean not null default true;
alter table public.clients add column if not exists updated_at timestamptz not null default now();
alter table public.clients add column if not exists created_at timestamptz not null default now();
-- Padronização: coluna de documento
alter table public.clients add column if not exists doc text;

alter table public.client_vehicles add column if not exists is_active boolean not null default true;
alter table public.client_vehicles add column if not exists updated_at timestamptz not null default now();
alter table public.client_vehicles add column if not exists created_at timestamptz not null default now();

alter table public.clients enable row level security;
alter table public.client_vehicles enable row level security;

-- Drop policies existentes para recriar de forma idempotente
drop policy if exists clients_select_auth on public.clients;
drop policy if exists clients_insert_auth on public.clients;
drop policy if exists clients_update_auth on public.clients;
drop policy if exists clients_delete_auth on public.clients;

create policy clients_select_auth on public.clients for select to authenticated using ( is_active );
create policy clients_insert_auth on public.clients for insert to authenticated with check ( is_active );
create policy clients_update_auth on public.clients for update to authenticated using ( is_active ) with check ( is_active );
create policy clients_delete_auth on public.clients for delete to authenticated using ( is_active );

-- Vehicles
drop policy if exists client_vehicles_select_auth on public.client_vehicles;
drop policy if exists client_vehicles_insert_auth on public.client_vehicles;
drop policy if exists client_vehicles_update_auth on public.client_vehicles;
drop policy if exists client_vehicles_delete_auth on public.client_vehicles;

create policy client_vehicles_select_auth on public.client_vehicles for select to authenticated using ( is_active );
create policy client_vehicles_insert_auth on public.client_vehicles for insert to authenticated with check ( is_active );
create policy client_vehicles_update_auth on public.client_vehicles for update to authenticated using ( is_active ) with check ( is_active );
create policy client_vehicles_delete_auth on public.client_vehicles for delete to authenticated using ( is_active );