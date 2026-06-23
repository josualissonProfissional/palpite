-- Bucket público para fotos dos jogadores no Supabase Storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('player-photos', 'player-photos', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Qualquer pessoa pode ler as fotos (bucket público)
create policy "Fotos públicas dos jogadores"
  on storage.objects
  for select
  using (bucket_id = 'player-photos');

-- Apenas service_role pode inserir/atualizar/deletar
create policy "Service role gerencia fotos"
  on storage.objects
  for insert
  with check (bucket_id = 'player-photos' and auth.role() = 'service_role');

create policy "Service role atualiza fotos"
  on storage.objects
  for update
  using (bucket_id = 'player-photos' and auth.role() = 'service_role');

create policy "Service role deleta fotos"
  on storage.objects
  for delete
  using (bucket_id = 'player-photos' and auth.role() = 'service_role');
