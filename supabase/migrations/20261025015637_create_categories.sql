-- Category taxonomy (docs/specs/category-taxonomy.md, ADR-0009). Rows are seeded from supabase/seed.sql.
-- Two levels only: department (parent_id null) -> subcategory. Slugs are stable once released.
-- Recovery: additive (new table + helpers). `drop table public.categories;` undoes it until another
-- table references categories; after that, roll forward only.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  parent_id uuid references public.categories (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 60),
  sort smallint not null default 0,
  -- Position in the header category bar (departments only); null means "More" / mega menu only.
  nav_rank smallint unique check (nav_rank > 0),
  -- Optional shorter label for the header bar ("Tools" for "Tools & Home Improvement").
  nav_label text check (char_length(nav_label) between 1 and 30),
  is_active boolean not null default true,
  -- Placeholder art key (departments only).
  hero_key text check (hero_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- { "filters": [...], "free_only"?: bool, "notice"?: text }; validated by packages/contracts/taxonomy.ts.
  attributes jsonb not null default '{"filters": []}'::jsonb check (
    jsonb_typeof(attributes) = 'object' and jsonb_typeof(attributes -> 'filters') = 'array'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_department_fields check (
    (parent_id is null and hero_key is not null)
    or (parent_id is not null and nav_rank is null and nav_label is null)
  )
);

comment on table public.categories is
  'Two-level category taxonomy (department -> subcategory). Public read of active rows; writes via service role only.';

create index categories_parent_id_idx on public.categories (parent_id, sort);

-- Enforce two levels: a subcategory's parent must be a department.
create or replace function public.categories_enforce_depth()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is not null and exists (
    select 1 from public.categories p where p.id = new.parent_id and p.parent_id is not null
  ) then
    raise exception 'categories: only two levels are allowed (department -> subcategory)'
      using errcode = 'check_violation';
  end if;
  if new.parent_id is not null and exists (
    select 1 from public.categories c where c.parent_id = new.id
  ) then
    raise exception 'categories: a department with subcategories cannot become a subcategory'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger categories_enforce_depth
  before insert or update of parent_id on public.categories
  for each row execute function public.categories_enforce_depth();

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

alter table public.categories enable row level security;

-- Browsers never write (single write path through apps/web server code with the service role).
revoke insert, update, delete, truncate on public.categories from anon, authenticated;

create policy categories_public_read_active
  on public.categories
  for select
  to anon, authenticated
  using (is_active);
