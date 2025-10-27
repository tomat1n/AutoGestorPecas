-- 0009_clean_test_data.sql
-- Limpeza dos dados de exemplo/teste das tabelas

begin;

-- Limpar dados de exemplo da tabela expenses
delete from public.expenses 
where description in (
  'Aluguel da oficina',
  'Energia elétrica', 
  'Compra de ferramentas',
  'Combustível',
  'Material de limpeza'
);

-- Limpar dados de exemplo da tabela accounts_payable
delete from public.accounts_payable 
where supplier_name in (
  'Moura Baterias',
  'Cobreq',
  'Mahle',
  'Bosch',
  'NGK'
);

commit;