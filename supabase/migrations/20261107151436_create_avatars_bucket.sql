-- Profile photos (Brief 03C.2 §4.5, D-44): a public `avatars` bucket. Objects are
-- `<uuid>.webp`, re-encoded on our server (EXIF/GPS stripped, 512×512), written only by the
-- service role from POST /api/profile/avatar. Public reads go through
-- /storage/v1/object/public/avatars/<name>; the random name is the only key.
-- No storage.objects policies for anon or authenticated: browsers can't upload, list, replace or
-- delete. Size and type are enforced by the route (5 MB in, JPEG/PNG/WebP), and the bucket
-- limits below repeat them where this Storage version has the columns.
--
-- Recovery: `delete from storage.objects where bucket_id = 'avatars';
-- delete from storage.buckets where id = 'avatars';` (deletes every profile photo; profiles keep
-- avatar_path values that then 404, so also `update public.profiles set avatar_path = null;`).

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types'
  ) then
    -- Stored objects are our 512×512 WebP output, far under 1 MB.
    execute $sql$
      update storage.buckets
      set file_size_limit = 1048576, allowed_mime_types = array['image/webp']
      where id = 'avatars'
    $sql$;
  end if;
end;
$$;
