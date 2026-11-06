-- Append-only audit log (Brief 03 · 3B; admin actions from 3C). Written only by apps/web server
-- code with the service role (account deletion now). No emails, phone numbers, or message bodies:
-- actor and target are ids. actor_id has no foreign key so entries survive account deletion.
-- Recovery: additive. `drop table public.audit_log; drop function public.audit_log_append_only();`

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null check (action ~ '^[a-z_]+(\.[a-z_]+)*$' and char_length(action) <= 80),
  target_type text check (target_type is null or target_type ~ '^[a-z_]{1,40}$'),
  target_id uuid,
  reason text check (reason is null or char_length(reason) <= 500),
  created_at timestamptz not null default now()
);

comment on table public.audit_log is
  'Append-only record of account and moderation actions (ids only, no PII). Service role inserts.';

create index audit_log_actor_id_idx on public.audit_log (actor_id, created_at desc);
create index audit_log_target_idx on public.audit_log (target_type, target_id);

alter table public.audit_log enable row level security;

revoke all on public.audit_log from anon, authenticated, service_role;
grant select, insert on public.audit_log to service_role;

-- Append-only, even for roles that bypass grants (e.g. the table owner).
create or replace function public.audit_log_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only' using errcode = 'insufficient_privilege';
end;
$$;

revoke execute on function public.audit_log_append_only() from public, anon, authenticated;

create trigger audit_log_no_update_delete
  before update or delete on public.audit_log
  for each row execute function public.audit_log_append_only();

create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.audit_log_append_only();
