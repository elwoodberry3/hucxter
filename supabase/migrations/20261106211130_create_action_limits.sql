-- Per-account action limits (Brief 03C.1 §3.6; hucxter-trust-safety "Rate limits"). The values are
-- data in action_limit_config, so they can be tuned by a migration without code changes. Accounts
-- younger than new_account_days get the stricter limit. Over the limit, the caller gets the seconds
-- to wait (apps/web answers 429 with Retry-After).
--
-- Recovery: additive. `drop function public.action_limit_take(uuid, text); drop table
-- public.action_attempts, public.action_limit_config;`

create table public.action_limit_config (
  action text primary key check (action ~ '^[a-z_]{1,40}$'),
  window_seconds int not null check (window_seconds > 0),
  per_window int not null check (per_window > 0),
  new_account_per_window int not null check (new_account_per_window > 0),
  new_account_days int not null check (new_account_days >= 0)
);

-- Chair defaults (Founder to tune): listings 10/day (3 for accounts < 7 days), uploads 10/hour (4),
-- reports 20/day (5).
insert into public.action_limit_config values
  ('listing_create', 86400, 10, 3, 7),
  ('upload_create', 3600, 10, 4, 7),
  ('report_create', 86400, 20, 5, 7);

create table public.action_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null references public.action_limit_config (action),
  created_at timestamptz not null default now()
);

create index action_attempts_user_idx on public.action_attempts (user_id, action, created_at desc);

alter table public.action_limit_config enable row level security;
alter table public.action_attempts enable row level security;
revoke all on public.action_limit_config, public.action_attempts from anon, authenticated, service_role;
grant select on public.action_limit_config, public.action_attempts to service_role;
grant delete on public.action_attempts to service_role;

-- Records the action if allowed and returns 0, else the seconds until it is allowed again.
create or replace function public.action_limit_take(p_user_id uuid, p_action text)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_config public.action_limit_config;
  v_created timestamptz;
  v_limit int;
  v_count int;
  v_oldest timestamptz;
begin
  select * into v_config from public.action_limit_config where action = p_action;
  if not found or p_user_id is null then
    raise exception 'unknown action or user' using errcode = 'invalid_parameter_value';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('action:' || p_user_id::text || ':' || p_action, 0));
  select created_at into v_created from auth.users where id = p_user_id;
  v_limit := case
    when v_created > now() - make_interval(days => v_config.new_account_days)
      then v_config.new_account_per_window
    else v_config.per_window
  end;
  select count(*), min(created_at) into v_count, v_oldest
  from public.action_attempts
  where user_id = p_user_id and action = p_action
    and created_at > now() - make_interval(secs => v_config.window_seconds);
  if v_count >= v_limit then
    return greatest(1, ceil(extract(epoch from
      (v_oldest + make_interval(secs => v_config.window_seconds)) - now()))::int);
  end if;
  insert into public.action_attempts (user_id, action) values (p_user_id, p_action);
  return 0;
end;
$$;

revoke execute on function public.action_limit_take(uuid, text) from public, anon, authenticated;
grant execute on function public.action_limit_take(uuid, text) to service_role;
