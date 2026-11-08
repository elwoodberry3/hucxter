-- Trickle mode ends 24 h after it starts (Brief 03C.1b trust-safety review M1). The daily count
-- included checks on trickle sessions, so an attacker using the one code per hour (2 checks
-- each, 48 a day) kept the count at 30 or more and every episode restarted the moment it ended:
-- new devices never left trickle mode, against the Founder's "no hard lockdown" amendment.
-- Only normal and overflow checks count now. Trickle checks stay bounded by the trickle spacing.
-- After an episode a new burst needs 30 fresh normal/overflow checks, which start the next
-- episode and its one audit alert. Bound: docs/runbooks/accounts.md §5.
--
-- Recovery: re-run email_code_daily_wrong from 20261108100000_cap_email_codes_daily.sql.

create or replace function public.email_code_daily_wrong(p_email_hash text)
returns int
language sql
stable
set search_path = ''
as $$
  select count(*)::int
  from public.email_code_checks k
  join public.email_code_sessions s on s.id = k.session_id
  where k.email_hash = p_email_hash and s.kind in ('normal', 'overflow')
    and k.created_at > now() - interval '24 hours'
$$;

revoke execute on function public.email_code_daily_wrong(text) from public, anon, authenticated, service_role;
