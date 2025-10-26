-- Define defaults para colunas id quando ausentes

-- clients.id
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='clients' and column_name='id' and data_type='uuid'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='clients' and column_name='id' and column_default is null
    ) then
      execute 'alter table public.clients alter column id set default gen_random_uuid()';
    end if;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='clients' and column_name='id' and data_type='text'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='clients' and column_name='id' and column_default is null
    ) then
      execute 'alter table public.clients alter column id set default gen_random_uuid()::text';
    end if;
  end if;
end
$$;

-- client_vehicles.id
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='client_vehicles' and column_name='id' and data_type='uuid'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='client_vehicles' and column_name='id' and column_default is null
    ) then
      execute 'alter table public.client_vehicles alter column id set default gen_random_uuid()';
    end if;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='client_vehicles' and column_name='id' and data_type='text'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='client_vehicles' and column_name='id' and column_default is null
    ) then
      execute 'alter table public.client_vehicles alter column id set default gen_random_uuid()::text';
    end if;
  end if;
end
$$;