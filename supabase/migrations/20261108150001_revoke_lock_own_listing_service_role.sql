-- Exact grants for lock_own_listing (Brief 03C.1b trust-safety review L8): it is called only from
-- listing_update_details and listing_publish (security definer, as the owner), so no role needs
-- EXECUTE. service_role kept it by default; without auth.uid() it could do nothing, but the
-- pattern is revoke from everyone.
--
-- Recovery: `grant execute on function public.lock_own_listing(uuid) to service_role;`

revoke execute on function public.lock_own_listing(uuid) from service_role;
