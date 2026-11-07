-- Profile reports (Brief 03C.2 §4.2): members report a profile by @handle. The browser never
-- learns profile ids, so this resolves the handle on the server and applies report_create's rules
-- (verified member, one open report per target, the report_create rate limit). Members can't
-- report themselves.
--
-- Recovery: additive. `drop function public.report_profile(text, public.report_reason, text);`

create or replace function public.report_profile(
  p_handle text,
  p_reason public.report_reason,
  p_note text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_verified_member();
  v_target uuid;
begin
  select p.id into v_target from public.profiles p
  where p.handle = lower(btrim(p_handle)) and p.deleted_at is null and p.display_name is not null;
  if v_target is null or v_target = v_uid then
    return 'not_found';
  end if;
  return public.report_create('profile', v_target, p_reason, p_note);
end;
$$;

revoke execute on function public.report_profile(text, public.report_reason, text) from public, anon;
grant execute on function public.report_profile(text, public.report_reason, text) to authenticated;
