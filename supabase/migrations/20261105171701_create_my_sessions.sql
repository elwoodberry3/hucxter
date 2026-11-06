-- Active sessions for Settings (Brief 03 · 3B): the caller's own sessions, with the raw user agent
-- (apps/web shows a short device label) and created time. Never the IP address.
-- auth.sessions is created by Supabase Auth; plpgsql so the body resolves at call time.
-- Recovery: additive. `drop function public.my_sessions();`

create or replace function public.my_sessions()
returns table (id uuid, created_at timestamptz, user_agent text, is_current boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select
    s.id,
    s.created_at,
    left(s.user_agent, 512),
    s.id::text = coalesce(auth.jwt() ->> 'session_id', '')
  from auth.sessions s
  where s.user_id = auth.uid()
    and (s.not_after is null or s.not_after > now())
  order by s.created_at desc
  limit 50;
end;
$$;

revoke execute on function public.my_sessions() from public, anon;
grant execute on function public.my_sessions() to authenticated;
