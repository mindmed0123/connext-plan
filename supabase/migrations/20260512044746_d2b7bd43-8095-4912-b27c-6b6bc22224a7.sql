
insert into storage.buckets (id, name, public)
values ('empresa-logos', 'empresa-logos', true)
on conflict (id) do nothing;

create policy "Logos públicas para leitura"
on storage.objects for select
using (bucket_id = 'empresa-logos');

create policy "Empresa faz upload da própria logo"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'empresa-logos'
  and (storage.foldername(name))[1] = get_user_empresa_id()::text
);

create policy "Empresa atualiza própria logo"
on storage.objects for update to authenticated
using (
  bucket_id = 'empresa-logos'
  and (storage.foldername(name))[1] = get_user_empresa_id()::text
);

create policy "Empresa remove própria logo"
on storage.objects for delete to authenticated
using (
  bucket_id = 'empresa-logos'
  and (storage.foldername(name))[1] = get_user_empresa_id()::text
);
