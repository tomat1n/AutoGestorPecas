-- 0007_fix_sales_status_column.sql
-- Garantir que a coluna status existe na tabela sales

begin;

-- Adicionar coluna status se não existir
alter table public.sales
  add column if not exists status text not null default 'completed';

-- Criar índice para performance se não existir
create index if not exists idx_sales_status on public.sales (status);

-- Atualizar registros existentes que possam ter status null
update public.sales 
set status = 'completed' 
where status is null;

commit;