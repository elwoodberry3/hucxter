-- Narrower blocked terms for display names and bios (Brief 03C.1b H8). The 3C.2 rules refused
-- "hucxter", "admin", "support" and "official" anywhere, so "Badminton Bob" and "Happy to support
-- local sellers" were refused. Now, on the folded text (text_fold, so look-alikes still count):
--   display names: "hucxter" anywhere, and admin / support / official only as whole words
--     (no letter on either side: "Bob Admin", "Support24" and "Bob_Admin" are still refused);
--   bios: "hucxter" anywhere, nothing else;
--   handles: unchanged (handle_is_reserved keeps the substring rule).
-- The placeholder exception ("Hucxter member" during a staff name reset) and the hidden-character
-- checks are unchanged. The two patterns match packages/contracts handle.ts (a unit test keeps
-- them equal).
--
-- Every rule here is looser than the one it replaces, so no row that met the old CHECKs breaks
-- these. They are still added NOT VALID and validated only when no row breaks them (counts only
-- in the NOTICE), because the 3C.2 folded CHECKs may have been left NOT VALID.
--
-- Recovery: re-create the four constraints as defined in 20261107143116_add_profile_bio_avatar
-- (profiles_bio_check), 20261107143118_limit_display_name_25 (profiles_display_name_rules) and
-- 20261107164430_harden_profile_rules (profiles_display_name_folded, profiles_bio_folded),
-- after dropping these; add them NOT VALID if rows written since would break them.

alter table public.profiles
  drop constraint profiles_bio_check,
  drop constraint profiles_display_name_rules,
  drop constraint profiles_display_name_folded,
  drop constraint profiles_bio_folded;

alter table public.profiles
  -- As in add_profile_bio_avatar, without the raw blocked-term test (profiles_bio_folded has it).
  add constraint profiles_bio_check check (
    char_length(bio) <= 150
    and bio = btrim(bio, E' \n\t')
    and replace(bio, E'\n', '') !~ '[[:cntrl:]]'
    and char_length(bio) - char_length(replace(bio, E'\n', '')) <= 3
    and bio !~ '@'
    and bio !~* '(://|www\.|\.(com|net|org|io|app|co|me|ly|gg|tv|us|info|biz)(\M|$))'
    and bio !~* '([0-9][^0-9a-z]{0,3}){7}'
  ) not valid,
  -- As in limit_display_name_25, without the raw blocked-term test (the folded CHECK has it).
  add constraint profiles_display_name_rules check (
    display_name is null
    or char_length(display_name) <= 25
    or (display_name = 'Hucxter member' and name_reset_required_at is not null)
  ) not valid,
  add constraint profiles_display_name_folded check (
    display_name is null
    or (display_name = 'Hucxter member' and name_reset_required_at is not null)
    or (
      not public.has_hidden_chars(display_name)
      and public.text_fold(display_name) !~ 'hucxter'
      and public.text_fold(display_name) !~ '(^|[^a-z])(admin|support|official)([^a-z]|$)'
    )
  ) not valid,
  add constraint profiles_bio_folded check (
    not public.has_hidden_chars(bio)
    and public.text_fold(bio) !~ 'hucxter'
  ) not valid;

do $$
declare
  v_bio int;
  v_long int;
  v_name int;
  v_bio_folded int;
begin
  select
    count(*) filter (where not (
      char_length(bio) <= 150
      and bio = btrim(bio, E' \n\t')
      and replace(bio, E'\n', '') !~ '[[:cntrl:]]'
      and char_length(bio) - char_length(replace(bio, E'\n', '')) <= 3
      and bio !~ '@'
      and bio !~* '(://|www\.|\.(com|net|org|io|app|co|me|ly|gg|tv|us|info|biz)(\M|$))'
      and bio !~* '([0-9][^0-9a-z]{0,3}){7}')),
    count(*) filter (where char_length(display_name) > 25
      and not (display_name = 'Hucxter member' and name_reset_required_at is not null)),
    count(*) filter (where display_name is not null
      and not (display_name = 'Hucxter member' and name_reset_required_at is not null)
      and (public.has_hidden_chars(display_name)
        or public.text_fold(display_name) ~ 'hucxter'
        or public.text_fold(display_name) ~ '(^|[^a-z])(admin|support|official)([^a-z]|$)')),
    count(*) filter (where public.has_hidden_chars(bio) or public.text_fold(bio) ~ 'hucxter')
  into v_bio, v_long, v_name, v_bio_folded
  from public.profiles;
  if v_bio = 0 then
    alter table public.profiles validate constraint profiles_bio_check;
  end if;
  if v_long = 0 then
    alter table public.profiles validate constraint profiles_display_name_rules;
  end if;
  if v_name = 0 then
    alter table public.profiles validate constraint profiles_display_name_folded;
  end if;
  if v_bio_folded = 0 then
    alter table public.profiles validate constraint profiles_bio_folded;
  end if;
  if v_bio + v_long + v_name + v_bio_folded > 0 then
    raise notice 'profile CHECKs left NOT VALID: % bios, % long names, % names, % folded bios',
      v_bio, v_long, v_name, v_bio_folded;
  end if;
end;
$$;
