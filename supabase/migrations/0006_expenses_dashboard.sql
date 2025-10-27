-- 0006_expenses_dashboard.sql
-- Criação da tabela de despesas para dashboard financeiro

begin;

-- =========================================================
-- TABELA: expenses (despesas)
-- =========================================================
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  category text,
  amount numeric(12,2) not null default 0,
  expense_date date not null default current_date,
  payment_method text,
  supplier_name text,
  document_number text,
  notes text,
  status text not null default 'paid' check (status in ('pending','paid','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger de updated_at
create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- Índices para performance
create index if not exists idx_expenses_date on public.expenses (expense_date);
create index if not exists idx_expenses_category on public.expenses (category);
create index if not exists idx_expenses_status on public.expenses (status);
create index if not exists idx_expenses_created_at on public.expenses (created_at);

-- =========================================================
-- Row Level Security (RLS)
-- =========================================================
alter table public.expenses enable row level security;

-- Policies: qualquer usuário autenticado pode ler/escrever
drop policy if exists expenses_select_auth on public.expenses;
drop policy if exists expenses_insert_auth on public.expenses;
drop policy if exists expenses_update_auth on public.expenses;
drop policy if exists expenses_delete_auth on public.expenses;

create policy expenses_select_auth on public.expenses for select using (auth.uid() is not null);
create policy expenses_insert_auth on public.expenses for insert with check (auth.uid() is not null);
create policy expenses_update_auth on public.expenses for update using (auth.uid() is not null);
create policy expenses_delete_auth on public.expenses for delete using (auth.uid() is not null);

-- =========================================================
-- Dados de exemplo para teste
-- =========================================================
insert into public.expenses (description, category, amount, expense_date, payment_method, supplier_name, notes)
values 
  ('Aluguel da oficina', 'Fixas', 2500.00, current_date - interval '15 days', 'Transferência', 'Imobiliária Santos', 'Aluguel mensal'),
  ('Energia elétrica', 'Fixas', 450.00, current_date - interval '10 days', 'Débito automático', 'CEMIG', 'Conta de luz'),
  ('Compra de ferramentas', 'Equipamentos', 1200.00, current_date - interval '5 days', 'Cartão', 'Ferramentas Ltda', 'Chaves de fenda e alicates'),
  ('Combustível', 'Variáveis', 180.00, current_date - interval '3 days', 'Dinheiro', 'Posto Shell', 'Abastecimento veículo empresa'),
  ('Material de limpeza', 'Variáveis', 85.00, current_date - interval '1 day', 'PIX', 'Supermercado ABC', 'Produtos de limpeza')
on conflict do nothing;

commit;