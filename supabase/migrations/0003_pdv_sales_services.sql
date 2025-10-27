-- 0003_pdv_sales_services.sql
-- PDV: Produtos, Serviços, Carrinho, Ordens de Serviço, Vendas
-- Idempotente: cria tabelas/índices/policies apenas se não existirem

begin;

-- Habilita extensão para UUID se ainda não
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- =========================================================
-- TABELA: products (referenciada pelo inventário e PDV)
-- =========================================================
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  barcode text unique,
  price numeric(12,2) not null default 0,
  cost_price numeric(12,2) default 0,
  markup_percent numeric(5,2) default 0,
  stock integer not null default 0,
  min_stock integer default 0,
  image_url text,
  category text,
  brand text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger de updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- =========================================================
-- TABELA: services
-- =========================================================
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text,
  price numeric(12,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

-- Índices auxiliares
create index if not exists idx_services_name on public.services (name);
create index if not exists idx_services_category on public.services (category);

-- =========================================================
-- TABELAS: service_orders (OS), os_services, os_parts
-- =========================================================
create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid,
  client_name text,
  client_document text,
  client_phone text,
  client_email text,
  vehicle_plate text,
  vehicle_model text,
  vehicle_year integer,
  vehicle_color text,
  vehicle_km integer,
  vehicle_chassis text,
  status text not null default 'pending',
  total_amount numeric(12,2) not null default 0,
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger service_orders_set_updated_at
  before update on public.service_orders
  for each row execute function public.set_updated_at();

create index if not exists idx_service_orders_status on public.service_orders (status);
create index if not exists idx_service_orders_created_at on public.service_orders (created_at);

create table if not exists public.os_services (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  service_id uuid,
  service_name text not null,
  price numeric(12,2) not null default 0,
  quantity numeric(12,2) not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists idx_os_services_order on public.os_services (service_order_id);

create table if not exists public.os_parts (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  product_id text,
  part_name text not null,
  price numeric(12,2) not null default 0,
  quantity numeric(12,2) not null default 1,
  stock_used boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_os_parts_order on public.os_parts (service_order_id);

-- =========================================================
-- TABELAS: sales, sale_items
-- =========================================================
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  client_id uuid,
  client_name text,
  client_document text,
  client_phone text,
  client_email text,
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  payment_method text,
  status text not null default 'completed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  thermal_doc_url text,
  a4_doc_url text,
  pdf_doc_url text
);

create trigger sales_set_updated_at
  before update on public.sales
  for each row execute function public.set_updated_at();

create index if not exists idx_sales_created_at on public.sales (created_at);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  item_type text not null check (item_type in ('product','service')),
  product_id text,
  service_id uuid,
  name text not null,
  description text,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_sale_items_sale on public.sale_items (sale_id);

-- =========================================================
-- TABELA: stock_movements (movimentação de estoque)
-- =========================================================
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  quantity integer not null,
  type text not null check (type in ('sale','return','adjustment')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_stock_movements_product on public.stock_movements (product_id);
create index if not exists idx_stock_movements_created on public.stock_movements (created_at);

-- =========================================================
-- Row Level Security (RLS) básico para todas as tabelas
-- =========================================================
alter table public.products enable row level security;
alter table public.services enable row level security;
alter table public.service_orders enable row level security;
alter table public.os_services enable row level security;
alter table public.os_parts enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.stock_movements enable row level security;

-- Policies simples: qualquer usuário autenticado pode ler/escrever
-- OBS: ajuste conforme sua necessidade de segurança
create policy if not exists products_select_auth on public.products for select using (auth.uid() is not null);
create policy if not exists products_insert_auth on public.products for insert with check (auth.uid() is not null);
create policy if not exists products_update_auth on public.products for update using (auth.uid() is not null);

create policy if not exists services_select_auth on public.services for select using (auth.uid() is not null);
create policy if not exists services_insert_auth on public.services for insert with check (auth.uid() is not null);
create policy if not exists services_update_auth on public.services for update using (auth.uid() is not null);

create policy if not exists service_orders_select_auth on public.service_orders for select using (auth.uid() is not null);
create policy if not exists service_orders_insert_auth on public.service_orders for insert with check (auth.uid() is not null);
create policy if not exists service_orders_update_auth on public.service_orders for update using (auth.uid() is not null);

create policy if not exists os_services_select_auth on public.os_services for select using (auth.uid() is not null);
create policy if not exists os_services_insert_auth on public.os_services for insert with check (auth.uid() is not null);
create policy if not exists os_services_update_auth on public.os_services for update using (auth.uid() is not null);

create policy if not exists os_parts_select_auth on public.os_parts for select using (auth.uid() is not null);
create policy if not exists os_parts_insert_auth on public.os_parts for insert with check (auth.uid() is not null);
create policy if not exists os_parts_update_auth on public.os_parts for update using (auth.uid() is not null);

create policy if not exists sales_select_auth on public.sales for select using (auth.uid() is not null);
create policy if not exists sales_insert_auth on public.sales for insert with check (auth.uid() is not null);
create policy if not exists sales_update_auth on public.sales for update using (auth.uid() is not null);

create policy if not exists sale_items_select_auth on public.sale_items for select using (auth.uid() is not null);
create policy if not exists sale_items_insert_auth on public.sale_items for insert with check (auth.uid() is not null);
create policy if not exists sale_items_update_auth on public.sale_items for update using (auth.uid() is not null);

create policy if not exists stock_movements_select_auth on public.stock_movements for select using (auth.uid() is not null);
create policy if not exists stock_movements_insert_auth on public.stock_movements for insert with check (auth.uid() is not null);

commit;