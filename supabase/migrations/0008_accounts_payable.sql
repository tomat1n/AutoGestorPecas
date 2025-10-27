-- 0008_accounts_payable.sql
-- Tabela de contas a pagar para integração com dashboard

begin;

-- Criar tabela accounts_payable
create table if not exists public.accounts_payable (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid,
  supplier_name text not null,
  description text not null,
  original_value numeric(12,2) not null default 0,
  paid_value numeric(12,2) not null default 0,
  due_date date not null,
  issue_date date,
  document_number text,
  category text default 'compra',
  priority text default 'medium' check (priority in ('low', 'medium', 'high')),
  status text default 'pending' check (status in ('pending', 'overdue', 'partial', 'paid')),
  observations text,
  days_until_due integer,
  paid_date date,
  payment_method text,
  payment_observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger para updated_at
create trigger accounts_payable_set_updated_at
  before update on public.accounts_payable
  for each row execute function public.set_updated_at();

-- Índices para performance
create index if not exists idx_accounts_payable_due_date on public.accounts_payable (due_date);
create index if not exists idx_accounts_payable_status on public.accounts_payable (status);
create index if not exists idx_accounts_payable_supplier on public.accounts_payable (supplier_name);
create index if not exists idx_accounts_payable_created_at on public.accounts_payable (created_at);

-- Tabela de pagamentos (para histórico detalhado)
create table if not exists public.payable_payments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts_payable(id) on delete cascade,
  payment_value numeric(12,2) not null,
  payment_date date not null,
  payment_method text,
  receipt_number text,
  observations text,
  created_at timestamptz not null default now()
);

-- Índices para payable_payments
create index if not exists idx_payable_payments_account_id on public.payable_payments (account_id);
create index if not exists idx_payable_payments_date on public.payable_payments (payment_date);

-- RLS (Row Level Security)
alter table public.accounts_payable enable row level security;
alter table public.payable_payments enable row level security;

-- Políticas RLS (permitir tudo para usuários autenticados)
create policy "Enable all operations for authenticated users" on public.accounts_payable
  for all using (auth.role() = 'authenticated');

create policy "Enable all operations for authenticated users" on public.payable_payments
  for all using (auth.role() = 'authenticated');

-- Dados de exemplo
insert into public.accounts_payable (supplier_name, description, original_value, paid_value, due_date, issue_date, document_number, category, priority, status, observations) values
('Moura Baterias', 'Compra de bateria 60Ah', 520.00, 200.00, current_date + interval '3 days', current_date - interval '2 days', 'NF-1001', 'compra', 'medium', 'partial', ''),
('Cobreq', 'Pastilhas de freio', 780.00, 0, current_date - interval '1 day', current_date - interval '10 days', 'NF-0993', 'compra', 'high', 'overdue', 'Negociar prazo'),
('Mahle', 'Filtros de ar', 260.00, 260.00, current_date - interval '2 days', current_date - interval '12 days', 'NF-0981', 'compra', 'low', 'paid', 'Pago via PIX'),
('Bosch', 'Velas de ignição', 180.00, 0, current_date + interval '15 days', current_date, 'NF-1010', 'compra', 'medium', 'pending', ''),
('NGK', 'Cabos de vela', 320.00, 100.00, current_date + interval '7 days', current_date - interval '1 day', 'NF-1005', 'compra', 'medium', 'partial', 'Pagamento parcial');

commit;