-- Prohibited-item keywords move into the database (Brief 03C.1b H1; PR #10 review M1). The check
-- that holds a listing for review now runs in SQL (listing_text_flagged), so a caller can't skip it
-- by calling listing_publish / listing_update_details directly. Terms are whole words or phrases
-- matched on the same folding as the profile blocked-term checks (text_fold: NFKD, accents removed,
-- look-alikes → Latin, lowercase, hidden characters removed), with everything except a–z, 0–9 and
-- ":+-" turned into spaces. apps/web/src/config/prohibited-keywords.ts mirrors the list for UI hints
-- (a unit test keeps them equal). The list itself is the D-07 draft.
--
-- Recovery: additive. `drop function public.listing_text_flagged(text, text),
-- public.listing_text_normalize(text); drop table public.prohibited_keywords;`

create table public.prohibited_keywords (
  term text primary key check (term ~ '^[a-z0-9:+-]+( [a-z0-9:+-]+)*$' and char_length(term) <= 60),
  item_group text not null check (item_group ~ '^[a-z]+(_[a-z]+)*$' and char_length(item_group) <= 40),
  created_at timestamptz not null default now()
);

comment on table public.prohibited_keywords is
  'Prohibited-item keywords (D-07 draft). A match holds a listing for review. Read by definer functions only.';

alter table public.prohibited_keywords enable row level security;
revoke all on public.prohibited_keywords from anon, authenticated, service_role;
-- Support and the local sync check read the list; changes are migrations.
grant select on public.prohibited_keywords to service_role;

-- ' word word ' form of a title or description, for whole-word matching.
create or replace function public.listing_text_normalize(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select ' ' || btrim(regexp_replace(public.text_fold(coalesce(p_value, '')), '[^a-z0-9:+-]+', ' ', 'g')) || ' '
$$;

-- True when the title or description contains a prohibited term as a whole word or phrase.
-- Security invoker with no grants: only the listing definer functions call it.
create or replace function public.listing_text_flagged(p_title text, p_description text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.prohibited_keywords k
    where position(' ' || k.term || ' ' in
      public.listing_text_normalize(coalesce(p_title, '') || ' ' || coalesce(p_description, ''))) > 0
  )
$$;

revoke execute on function public.listing_text_normalize(text) from public, anon, authenticated, service_role;
revoke execute on function public.listing_text_flagged(text, text) from public, anon, authenticated, service_role;
