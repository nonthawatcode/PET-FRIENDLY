-- Product categories (named by staff in the app) and a category per product.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);
alter table public.categories enable row level security;
create policy staff_read on public.categories for select to authenticated using (private.is_active_user());
create policy staff_insert on public.categories for insert to authenticated with check (private.is_active_user());
create policy staff_update on public.categories for update to authenticated using (private.is_active_user()) with check (private.is_active_user());
revoke all on public.categories from anon;
grant select, insert, update on public.categories to authenticated;

alter table public.products add column category_id uuid references public.categories (id) on delete set null;

-- Rebuild the stock view so it includes the new column.
drop view public.product_stock;
create view public.product_stock with (security_invoker = true) as
select p.*, i.on_hand, i.reserved, i.on_hand - i.reserved as available,
       (i.on_hand - i.reserved) <= p.low_stock_threshold as is_low
from public.products p
join public.inventory i on i.product_id = p.id;
revoke all on public.product_stock from anon;
grant select on public.product_stock to authenticated;
