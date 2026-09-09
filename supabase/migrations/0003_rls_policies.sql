alter table public.profiles          enable row level security;
alter table public.clients           enable row level security;
alter table public.projects          enable row level security;
alter table public.quotes            enable row level security;
alter table public.quote_items       enable row level security;
alter table public.price_book_groups enable row level security;
alter table public.price_book_items  enable row level security;
alter table public.leads             enable row level security;

-- profiles ------------------------------------------------------------------
-- A user reads their own profile. Only an admin may write any profile, which
-- is what stops a client promoting themselves.
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- clients -------------------------------------------------------------------
create policy clients_admin_all on public.clients
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy clients_select_own on public.clients
  for select to authenticated
  using (user_id = auth.uid());

-- projects ------------------------------------------------------------------
create policy projects_admin_all on public.projects
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy projects_select_own on public.projects
  for select to authenticated
  using (client_id = public.current_client_id());

-- quotes --------------------------------------------------------------------
create policy quotes_admin_all on public.quotes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Drafts are deliberately excluded: a half-written quote must never be
-- visible to the person it is being written for.
create policy quotes_select_own on public.quotes
  for select to authenticated
  using (
    client_id = public.current_client_id()
    and status <> 'draft'
  );

-- quote_items ---------------------------------------------------------------
-- Admin only. The column unit_cost lives here, so clients get no policy at
-- all and read through the client_quote_items view instead (migration 0004).
create policy quote_items_admin_all on public.quote_items
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- price book ----------------------------------------------------------------
create policy price_book_groups_admin_all on public.price_book_groups
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy price_book_items_admin_all on public.price_book_items
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- leads ---------------------------------------------------------------------
-- The only anonymous write in the system: the public contact form.
create policy leads_insert_public on public.leads
  for insert to anon, authenticated
  with check (true);

create policy leads_admin_all on public.leads
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
