-- Display names: 25 characters at most (Brief 03C.2 §4.4) and none of the blocked terms
-- (hucxter, admin, support, official; Founder amendment 2, 2026-11-07). The only exception is the
-- system placeholder "Hucxter member", allowed only while name_reset_required_at is set — a column
-- members can't write, so only staff moderation (admin_profile_action) can produce it.
-- The original 2–40 CHECK from create_profiles stays; this adds the stricter rules.
--
-- Existing rows: the constraint is added NOT VALID and validated only when no row breaks it.
-- Otherwise a NOTICE reports the counts (never the values) and the constraint stays NOT VALID:
-- existing names are kept, but any later UPDATE of such a row must fix the name first. Count
-- query for QA: docs/runbooks/accounts.md.
--
-- Recovery: additive. `alter table public.profiles drop constraint profiles_display_name_rules;`

alter table public.profiles
  add constraint profiles_display_name_rules check (
    display_name is null
    or (char_length(display_name) <= 25 and display_name !~* '(hucxter|admin|support|official)')
    or (display_name = 'Hucxter member' and name_reset_required_at is not null)
  ) not valid;

do $$
declare
  v_long int;
  v_blocked int;
begin
  select
    count(*) filter (where char_length(display_name) > 25),
    count(*) filter (where display_name ~* '(hucxter|admin|support|official)')
  into v_long, v_blocked
  from public.profiles
  where display_name is not null;
  if v_long = 0 and v_blocked = 0 then
    alter table public.profiles validate constraint profiles_display_name_rules;
  else
    raise notice 'profiles_display_name_rules left NOT VALID: % names over 25 characters, % with a blocked term',
      v_long, v_blocked;
  end if;
end;
$$;
