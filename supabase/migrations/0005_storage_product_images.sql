-- 0005_storage_product_images.sql
-- Cria bucket de imagens e políticas de acesso para uploads via app

begin;

-- Criar bucket 'product-images' se não existir
insert into storage.buckets (id, name, public)
select 'product-images', 'product-images', true
where not exists (
  select 1 from storage.buckets where id = 'product-images'
);

-- Políticas em storage.objects
-- Leitura pública das imagens do bucket
drop policy if exists "Public read product-images" on storage.objects;
create policy "Public read product-images" on storage.objects
for select
using ( bucket_id = 'product-images' );

-- Upload permitido a usuários autenticados
drop policy if exists "Authenticated insert product-images" on storage.objects;
create policy "Authenticated insert product-images" on storage.objects
for insert to authenticated
with check ( bucket_id = 'product-images' );

-- Atualização permitida somente ao dono do objeto
drop policy if exists "Authenticated update own product-images" on storage.objects;
create policy "Authenticated update own product-images" on storage.objects
for update to authenticated
using ( bucket_id = 'product-images' and owner = auth.uid() )
with check ( bucket_id = 'product-images' and owner = auth.uid() );

-- Exclusão permitida somente ao dono do objeto
drop policy if exists "Authenticated delete own product-images" on storage.objects;
create policy "Authenticated delete own product-images" on storage.objects
for delete to authenticated
using ( bucket_id = 'product-images' and owner = auth.uid() );

commit;