-- QA invite list (Brief 03 · 3B). With INVITE_ONLY=true, only these emails can finish sign-up.
-- Managed by SQL (docs/runbooks/accounts.md §4); invisible to anon and authenticated.
-- Two checks use it: current_user_invited() at onboarding (apps/web), and the before-user-created
-- Auth hook (enabled on the QA project in 3E; off locally so e2e can test the gate on and off).
-- Recovery: additive. `drop function public.hook_before_user_created(jsonb);
-- drop function public.current_user_invited(); drop table public.qa_invites;`

create table public.qa_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null check (
    char_length(email) <= 254 and email = btrim(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+$'
  ),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.qa_invites is
  'Closed-test invite list (emails, matched case-insensitively). No API access; SQL/service role only.';

create unique index qa_invites_email_lower_key on public.qa_invites (lower(email));
create index qa_invites_created_by_idx on public.qa_invites (created_by);

alter table public.qa_invites enable row level security;
revoke all on public.qa_invites from anon, authenticated;

-- Whether the signed-in caller's account email is invited. Boolean only; never exposes the list.
create or replace function public.current_user_invited()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join public.qa_invites i on lower(i.email) = lower(u.email)
    where u.id = auth.uid()
  );
$$;

revoke execute on function public.current_user_invited() from public, anon;
grant execute on function public.current_user_invited() to authenticated;

-- Supabase Auth "before user created" hook: rejects sign-ups whose email isn't invited.
-- https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook
-- Runs as supabase_auth_admin; returns {} to allow or {"error": {...}} with a 403 to reject.
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
begin
  if v_email <> '' and exists (select 1 from public.qa_invites where lower(email) = v_email) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'error',
    jsonb_build_object(
      'http_code', 403,
      'message', 'Hucxter is in a closed test. Ask the team for an invite.'
    )
  );
end;
$$;

revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
