-- Reports (Brief 03C.1 §3.6; hucxter-trust-safety). Targets are listings now and profiles from
-- 3C.2. target_id has no foreign key, so reports (and the moderation record) survive the target's
-- deletion (Founder amendment 2). Members file reports only through report_create() (M8) and can
-- read their own; admins act through service-role functions that write audit_log.
--
-- Recovery: additive. `drop table public.reports; drop type public.report_target,
-- public.report_reason;`

create type public.report_target as enum ('listing', 'profile');
create type public.report_reason as enum (
  'prohibited_item', 'scam', 'harassment', 'stolen_goods', 'counterfeit', 'unsafe_meetup',
  'minor_safety', 'other'
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users (id) on delete set null,
  target_type public.report_target not null,
  target_id uuid not null,
  reason public.report_reason not null,
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index reports_open_idx on public.reports (created_at) where status = 'open';
create index reports_target_idx on public.reports (target_type, target_id);
-- One open report per reporter and target.
create unique index reports_one_open_idx on public.reports (reporter_id, target_type, target_id)
  where status = 'open';

alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select (id, target_type, target_id, reason, status, created_at) on public.reports to authenticated;

create policy reports_select_own
  on public.reports
  for select
  to authenticated
  using (reporter_id = (select auth.uid()));
