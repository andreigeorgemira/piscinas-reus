-- security definer is mandatory here. A policy on profiles that queried
-- profiles through an invoker-rights function would trigger the policy again
-- and recurse. Running as the owner reads the table without policy checks.
--
-- search_path is pinned so a caller cannot shadow `profiles` with a table of
-- their own and lie about being an admin.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.current_client_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id
  from public.clients
  where user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.current_client_id() from public;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.current_client_id() to anon, authenticated;
