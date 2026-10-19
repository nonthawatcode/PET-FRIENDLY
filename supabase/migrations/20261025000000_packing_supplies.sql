-- Packing supplies (wax paper, parcel box, bubble wrap …) taken from โกดัง when a pack is
-- confirmed: a set amount per order, or per piece in the order. Not enough = pack blocked.
create table public.packing_rules (
  item_id uuid primary key references public.packaging_items (id) on delete cascade,
  per text not null check (per in ('order', 'piece')),
  qty integer not null default 1 check (qty > 0),
  created_at timestamptz not null default now()
);
alter table public.packing_rules enable row level security;
create policy staff_all on public.packing_rules for all to authenticated using (private.is_active_user()) with check (private.is_active_user());
revoke all on public.packing_rules from anon;
grant select, insert, update, delete on public.packing_rules to authenticated;

create or replace function private.use_packing_supplies() returns trigger
language plpgsql security definer set search_path = '' as $$
declare pieces integer; r record; need integer;
begin
  select coalesce(sum(quantity), 0) into pieces from public.order_items where order_id = new.id;
  for r in select pr.*, pi.name, pi.qty as have from public.packing_rules pr join public.packaging_items pi on pi.id = pr.item_id for update of pi loop
    need := r.qty * case when r.per = 'order' then 1 else pieces end;
    if need > r.have then
      raise exception 'packing_supplies_short' using detail = r.name || ' (ต้องใช้ ' || need || ' มี ' || r.have || ')';
    end if;
    update public.packaging_items set qty = qty - need, updated_at = now() where id = r.item_id;
  end loop;
  return new;
end $$;

create trigger orders_use_packing_supplies after update of status on public.orders
  for each row when (new.status = 'packed' and old.status is distinct from 'packed')
  execute function private.use_packing_supplies();
