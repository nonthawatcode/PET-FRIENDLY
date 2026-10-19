-- Remember which packing supplies each pack used, and put them back into โกดัง when the
-- pack is undone ("ยกเลิกแพ็ก": packed → pending).
create table public.packing_usage (
  order_id uuid not null references public.orders (id) on delete cascade,
  item_id uuid not null references public.packaging_items (id) on delete cascade,
  qty integer not null check (qty > 0),
  primary key (order_id, item_id)
);
alter table public.packing_usage enable row level security;
create policy staff_read on public.packing_usage for select to authenticated using (private.is_active_user());
revoke all on public.packing_usage from anon;
grant select on public.packing_usage to authenticated;

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
    insert into public.packing_usage (order_id, item_id, qty) values (new.id, r.item_id, need)
      on conflict (order_id, item_id) do update set qty = public.packing_usage.qty + excluded.qty;
  end loop;
  return new;
end $$;

create or replace function private.return_packing_supplies() returns trigger
language plpgsql security definer set search_path = '' as $$
declare u record;
begin
  for u in delete from public.packing_usage where order_id = new.id returning item_id, qty loop
    update public.packaging_items set qty = qty + u.qty, updated_at = now() where id = u.item_id;
  end loop;
  return new;
end $$;

create trigger orders_return_packing_supplies after update of status on public.orders
  for each row when (old.status = 'packed' and new.status in ('pending', 'packing'))
  execute function private.return_packing_supplies();
