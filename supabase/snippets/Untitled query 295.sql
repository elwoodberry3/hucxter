   insert into public.app_roles (user_id, role, granted_by)
   select id, 'admin', null
   from auth.users
   where lower(email) = lower('you3@example.com')
   on conflict do nothing;

   -- Confirm:
   select user_id, role, granted_at from public.app_roles where role = 'admin';