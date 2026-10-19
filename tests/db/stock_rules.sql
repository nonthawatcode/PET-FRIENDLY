-- Behavioural tests for the stock rules. Run with scripts/test-db.sh (plain Postgres + auth stub).
\set ON_ERROR_STOP on
set client_min_messages = warning;

create or replace function pg_temp.check(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not cond then raise exception 'FAIL: %', msg; end if;
  raise notice 'ok  %', msg;
end $$;
create or replace function pg_temp.inv(p_sku text) returns table(on_hand int, reserved int) language sql as $$
  select i.on_hand, i.reserved from public.inventory i join public.products p on p.id = i.product_id where p.sku = p_sku
$$;
set client_min_messages = notice;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001', 'packer@pet-friendly.test');
select pg_temp.check((select count(*) = 1 from public.profiles), 'new auth user gets a profile');

-- Baseline from seed: 120 / 64 / 18 on hand, nothing reserved.
select pg_temp.check((select on_hand = 120 and reserved = 0 from pg_temp.inv('PF-FDP-01')), 'seed stock');

-- 1. Ingest reserves; re-ingesting the same order does not reserve again.
select public.ingest_order('shopee', 'SO-1', now(), '[{"sku":"SP-FDP01","qty":2,"price":890}]', 'buyer', null, 1780, 'ready', 'READY_TO_SHIP', 'TH0001', 'sample');
select public.ingest_order('shopee', 'SO-1', now(), '[{"sku":"SP-FDP01","qty":2,"price":890}]', 'buyer', null, 1780, 'ready', 'READY_TO_SHIP', 'TH0001', 'sample');
select pg_temp.check((select count(*) = 1 from public.orders where external_order_id = 'SO-1'), 'one order row after duplicate sync');
select pg_temp.check((select on_hand = 120 and reserved = 2 from pg_temp.inv('PF-FDP-01')), 'reserve +2, on_hand unchanged, no double reserve');

-- Staff session from here on.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);

-- 2. Scanning the label marks packing but moves no stock.
select pg_temp.check((public.start_pack('th0001') ->> 'ok')::boolean, 'start_pack finds order by tracking (case-insensitive)');
select pg_temp.check((select on_hand = 120 and reserved = 2 from pg_temp.inv('PF-FDP-01')), 'label scan does not move stock');
select pg_temp.check((public.start_pack('NOPE-123') ->> 'error') = 'not_found', 'unknown label is rejected');

-- 3. Wrong counts are refused.
select pg_temp.check((public.confirm_pack((select id from orders where external_order_id='SO-1'),
  jsonb_build_object((select id from products where sku='PF-FDP-01')::text, 1)) ->> 'error') = 'count_mismatch', 'short scan refused');
select pg_temp.check((public.confirm_pack((select id from orders where external_order_id='SO-1'),
  jsonb_build_object((select id from products where sku='PF-FDP-02')::text, 2)) ->> 'error') = 'count_mismatch', 'wrong SKU refused');
select pg_temp.check((select on_hand = 120 and reserved = 2 from pg_temp.inv('PF-FDP-01')), 'refused confirms move nothing');

-- 4. Confirm deducts once; second confirm is a no-op.
select pg_temp.check((public.confirm_pack((select id from orders where external_order_id='SO-1'),
  jsonb_build_object((select id from products where sku='PF-FDP-01')::text, 2)) ->> 'already') = 'false', 'confirm pack');
select pg_temp.check((public.confirm_pack((select id from orders where external_order_id='SO-1'),
  jsonb_build_object((select id from products where sku='PF-FDP-01')::text, 2)) ->> 'already') = 'true', 'second confirm is no-op');
select pg_temp.check((select on_hand = 118 and reserved = 0 from pg_temp.inv('PF-FDP-01')), 'deducted exactly once: 118 / 0');
select pg_temp.check((public.start_pack('TH0001') ->> 'error') = 'already_packed', 'rescanning a packed label is refused');

-- 5. Unpack (packed by mistake) restores stock and reservation; repack deducts again once.
select public.unpack_order((select id from orders where external_order_id='SO-1'), 'หยิบผิดกลิ่น');
select pg_temp.check((select on_hand = 120 and reserved = 2 from pg_temp.inv('PF-FDP-01')), 'unpack: 120 / 2');
select public.start_pack('TH0001');
select public.confirm_pack((select id from orders where external_order_id='SO-1'), jsonb_build_object((select id from products where sku='PF-FDP-01')::text, 2));
select pg_temp.check((select on_hand = 118 and reserved = 0 from pg_temp.inv('PF-FDP-01')), 'repack: 118 / 0');

-- 6. Direct writes to stock are blocked for staff.
do $$ begin
  begin update public.inventory set on_hand = 999; raise exception 'FAIL: direct inventory write allowed';
  exception when insufficient_privilege then raise notice 'ok  direct inventory write blocked'; end;
  begin perform public.ingest_order('shopee','X',now(),'[]'); raise exception 'FAIL: staff can call ingest_order';
  exception when insufficient_privilege then raise notice 'ok  ingest_order is server-only'; end;
  begin update public.products set sku = 'PF-NEW-01' where sku = 'PF-FDP-02'; raise exception 'FAIL: sku changed';
  exception when raise_exception then raise notice 'ok  SKU is locked'; end;
end $$;

reset role;

-- 7. Cancel before pack releases; cancel after pack only flags for return.
select public.ingest_order('lazada', 'LZ-1', now(), '[{"sku":"FDP02-50ML","qty":1},{"sku":"FDP03-50ML","qty":1}]', null, null, 1780, 'ready', 'ready_to_ship', 'LEX1', 'sample');
select pg_temp.check((select reserved = 1 from pg_temp.inv('PF-FDP-03')), 'lazada order reserved FDP-03');
select public.ingest_order('lazada', 'LZ-1', now(), '[]', null, null, null, 'cancelled', 'canceled', null, 'sample');
select pg_temp.check((select status = 'cancelled' from orders where external_order_id='LZ-1'), 'cancelled before pack');
select pg_temp.check((select reserved = 0 from pg_temp.inv('PF-FDP-03')) and (select reserved = 0 from pg_temp.inv('PF-FDP-02')), 'reservation released');
select public.ingest_order('lazada', 'LZ-1', now(), '[]', null, null, null, 'cancelled', 'canceled', null, 'sample');
select pg_temp.check((select count(*) = 2 from stock_movements m join orders o on o.id = m.order_id where o.external_order_id='LZ-1' and kind='release'), 'repeat cancel does not release twice');

select public.ingest_order('shopee', 'SO-1', now(), '[]', null, null, null, 'cancelled', 'CANCELLED', null, 'sample');
select pg_temp.check((select status = 'packed' and needs_attention = 'cancelled_after_pack' from orders where external_order_id='SO-1'), 'cancel after pack flags attention, no stock change');
select pg_temp.check((select on_hand = 118 from pg_temp.inv('PF-FDP-01')), 'stock unchanged by cancel after pack');

-- 8. Returns: good back to stock, damaged recorded only, cannot exceed ordered qty.
set role authenticated;
select public.record_return((select id from orders where external_order_id='SO-1'),
  jsonb_build_array(jsonb_build_object('item_id', (select oi.id from order_items oi join orders o on o.id=oi.order_id where o.external_order_id='SO-1'), 'good', 1, 'damaged', 1)), 'ลูกค้าตีกลับ');
select pg_temp.check((select on_hand = 119 from pg_temp.inv('PF-FDP-01')), 'return: +1 good, damaged not restocked');
do $$ begin
  perform public.record_return((select id from orders where external_order_id='SO-1'),
    jsonb_build_array(jsonb_build_object('item_id', (select oi.id from order_items oi join orders o on o.id=oi.order_id where o.external_order_id='SO-1'), 'good', 1)));
  raise exception 'FAIL: over-return allowed';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok  return cannot exceed ordered qty';
end $$;

-- 9. Unmapped SKU: no reservation, cannot pack; binding the listing reserves it.
reset role;
select public.ingest_order('tiktok', 'TT-1', now(), '[{"sku":"TT-FDP03","qty":1}]', null, null, 890, 'ready', 'AWAITING_SHIPMENT', '82019999', 'sample');
select pg_temp.check((select needs_attention = 'unmapped_sku' from orders where external_order_id='TT-1'), 'unmapped order flagged');
set role authenticated;
select pg_temp.check((public.start_pack('82019999') ->> 'error') = 'unmapped_sku', 'unmapped order cannot be packed');
select pg_temp.check(public.bind_listing((select id from products where sku='PF-FDP-03'), 'tiktok', 'TT-FDP03') = 1, 'binding fixes 1 waiting order');
select pg_temp.check((select reserved = 1 from pg_temp.inv('PF-FDP-03')), 'bound line reserved');
select pg_temp.check((select needs_attention is null from orders where external_order_id='TT-1'), 'attention cleared');

-- 10. Unpaid orders reserve but cannot be packed. Adjust/receive with rules.
reset role;
select public.ingest_order('shopee', 'SO-UNPAID', now(), '[{"sku":"SP-FDP02","qty":1}]', null, null, 890, 'unpaid', 'UNPAID', null, 'sample');
set role authenticated;
select pg_temp.check((public.start_pack('SO-UNPAID') ->> 'error') = 'unpaid', 'unpaid order cannot be packed');
do $$ begin
  perform public.receive_stock((select id from products where sku='PF-FDP-03'), 12, 'x');
  raise exception 'FAIL: receive without packaging set';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok  receive needs bottle, cap and box set';
end $$;
insert into packaging_items (name, kind, qty, unit_price) values ('T-bottle', 'ขวด', 20, 10), ('T-cap', 'ฝา', 100, 2), ('T-box', 'กล่อง', 20, 5);
insert into app_settings (key, value) values ('cap_item_id', to_jsonb((select id from packaging_items where name='T-cap')::text));
update products set bottle_id = (select id from packaging_items where name='T-bottle'), box_id = (select id from packaging_items where name='T-box') where sku='PF-FDP-03';
do $$ begin
  perform public.receive_stock((select id from products where sku='PF-FDP-03'), 21, 'x');
  raise exception 'FAIL: receive with too little packaging';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok  receive blocked when packaging is short';
end $$;
select public.receive_stock((select id from products where sku='PF-FDP-03'), 12, 'รับจากโรงงาน');
select pg_temp.check((select string_agg(qty::text, ',' order by name) from packaging_items where name like 'T-%') = '8,8,88', 'receive uses 1 bottle + 1 cap + 1 box per piece');
select pg_temp.check((select on_hand = 30 from pg_temp.inv('PF-FDP-03')), 'receive +12');
do $$ begin
  perform public.adjust_stock((select id from products where sku='PF-FDP-03'), -500, 'test');
  raise exception 'FAIL: negative stock allowed';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok  adjust cannot push on_hand below zero (%)', sqlerrm;
end $$;
do $$ begin
  perform public.adjust_stock((select id from products where sku='PF-FDP-03'), -1, '  ');
  raise exception 'FAIL: adjust without reason';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok  adjust needs a reason';
end $$;

-- 11. Pack is blocked when stock on hand is short.
reset role;
select private._move((select id from products where sku='PF-FDP-02'), 'adjust', 64, -64, 0, null, 'test drain', null);
select public.ingest_order('shopee', 'SO-SHORT', now(), '[{"sku":"SP-FDP02","qty":1}]', null, null, 890, 'ready', 'READY_TO_SHIP', 'TH-SHORT', 'sample');
set role authenticated;
select public.start_pack('TH-SHORT');
do $$ begin
  perform public.confirm_pack((select id from orders where external_order_id='SO-SHORT'), jsonb_build_object((select id from products where sku='PF-FDP-02')::text, 1));
  raise exception 'FAIL: packed without stock';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok  confirm refused when on_hand is short (%)', sqlerrm;
end $$;
select pg_temp.check((select status = 'packing' from orders where external_order_id='SO-SHORT'), 'order stays in packing after refused confirm');

-- 12. Ledger matches counters for every product.
reset role;
select pg_temp.check(not exists (
  select 1 from inventory i
  left join (select product_id, sum(delta_on_hand) oh, sum(delta_reserved) rs from stock_movements group by product_id) m on m.product_id = i.product_id
  where i.on_hand <> coalesce(m.oh, 0) or i.reserved <> coalesce(m.rs, 0)), 'inventory equals sum of ledger');
select pg_temp.check(not exists (
  select 1 from inventory i where i.reserved <> (select coalesce(sum(oi.reserved_qty),0) from order_items oi join orders o on o.id = oi.order_id
    where oi.product_id = i.product_id and o.status in ('pending','packing'))), 'reserved equals open order reservations');

-- 13. Sample order generator works for staff.
set role authenticated;
select pg_temp.check(public.create_sample_order() is not null, 'sample order created');
reset role;
-- 14. Hand over to courier: needs a courier (photos optional); only packed orders move to shipped.
set role authenticated;
do $$ begin
  perform public.hand_over(array[(select id from orders where external_order_id='SO-1')], ' ', array[]::text[]);
  raise exception 'FAIL: handover without courier';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok  handover needs a courier';
end $$;
reset role;
select public.ingest_order('shopee', 'SO-HO', now(), '[{"sku":"SP-FDP01","qty":1}]', null, null, 890, 'ready', 'READY_TO_SHIP', 'TH-HO', 'sample');
set role authenticated;
select public.start_pack('TH-HO');
select public.confirm_pack((select id from orders where external_order_id='SO-HO'), jsonb_build_object((select id from products where sku='PF-FDP-01')::text, 1));
select pg_temp.check((public.hand_over(array[(select id from orders where external_order_id='SO-HO'), (select id from orders where external_order_id='TT-1')],
  'Flash Express', array[]::text[]) ->> 'count')::int = 1, 'handover without photos marks only the packed order');
select pg_temp.check((select status = 'shipped' and handover_id is not null from orders where external_order_id='SO-HO'), 'packed order is now shipped with handover');
select pg_temp.check((select status = 'pending' from orders where external_order_id='TT-1'), 'unpacked order untouched');
reset role;
-- 15. Notifications
select pg_temp.check((select count(*) > 0 from notifications where kind = 'new_order' and dedupe_key = 'order:' || (select id from orders where external_order_id='SO-1')), 'new order creates a notification');
select pg_temp.check((select count(*) = 1 from notifications where kind = 'new_order' and dedupe_key = 'order:' || (select id from orders where external_order_id='SO-1')), 'resyncing an order does not notify twice');
-- FDP-03 started at 18 (<= 20) so it never crossed; push FDP-01 down across its threshold.
select private._move((select id from products where sku='PF-FDP-01'), 'adjust', 100, -100, 0, null, 'test drain', null);
select pg_temp.check((select count(*) = 1 from notifications where kind = 'low_stock' and title like '%PF-FDP-01%'), 'low stock notifies when crossing the alert level');
select private._move((select id from products where sku='PF-FDP-01'), 'adjust', 1, -1, 0, null, 'test drain more', null);
select pg_temp.check((select count(*) = 1 from notifications where kind = 'low_stock' and title like '%PF-FDP-01%'), 'no repeat while already low');
update orders set packed_at = now() - interval '2 days' where external_order_id = 'SO-UNPAID';
reset role;
insert into orders (platform, external_order_id, ordered_at, status, packed_at) values ('shopee', 'SO-LATE', now() - interval '3 days', 'packed', now() - interval '2 days');
select pg_temp.check((public.run_daily_checks() ->> 'late')::int >= 1, 'daily check counts parcels not handed over');
select pg_temp.check((select count(*) = 1 from notifications where kind = 'handover_overdue'), 'overdue notification created');
select public.run_daily_checks();
select pg_temp.check((select count(*) = 1 from notifications where kind = 'handover_overdue'), 'daily check does not repeat the same day');
set role authenticated;
delete from notifications;
reset role;
select pg_temp.check((select count(*) = 0 from notifications), 'staff can clear all notifications');
-- 16. Consignment shops
create temp table t_shop as select id from shops where name like 'PETCLUB%' limit 1;
grant select on t_shop to authenticated;
create temp table t_before as select product_id, on_hand, reserved from inventory where product_id = (select id from products where sku='PF-FDP-01');
grant select on t_before to authenticated;
set role authenticated;
select public.send_to_shop((select id from t_shop), jsonb_build_object((select id from products where sku='PF-FDP-01')::text, 5));
reset role;
select pg_temp.check((select i.on_hand = b.on_hand - 5 from inventory i join t_before b using (product_id)), 'sending to shop takes it out of central stock');
select pg_temp.check((select qty = 5 from shop_stock where shop_id = (select id from t_shop)), 'shop now holds 5');
set role authenticated;
do $$ begin
  perform public.send_to_shop((select id from t_shop), jsonb_build_object((select id from products where sku='PF-FDP-01')::text, 100000));
  raise exception 'FAIL: sent more than available';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok  cannot send more than available';
end $$;
select public.shop_sold((select id from t_shop), (select id from products where sku='PF-FDP-01'), 2);
select public.return_from_shop((select id from t_shop), jsonb_build_object((select id from products where sku='PF-FDP-01')::text, 1));
do $$ begin
  perform public.shop_sold((select id from t_shop), (select id from products where sku='PF-FDP-01'), 10);
  raise exception 'FAIL: sold more than at shop';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok  cannot report more sold than the shop holds';
end $$;
reset role;
select pg_temp.check((select qty = 2 from shop_stock where shop_id = (select id from t_shop)), 'shop holds 2 after selling 2 and returning 1');
select pg_temp.check((select i.on_hand = b.on_hand - 4 from inventory i join t_before b using (product_id)), 'returned piece is back in central stock');
-- 17. Warehouse packaging
set role authenticated;
insert into packaging_items (name, kind, qty, unit_price) values ('ขวด 50ml', 'ขวด', 10, 12.5);
select pg_temp.check(public.adjust_packaging((select id from packaging_items where name='ขวด 50ml'), -4) = 6, 'packaging stock goes down');
do $$ begin
  perform public.adjust_packaging((select id from packaging_items where name='ขวด 50ml'), -7);
  raise exception 'FAIL: packaging below zero';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok  packaging cannot go below zero';
end $$;
delete from packaging_items where name='ขวด 50ml';
reset role;
select pg_temp.check((select count(*) = 0 from packaging_items where name='ขวด 50ml'), 'staff can delete packaging items');
\echo ALL TESTS PASSED
