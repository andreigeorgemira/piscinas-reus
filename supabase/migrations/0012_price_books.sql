-- More than one price book.
--
-- Until now the catalogue was a single global list: one set of groups, one
-- set of concepts, names and codes unique across the whole business. A pool
-- builder does not have one catalogue. New builds and maintenance are
-- different trades with different concepts, and a code like REV-001 means
-- "the first revestimiento of THIS book", not a business-wide identifier.
--
-- So a book owns its groups and its concepts, and uniqueness moves inside
-- it. Nothing about quotes changes: quote_items already copies every
-- descriptive and monetary field it needs (0001_core_schema.sql), so a quote
-- written from a book that is later renamed, emptied or deleted still shows
-- the client exactly what it showed them the day it was sent.

create table public.price_books (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.price_books enable row level security;

create policy price_books_admin_all on public.price_books
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Two independent yeses, as 0010_table_grants.sql explains at length: the
-- policy above is the second one, and this is the first.
revoke all on public.price_books from public, anon, authenticated;
grant select, insert, update, delete on public.price_books to authenticated, service_role;

-- Everything that exists today belongs to one book. Named rather than
-- "Default": it is what staff will see at the top of the list, and it has to
-- read like the thing they have been using.
insert into public.price_books (name, description, position)
values ('Tarifario general', 'El catálogo con el que se venía trabajando.', 1);

alter table public.price_book_groups
  add column price_book_id uuid references public.price_books (id) on delete cascade;

-- The concept carries the book too, not only the group. An item with no
-- group is a real state (group_id is nullable, and the screen shows those
-- under "Sin grupo"), and without this column such an item would belong to
-- no book at all.
alter table public.price_book_items
  add column price_book_id uuid references public.price_books (id) on delete cascade;

update public.price_book_groups
set price_book_id = (select id from public.price_books order by position, created_at limit 1);

update public.price_book_items
set price_book_id = (select id from public.price_books order by position, created_at limit 1);

alter table public.price_book_groups alter column price_book_id set not null;
alter table public.price_book_items  alter column price_book_id set not null;

-- Uniqueness moves inside the book. Two books may both have a
-- "Revestimiento" group and both have a REV-001, and neither is a mistake.
alter table public.price_book_groups drop constraint price_book_groups_name_key;
alter table public.price_book_groups
  add constraint price_book_groups_book_name_key unique (price_book_id, name);

alter table public.price_book_items drop constraint price_book_items_code_key;
alter table public.price_book_items
  add constraint price_book_items_book_code_key unique (price_book_id, code);

-- A concept must not be filed under a group from a different book. A
-- composite foreign key says so in the schema rather than in the
-- application, which is where the rule would otherwise live until the first
-- direct API call ignored it.
--
-- The single-column key is replaced rather than kept: two foreign keys over
-- the same column would both have to be satisfied, and the narrower one
-- would let the cross-book case through.
alter table public.price_book_groups
  add constraint price_book_groups_id_book_key unique (id, price_book_id);

alter table public.price_book_items drop constraint price_book_items_group_id_fkey;
alter table public.price_book_items
  add constraint price_book_items_group_fkey
  foreign key (group_id, price_book_id)
  references public.price_book_groups (id, price_book_id)
  -- Only the group is cleared when a group is deleted: the concept stays in
  -- its book, which is what the "Sin grupo" bucket on the screen is. Naming
  -- the column is Postgres 15 and later; this project runs 17.
  on delete set null (group_id);

-- Every read of a book's catalogue filters on this, and every screen is a
-- read of one book.
create index price_book_groups_book_idx on public.price_book_groups (price_book_id, position);
create index price_book_items_book_idx on public.price_book_items (price_book_id, code);
