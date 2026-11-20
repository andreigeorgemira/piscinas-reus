-- Staff are not clients.
--
-- handle_confirmed_user (0008_account_linking.sql) gives every confirmed
-- account a profile with role 'client' AND a row in public.clients, because at
-- signup nobody knows yet who is staff: an admin is an ordinary account that is
-- promoted afterwards (profiles.role = 'admin'). Nothing ever took the client
-- row away again, so every member of staff showed up in the client list, in the
-- dashboard's count and in the quote filters, as a client called after the left
-- half of their own email address.
--
-- Two halves, so the rule holds however the account came to be staff:
--
--   * promotion: when a profile becomes 'admin', the client row the trigger
--     made for it goes. If that row has history -- quotes or projects, because
--     somebody quoted this person before they joined -- it is kept as the
--     client record it genuinely is, and only unlinked from the staff account.
--   * confirmation: an account whose profile is already 'admin' when its email
--     is confirmed (promoted before confirming) gets no client row at all.
--
-- And once, now, for the staff that already exist.

create or replace function public.forget_staff_client(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.clients c
  where c.user_id = p_user_id
    and not exists (select 1 from public.quotes q where q.client_id = c.id)
    and not exists (select 1 from public.projects p where p.client_id = c.id);

  update public.clients
  set user_id = null
  where user_id = p_user_id;
end;
$$;

revoke all on function public.forget_staff_client(uuid) from public, anon, authenticated;

create or replace function public.profile_promoted_to_staff()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role = 'admin' and old.role is distinct from 'admin' then
    perform public.forget_staff_client(new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.profile_promoted_to_staff() from public, anon, authenticated;

create trigger profiles_promoted_to_staff
  after update of role on public.profiles
  for each row execute function public.profile_promoted_to_staff();

-- 0008's function, restated with one early return.
create or replace function public.handle_confirmed_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_linked_id uuid;
  v_name      text;
  v_role      user_role;
begin
  if new.email_confirmed_at is null then
    return new;
  end if;

  v_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, role, full_name)
  values (new.id, 'client', v_name)
  on conflict (id) do nothing;

  -- Already staff: nothing to link and nothing to create.
  select role into v_role from public.profiles where id = new.id;
  if v_role = 'admin' then
    return new;
  end if;

  -- Adopt a record staff created while quoting this address. clients.email
  -- is citext, so this comparison is already case-insensitive.
  update public.clients
     set user_id = new.id
   where email = new.email::citext
     and user_id is null
  returning id into v_linked_id;

  -- Otherwise this is a first-time visitor registering on their own.
  if v_linked_id is null then
    insert into public.clients (email, full_name, user_id)
    values (new.email::citext, v_name, new.id)
    on conflict (email) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.handle_confirmed_user() from public, anon, authenticated;

select public.forget_staff_client(p.id)
from public.profiles p
where p.role = 'admin';
