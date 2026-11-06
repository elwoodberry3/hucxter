-- Trust-safety review H1 (3C.1): a draft scheduled with "Publish when ready" is published by the
-- Mux ready webhook without a second check, so an edit made after scheduling must be able to hold
-- it for review too. listing_update_details now raises review_state on a flagged edit when the
-- listing is published *or* scheduled (publish_when_ready). It still never clears review. The
-- webhook then publishes it straight into review (hidden from buyers until an admin approves).
-- Same signature and grants as 20261106222340_hold_edited_listings_for_review.sql.
--
-- Recovery: re-run the function body from 20261106222340_hold_edited_listings_for_review.sql.

create or replace function public.listing_update_details(
  p_id uuid,
  p_title text,
  p_category_slug text,
  p_condition text,
  p_price_cents integer,
  p_attributes jsonb,
  p_description text,
  p_pickup_zip text,
  p_needs_review boolean default false
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_listing public.listings := public.assert_own_listing(p_id);
  v_category uuid;
  v_free_only boolean;
begin
  if v_listing.status = 'sold' then
    raise exception 'sold listings can''t be edited' using errcode = 'check_violation';
  end if;
  select c.id, coalesce((d.attributes ->> 'free_only')::boolean, false)
  into v_category, v_free_only
  from public.categories c join public.categories d on d.id = c.parent_id
  where c.slug = p_category_slug and c.is_active and d.is_active;
  if v_category is null then
    raise exception 'unknown category' using errcode = 'invalid_parameter_value';
  end if;
  if v_free_only and p_price_cents <> 0 then
    raise exception 'free stuff is $0' using errcode = 'check_violation';
  end if;
  update public.listings set
    title = p_title,
    category_id = v_category,
    condition = p_condition,
    price_cents = p_price_cents,
    attributes = coalesce(p_attributes, '{}'::jsonb),
    description = coalesce(p_description, ''),
    pickup_zip = p_pickup_zip,
    review_state = case
      when (v_listing.status <> 'draft' or v_listing.publish_when_ready)
        and coalesce(p_needs_review, false)
        then 'needs_review'::public.listing_review_state
      else review_state
    end
  where id = p_id;
end;
$$;
