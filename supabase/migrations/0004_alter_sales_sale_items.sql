-- 0004_alter_sales_sale_items.sql
-- Ajustes de colunas para alinhar PDV: sales e sale_items

begin;

-- SALES: adicionar colunas necessárias se não existirem
alter table public.sales
  add column if not exists subtotal numeric(12,2) not null default 0,
  add column if not exists discount numeric(12,2) not null default 0,
  add column if not exists total numeric(12,2) not null default 0,
  add column if not exists payment_method text,
  add column if not exists thermal_doc_url text,
  add column if not exists a4_doc_url text,
  add column if not exists pdf_doc_url text;

-- SALE_ITEMS: adicionar colunas necessárias se não existirem
alter table public.sale_items
  add column if not exists item_type text,
  add column if not exists product_id text,
  add column if not exists service_id uuid,
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists quantity numeric(12,2) not null default 1,
  add column if not exists unit_price numeric(12,2) not null default 0,
  add column if not exists line_total numeric(12,2) not null default 0;

-- STOCK_MOVEMENTS: garantir campos usados pelo app
alter table public.stock_movements
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists notes text;

commit;