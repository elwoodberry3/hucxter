-- Profile bio and photo path (Brief 03C.2 §4.4, §4.5; D-44 decided 2026-11-07).
-- bio: optional plain text, 0–150 characters, at most 3 line breaks, no links, emails, phone
-- numbers or blocked terms (mirrors Bio in packages/contracts/src/account.ts). Members update it
-- through apps/web server code (session client under RLS), like display_name.
-- avatar_path: "<uuid>.webp" in the public `avatars` bucket. Written only by the service role
-- (profile_set_avatar), never directly by members.
--
-- Recovery: additive. `revoke update (bio) on public.profiles from authenticated;
-- alter table public.profiles drop column bio, drop column avatar_path;`

alter table public.profiles
  add column bio text not null default '' check (
    char_length(bio) <= 150
    and bio = btrim(bio, E' \n\t')
    and replace(bio, E'\n', '') !~ '[[:cntrl:]]'
    and char_length(bio) - char_length(replace(bio, E'\n', '')) <= 3
    and bio !~ '@'
    and bio !~* '(://|www\.|\.(com|net|org|io|app|co|me|ly|gg|tv|us|info|biz)(\M|$))'
    and bio !~* '([0-9][^0-9a-z]{0,3}){7}'
    and bio !~* '(hucxter|admin|support|official)'
  ),
  add column avatar_path text check (
    avatar_path is null
    or avatar_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
  );

comment on column public.profiles.bio is 'Public bio (plain text, 0–150 characters).';
comment on column public.profiles.avatar_path is
  'Object name in the public avatars bucket; written only by the service role.';

grant update (bio) on public.profiles to authenticated;
