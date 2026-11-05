-- Member profiles (Brief 03 · 3B, D-34). One row per auth user, created by a trigger on
-- auth.users. Members read and update their own row through apps/web server code (session client
-- under RLS); only display_name and home_zip are updatable directly. age_attested_at is set only
-- through attest_age(). Phone and email stay in auth.users and are never copied here.
-- Recovery: additive. `drop trigger on_auth_user_created on auth.users;
-- drop function public.handle_new_user(); drop function public.attest_age(); drop table public.profiles;`

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- First name or nickname: 2–40 characters, trimmed, and no URLs, emails, or phone numbers
  -- (mirrors DisplayName in packages/contracts).
  display_name text check (
    display_name is null
    or (
      char_length(display_name) between 2 and 40
      and display_name = btrim(display_name)
      and display_name !~ '[[:cntrl:]]'
      and display_name !~ '@'
      and display_name !~* '(://|www\.|\.(com|net|org|io|app|co|me|ly|gg|tv|us|info|biz)(\M|$))'
      and char_length(regexp_replace(display_name, '[^0-9]', '', 'g')) < 7
    )
  ),
  home_zip text references public.postal_areas (zip) on delete restrict,
  age_attested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.profiles is
  'Member profile (display name, home ZIP, 18+ attestation). No email, phone, or date of birth.';

create index profiles_home_zip_idx on public.profiles (home_zip);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, home_zip) on public.profiles to authenticated;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()) and deleted_at is null)
  with check (id = (select auth.uid()) and deleted_at is null);

-- Creates the profile row when Supabase Auth creates a user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- "I'm 18 or older." Records the first attestation time for the caller; idempotent.
create or replace function public.attest_age()
returns timestamptz
language sql
volatile
security definer
set search_path = ''
as $$
  update public.profiles
  set age_attested_at = coalesce(age_attested_at, now())
  where id = auth.uid() and deleted_at is null
  returning age_attested_at;
$$;

revoke execute on function public.attest_age() from public, anon;
grant execute on function public.attest_age() to authenticated;
