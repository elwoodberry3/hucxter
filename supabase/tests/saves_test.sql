-- Saves (Brief 03C.2 §4.3): own rows only, writes only through listing_save (verified member,
-- live listing, not your own, rate limit), and the saved list shows live listings only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, email, aud, role, email_confirmed_at, phone_confirmed_at, phone, created_at) values
  ('00000000-0000-4000-8000-0000000c2c01', 'saver@example.test', 'authenticated', 'authenticated', now(), now(), '15035550181', now()),
  ('00000000-0000-4000-8000-0000000c2c02', 'seller2@example.test', 'authenticated', 'authenticated', now(), now(), '15035550182', now()),
  ('00000000-0000-4000-8000-0000000c2c03', 'other@example.test', 'authenticated', 'authenticated', now(), now(), '15035550183', now()),
  ('00000000-0000-4000-8000-0000000c2c04', 'unverified2@example.test', 'authenticated', 'authenticated', now(), null, null, now());
update public.profiles set display_name = 'Sam', home_zip = '97205', age_attested_at = now()
where id in ('00000000-0000-4000-8000-0000000c2c01', '00000000-0000-4000-8000-0000000c2c02', '00000000-0000-4000-8000-0000000c2c03');

create function pg_temp.live(p_id uuid, p_price int, p_published timestamptz default now())
returns void language plpgsql as $$
begin
  insert into public.listings (id, seller_id, pickup_zip, title, category_id, condition, price_cents)
  values (p_id, '00000000-0000-4000-8000-0000000c2c02', '97205', 'Lamp ' || p_price,
          (select id from public.categories where slug = 'lighting'), 'good', p_price);
  insert into public.listing_media (owner_id, listing_id, status)
  values ('00000000-0000-4000-8000-0000000c2c02', p_id, 'awaiting_upload');
  update public.listing_media set status = 'processing' where listing_id = p_id;
  update public.listing_media set status = 'ready' where listing_id = p_id;
  update public.listings set status = 'available', published_at = p_published where id = p_id;
end;
$$;
select pg_temp.live('00000000-0000-4000-8000-0000000c2d01', 1000);
select pg_temp.live('00000000-0000-4000-8000-0000000c2d02', 3000);
select pg_temp.live('00000000-0000-4000-8000-0000000c2d03', 2000);
-- A draft by the same seller (not live).
insert into public.listings (id, seller_id, pickup_zip, title, category_id, condition, price_cents)
values ('00000000-0000-4000-8000-0000000c2d09', '00000000-0000-4000-8000-0000000c2c02', '97205', 'Draft',
        (select id from public.categories where slug = 'lighting'), 'good', 500);

-- Structure and privileges
select ok((select relrowsecurity from pg_class where oid = 'public.saved_listings'::regclass), 'RLS is on');
select ok(not has_table_privilege('authenticated', 'public.saved_listings', 'insert'), 'members cannot insert saves directly');
select ok(not has_table_privilege('authenticated', 'public.saved_listings', 'delete'), 'members cannot delete saves directly');
select ok(not has_table_privilege('anon', 'public.saved_listings', 'select'), 'guests cannot read saves');
select ok(not has_function_privilege('anon', 'public.listing_save(uuid, boolean)', 'execute'), 'guests cannot save');
select ok(not has_function_privilege('anon', 'public.my_saved_listings(text, jsonb, int)', 'execute'), 'guests have no saved list');

-- Saving
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000c2c01", "role": "authenticated"}';
select is(public.listing_save('00000000-0000-4000-8000-0000000c2d01', true), 'saved', 'a member saves a live listing');
select is(public.listing_save('00000000-0000-4000-8000-0000000c2d01', true), 'saved', 'saving twice is a no-op');
select is(public.listing_save('00000000-0000-4000-8000-0000000c2d02', true), 'saved', 'a second save');
select is(public.listing_save('00000000-0000-4000-8000-0000000c2d03', true), 'saved', 'a third save');
select is(public.listing_save('00000000-0000-4000-8000-0000000c2d09', true), 'not_found', 'a draft cannot be saved');
select is((select count(*)::int from public.saved_listings), 3, 'the member sees their own three saves');
select is(
  (select array_agg(price_cents order by ord) from (
    select price_cents, row_number() over () as ord from public.my_saved_listings('price_asc', null, 10)) r),
  array[1000, 2000, 3000], 'price low–high sorts the saved list');
select is(
  (select array_agg(id order by ord) from (
    select id, row_number() over () as ord from public.my_saved_listings('price_asc',
      (select cursor from public.my_saved_listings('price_asc', null, 1)), 10)) r),
  array['00000000-0000-4000-8000-0000000c2d03', '00000000-0000-4000-8000-0000000c2d02']::uuid[],
  'the keyset cursor continues after the first row');

-- Another member sees none of them
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000c2c03", "role": "authenticated"}';
select is((select count(*)::int from public.saved_listings), 0, 'saves are private to their owner');
select is((select count(*)::int from public.my_saved_listings('newest', null, 10)), 0, 'and not in anyone else''s list');

-- The seller can't save their own listing; unverified members can't save
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000c2c02", "role": "authenticated"}';
select is(public.listing_save('00000000-0000-4000-8000-0000000c2d01', true), 'not_found', 'sellers cannot save their own listing');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000c2c04", "role": "authenticated"}';
select throws_ok($$select public.listing_save('00000000-0000-4000-8000-0000000c2d01', true)$$, '42501', null,
  'unverified members cannot save');

-- Sold listings drop out of the saved list; unsaving works
reset role;
update public.listings set status = 'sold' where id = '00000000-0000-4000-8000-0000000c2d02';
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000c2c01", "role": "authenticated"}';
select is((select count(*)::int from public.my_saved_listings('newest', null, 10)), 2, 'a sold listing leaves the saved list');
select is(public.listing_save('00000000-0000-4000-8000-0000000c2d01', false), 'unsaved', 'unsaving');
reset role;

-- Rate limit: accounts younger than 7 days get the smaller allowance (2 here, 50 in config)
update public.action_limit_config set new_account_per_window = 2 where action = 'listing_save';
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000c2c03", "role": "authenticated"}';
select public.listing_save('00000000-0000-4000-8000-0000000c2d01', true);
select public.listing_save('00000000-0000-4000-8000-0000000c2d03', true);
select public.listing_save('00000000-0000-4000-8000-0000000c2d01', false);
select matches(public.listing_save('00000000-0000-4000-8000-0000000c2d01', true), '^retry_after:[0-9]+$',
  'the save limit applies');
reset role;

select * from finish();
rollback;
