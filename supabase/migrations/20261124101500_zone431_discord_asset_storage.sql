alter table public.department_discord_webhooks
  add column if not exists embed_author_icon_url text not null default '';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'zone431-discord-assets',
  'zone431-discord-assets',
  true,
  5242880,
  array['image/png','image/jpeg','image/webp','image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Zone431 staff can upload Discord assets') then
    create policy "Zone431 staff can upload Discord assets"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'zone431-discord-assets'
        and public.has_staff_module_permission('discord_notifications', 'write', null, null)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Zone431 staff can delete Discord assets') then
    create policy "Zone431 staff can delete Discord assets"
      on storage.objects for delete to authenticated
      using (
        bucket_id = 'zone431-discord-assets'
        and public.has_staff_module_permission('discord_notifications', 'write', null, null)
      );
  end if;
end $$;