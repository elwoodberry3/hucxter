-- Roles (Brief 03 · 3B, hucxter-trust-safety). Members can read their own roles; nobody writes
-- roles through the API. The first admin is granted by SQL (docs/runbooks/accounts.md §3).
-- Recovery: additive. `drop function public.has_role(public.app_role); drop table public.app_roles;
-- drop type public.app_role;`

create type public.app_role as enum ('user', 'moderator', 'admin');

create table public.app_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id) on delete set null,
  primary key (user_id, role)
);

comment on table public.app_roles is
  'Staff roles. Read own rows only; written by SQL/service role, never by anon or authenticated.';

create index app_roles_granted_by_idx on public.app_roles (granted_by);

alter table public.app_roles enable row level security;

revoke all on public.app_roles from anon, authenticated;
grant select on public.app_roles to authenticated;

create policy app_roles_select_own
  on public.app_roles
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- True when the caller holds the role. Invoker rights: RLS limits it to the caller's own rows.
create or replace function public.has_role(p_role public.app_role)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.app_roles where user_id = auth.uid() and role = p_role
  );
$$;

revoke execute on function public.has_role(public.app_role) from public, anon;
grant execute on function public.has_role(public.app_role) to authenticated;
