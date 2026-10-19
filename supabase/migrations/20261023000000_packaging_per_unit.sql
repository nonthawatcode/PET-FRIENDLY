-- Each finished bottle uses 1 bottle + 1 cap + 1 box. Bottle and box are chosen per product,
-- the cap is the same for every product (app setting "cap_item_id"). Packaging is taken out
-- when finished stock is received (รับสินค้าเข้า / เพิ่มสต็อก); not enough packaging = blocked.

alter table public.products
  add column bottle_id uuid references public.packaging_items (id) on delete set null,
  add column box_id uuid references public.packaging_items (id) on delete set null;

-- The stock view lists product columns, so rebuild it to include the new ones.
drop view public.product_stock;
create view public.product_stock with (security_invoker = true) as
select p.*, i.on_hand, i.reserved, i.on_hand - i.reserved as available,
       (i.on_hand - i.reserved) <= p.low_stock_threshold as is_low
from public.products p
join public.inventory i on i.product_id = p.id;
revoke all on public.product_stock from anon;
grant select on public.product_stock to authenticated;

create or replace function public.receive_stock(p_product uuid, p_qty integer, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.products; cap uuid; part uuid;
begin
  perform private.require_user();
  if p_qty is null or p_qty <= 0 then raise exception 'invalid_quantity'; end if;
  select * into p from public.products where id = p_product;
  select (value #>> '{}')::uuid into cap from public.app_settings where key = 'cap_item_id';
  if p.bottle_id is null or p.box_id is null or cap is null then raise exception 'packaging_not_set'; end if;
  foreach part in array array[p.bottle_id, cap, p.box_id] loop
    update public.packaging_items set qty = qty - p_qty, updated_at = now() where id = part;
  end loop;
  perform 1 from public.inventory where product_id = p_product for update;
  perform private._move(p_product, 'receive', p_qty, p_qty, 0, null, p_note, null);
exception when check_violation then
  raise exception 'packaging_short';
end $$;
