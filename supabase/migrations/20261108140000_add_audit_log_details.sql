-- Name-reset audit details (Brief 03C.1b H9, PR #11 L6). "Require new name & handle" replaced the
-- member's display name and handle but the audit row kept only the staff reason, so nobody could
-- later see what was reset. audit_log gains `details` (a small jsonb object) and
-- admin_profile_action writes previous_display_name and previous_handle for that action.
-- Only public profile fields go in details, never emails or phone numbers. Retention (these
-- rows outlive account deletion) is a D-07 question: docs/decisions/open-decisions.md.
--
-- Recovery: re-run admin_profile_action from 20261107143553_create_profile_functions, then
-- `alter table public.audit_log drop column details;` (loses the stored previous names).

alter table public.audit_log
  add column details jsonb
    check (details is null or (jsonb_typeof(details) = 'object' and pg_column_size(details) < 2048));

comment on table public.audit_log is
  'Append-only record of account and moderation actions, read and written by the service role only: ids, a '
  'staff reason, and in details public profile fields only (e.g. a reset name); never emails or '
  'phone numbers. Service role inserts.';
comment on column public.audit_log.details is
  'Small jsonb object of public fields (e.g. previous_display_name, previous_handle on a name reset).';

create or replace function public.admin_profile_action(
  p_actor uuid,
  p_report_id uuid,
  p_action text,
  p_reason text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 500), '');
  v_report public.reports;
  v_profile public.profiles;
  v_old_path text;
begin
  perform public.assert_staff(p_actor);
  if v_reason is null then
    raise exception 'a reason is required' using errcode = 'invalid_parameter_value';
  end if;
  if p_action not in ('dismiss', 'remove_photo', 'clear_bio', 'require_new_name') then
    raise exception 'unknown action' using errcode = 'invalid_parameter_value';
  end if;
  select * into v_report from public.reports
  where id = p_report_id and target_type = 'profile' and status = 'open'
  for update;
  if not found then
    raise exception 'report not found' using errcode = 'no_data_found';
  end if;

  if p_action = 'dismiss' then
    update public.reports set status = 'dismissed', resolved_by = p_actor, resolved_at = now()
    where id = p_report_id;
    insert into public.audit_log (actor_id, action, target_type, target_id, reason)
    values (p_actor, 'report.dismissed', 'report', p_report_id, v_reason);
    return null;
  end if;

  select * into v_profile from public.profiles
  where id = v_report.target_id and deleted_at is null
  for update;
  if not found then
    raise exception 'profile not found' using errcode = 'no_data_found';
  end if;

  if p_action = 'remove_photo' then
    v_old_path := v_profile.avatar_path;
    update public.profiles set avatar_path = null where id = v_profile.id;
  elsif p_action = 'clear_bio' then
    update public.profiles set bio = '' where id = v_profile.id;
  else
    if v_profile.handle is not null then
      insert into public.handle_holds (handle, user_id, held_until, reason)
      values (v_profile.handle, null, now() + interval '30 days', 'moderation')
      on conflict (handle) do update
        set user_id = null, held_until = greatest(public.handle_holds.held_until, excluded.held_until),
            reason = 'moderation';
    end if;
    update public.profiles
    set display_name = 'Hucxter member', name_reset_required_at = now(),
        handle = public.handle_generate('')
    where id = v_profile.id;
  end if;

  update public.reports set status = 'actioned', resolved_by = p_actor, resolved_at = now()
  where id = p_report_id;
  insert into public.audit_log (actor_id, action, target_type, target_id, reason, details)
  values (
    p_actor,
    case p_action
      when 'remove_photo' then 'profile.photo_removed'
      when 'clear_bio' then 'profile.bio_cleared'
      else 'profile.name_reset'
    end,
    'user', v_profile.id, v_reason,
    -- What the member was called, so staff can see what was reset (public fields only).
    case when p_action = 'require_new_name' then jsonb_build_object(
      'previous_display_name', v_profile.display_name,
      'previous_handle', v_profile.handle
    ) end);
  return v_old_path;
end;
$$;

revoke execute on function public.admin_profile_action(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_profile_action(uuid, uuid, text, text) to service_role;
