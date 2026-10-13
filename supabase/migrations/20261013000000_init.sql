-- PET-FRIENDLY back office — initial schema
--
-- Stock rules (from the brief):
--   * Reserve when an order arrives: reserved += qty, on_hand unchanged. Available = on_hand - reserved.
--   * Confirm pack: on_hand -= qty and release that order's reservation, exactly once.
--   * Re-syncing an order or re-scanning must never reserve or deduct twice.
--   * Cancel before pack releases the reservation; after pack it needs a recorded return.
--   * Scanning a label never moves stock by itself.
--
-- Every stock change goes through private._move(), which writes one stock_movements row
-- (unique idem_key) and updates inventory in the same transaction. Clients cannot write
-- inventory, stock_movements or orders directly; they call the SECURITY DEFINER functions
-- below, which lock the order row first so concurrent calls serialise per order.

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------- types
create type public.platform as enum ('shopee', 'lazada', 'tiktok');
create type public.order_status as enum ('pending', 'packing', 'packed', 'shipped', 'cancelled');
-- Normalised marketplace state. Adapters map each platform's raw status into one of these;
-- the raw text is kept in orders.marketplace_status.
create type public.marketplace_state as enum ('unpaid', 'ready', 'shipped', 'delivered', 'cancelled');
create type public.order_source as enum ('api', 'import', 'sample');
create type public.movement_kind as enum ('receive', 'reserve', 'release', 'deduct', 'return', 'adjust', 'damage');

-- ---------------------------------------------------------------- users
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  email text,
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------- products & stock
create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique check (sku ~ '^[A-Z0-9][A-Z0-9-]{1,40}$'),
  name text not null,
  option_name text not null default '',
  low_stock_threshold integer not null default 20 check (low_stock_threshold >= 0),
  dm_fg text not null default '#000000' check (dm_fg ~ '^#[0-9A-Fa-f]{6}$'),
  dm_bg text not null default '#FFFFFF' check (dm_bg ~ '^#[0-9A-Fa-f]{6}$'),
  image_url text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- The SKU is printed into the Data Matrix on packaging, so it can never change.
create or replace function private.lock_sku() returns trigger language plpgsql as $$
begin
  if new.sku is distinct from old.sku then
    raise exception 'sku_locked' using hint = 'SKU ถูกพิมพ์ลงบรรจุภัณฑ์แล้ว เปลี่ยนไม่ได้';
  end if;
  return new;
end $$;
create trigger products_lock_sku before update on public.products
  for each row execute function private.lock_sku();

create table public.inventory (
  product_id uuid primary key references public.products (id) on delete restrict,
  on_hand integer not null default 0 check (on_hand >= 0),
  reserved integer not null default 0 check (reserved >= 0),
  updated_at timestamptz not null default now()
);

create or replace function private.create_inventory_row() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.inventory (product_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger products_inventory after insert on public.products
  for each row execute function private.create_inventory_row();

-- Marketplace listing → internal SKU. units_per_item lets a future "2-pack" listing
-- reserve 2 units; today every listing is 1:1.
create table public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  platform public.platform not null,
  external_sku text not null,
  units_per_item integer not null default 1 check (units_per_item > 0),
  created_at timestamptz not null default now(),
  unique (platform, external_sku)
);

-- ---------------------------------------------------------------- orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  platform public.platform not null,
  external_order_id text not null,
  source public.order_source not null default 'api',
  ordered_at timestamptz not null,
  buyer_name text,
  recipient_name text,
  total_amount numeric(12, 2),
  currency text not null default 'THB',
  status public.order_status not null default 'pending',
  marketplace_state public.marketplace_state not null default 'ready',
  marketplace_status text,
  tracking_number text,
  needs_attention text,
  pack_round integer not null default 1,
  packing_by uuid references public.profiles (id),
  packing_started_at timestamptz,
  packed_by uuid references public.profiles (id),
  packed_at timestamptz,
  shipped_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, external_order_id)
);
create index orders_status_idx on public.orders (status, ordered_at);
create index orders_tracking_idx on public.orders (upper(tracking_number));
create index orders_external_idx on public.orders (upper(external_order_id));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  line_no integer not null,
  platform_sku text not null,
  title text,
  product_id uuid references public.products (id),
  quantity integer not null check (quantity > 0),       -- units of the internal SKU
  listing_quantity integer not null check (listing_quantity > 0), -- as ordered on the marketplace
  unit_price numeric(12, 2),
  reserved_qty integer not null default 0 check (reserved_qty >= 0),
  returned_qty integer not null default 0 check (returned_qty >= 0),
  unique (order_id, line_no)
);
create index order_items_product_idx on public.order_items (product_id);
create index order_items_unmapped_idx on public.order_items (platform_sku) where product_id is null;

-- Barcodes read from a shipping label that are not the tracking number or order id.
create table public.order_label_codes (
  code text primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  kind text not null,
  message text not null,
  actor uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

create table public.stock_movements (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products (id),
  kind public.movement_kind not null,
  quantity integer not null check (quantity > 0),
  delta_on_hand integer not null,
  delta_reserved integer not null,
  order_id uuid references public.orders (id),
  note text,
  actor uuid references public.profiles (id),
  idem_key text unique,
  created_at timestamptz not null default now()
);
create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);
create index stock_movements_created_idx on public.stock_movements (created_at desc);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- views
create view public.product_stock with (security_invoker = true) as
select p.*, i.on_hand, i.reserved, i.on_hand - i.reserved as available,
       (i.on_hand - i.reserved) <= p.low_stock_threshold as is_low
from public.products p
join public.inventory i on i.product_id = p.id;

-- ---------------------------------------------------------------- core helpers (private)
create or replace function private.actor() returns uuid language sql stable as $$
  select auth.uid()
$$;

create or replace function private.require_user() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.profiles where id = uid and disabled) then
    raise exception 'account_disabled';
  end if;
  return uid;
end $$;

-- Writes one movement and applies it. Returns false (and changes nothing) when the
-- idem_key was already used.
create or replace function private._move(
  p_product uuid, p_kind public.movement_kind, p_qty integer,
  p_d_on_hand integer, p_d_reserved integer,
  p_order uuid, p_note text, p_key text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare inserted bigint;
begin
  if p_qty <= 0 then return false; end if;
  insert into public.stock_movements (product_id, kind, quantity, delta_on_hand, delta_reserved, order_id, note, actor, idem_key)
  values (p_product, p_kind, p_qty, p_d_on_hand, p_d_reserved, p_order, p_note, auth.uid(), p_key)
  on conflict (idem_key) do nothing
  returning id into inserted;
  if inserted is null then return false; end if;

  update public.inventory
     set on_hand = on_hand + p_d_on_hand,
         reserved = reserved + p_d_reserved,
         updated_at = now()
   where product_id = p_product;
  return true;
exception when check_violation then
  raise exception 'insufficient_stock' using detail = p_product::text;
end $$;

create or replace function private._event(p_order uuid, p_kind text, p_message text) returns void
language sql security definer set search_path = '' as $$
  insert into public.order_events (order_id, kind, message, actor) values (p_order, p_kind, p_message, auth.uid());
$$;

-- Reserve every mapped, not-yet-reserved line of an open order.
create or replace function private._reserve_order(p_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders; it public.order_items;
begin
  select * into o from public.orders where id = p_order;
  if o.status not in ('pending', 'packing') then return; end if;
  for it in select * from public.order_items where order_id = p_order and product_id is not null and reserved_qty = 0 order by line_no loop
    perform private._move(it.product_id, 'reserve', it.quantity, 0, it.quantity, p_order, null,
                          format('reserve:%s:%s:%s', it.id, o.pack_round, 'r'));
    update public.order_items set reserved_qty = it.quantity where id = it.id;
  end loop;
end $$;

create or replace function private._release_order(p_order uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders; it public.order_items;
begin
  select * into o from public.orders where id = p_order;
  for it in select * from public.order_items where order_id = p_order and reserved_qty > 0 order by line_no loop
    perform private._move(it.product_id, 'release', it.reserved_qty, 0, -it.reserved_qty, p_order, p_note,
                          format('release:%s:%s', it.id, o.pack_round));
    update public.order_items set reserved_qty = 0 where id = it.id;
  end loop;
end $$;

-- ---------------------------------------------------------------- order ingestion
-- Idempotent upsert of one marketplace order. Called by API/webhook adapters (service role)
-- and by create_sample_order(). p_items: [{"sku": "...", "title": "...", "qty": 1, "price": 890}]
create or replace function public.ingest_order(
  p_platform public.platform,
  p_external_id text,
  p_ordered_at timestamptz,
  p_items jsonb,
  p_buyer text default null,
  p_recipient text default null,
  p_total numeric default null,
  p_marketplace_state public.marketplace_state default 'ready',
  p_marketplace_status text default null,
  p_tracking text default null,
  p_source public.order_source default 'api'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  oid uuid;
  item jsonb;
  n integer := 0;
  l public.marketplace_listings;
begin
  select * into o from public.orders where platform = p_platform and external_order_id = p_external_id for update;

  if not found then
    insert into public.orders (platform, external_order_id, source, ordered_at, buyer_name, recipient_name, total_amount,
                               marketplace_state, marketplace_status, tracking_number)
    values (p_platform, p_external_id, p_source, p_ordered_at, p_buyer, p_recipient, p_total,
            p_marketplace_state, p_marketplace_status, nullif(trim(p_tracking), ''))
    on conflict (platform, external_order_id) do nothing
    returning id into oid;

    if oid is null then
      -- Lost a race with a concurrent ingest of the same order; treat as an update.
      return public.ingest_order(p_platform, p_external_id, p_ordered_at, p_items, p_buyer, p_recipient, p_total,
                                 p_marketplace_state, p_marketplace_status, p_tracking, p_source);
    end if;

    for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
      n := n + 1;
      select * into l from public.marketplace_listings where platform = p_platform and external_sku = item ->> 'sku';
      insert into public.order_items (order_id, line_no, platform_sku, title, product_id, quantity, listing_quantity, unit_price)
      values (oid, n, item ->> 'sku', item ->> 'title', l.product_id,
              (item ->> 'qty')::integer * coalesce(l.units_per_item, 1), (item ->> 'qty')::integer,
              (item ->> 'price')::numeric);
    end loop;

    perform private._event(oid, 'received', format('รับออเดอร์จาก %s', initcap(p_platform::text)));

    if p_marketplace_state = 'cancelled' then
      update public.orders set status = 'cancelled', cancelled_at = now() where id = oid;
      perform private._event(oid, 'cancelled', 'ออเดอร์ถูกยกเลิกบน Marketplace ก่อนเข้าระบบ');
    else
      perform private._reserve_order(oid);
      if exists (select 1 from public.order_items where order_id = oid and product_id is null) then
        update public.orders set needs_attention = 'unmapped_sku' where id = oid;
      end if;
    end if;
    return oid;
  end if;

  -- Existing order: refresh what the marketplace told us. Items are not rewritten.
  update public.orders
     set marketplace_state = p_marketplace_state,
         marketplace_status = coalesce(p_marketplace_status, marketplace_status),
         tracking_number = coalesce(nullif(trim(p_tracking), ''), tracking_number),
         buyer_name = coalesce(p_buyer, buyer_name),
         recipient_name = coalesce(p_recipient, recipient_name),
         updated_at = now()
   where id = o.id;

  if p_marketplace_state is distinct from o.marketplace_state then
    perform private._event(o.id, 'marketplace', format('Marketplace แจ้งสถานะ %s', coalesce(p_marketplace_status, p_marketplace_state::text)));
  end if;

  if p_marketplace_state = 'cancelled' and o.status in ('pending', 'packing') then
    perform private._release_order(o.id, 'ออเดอร์ถูกยกเลิก');
    update public.orders set status = 'cancelled', cancelled_at = now(), packing_by = null where id = o.id;
    perform private._event(o.id, 'cancelled', 'ยกเลิกก่อนแพ็ก ปลดยอดจองแล้ว');
  elsif p_marketplace_state = 'cancelled' and o.status in ('packed', 'shipped') then
    update public.orders set needs_attention = 'cancelled_after_pack' where id = o.id;
    perform private._event(o.id, 'attention', 'ยกเลิกหลังแพ็กแล้ว ต้องรับของคืนและบันทึกสินค้าคืน');
  elsif p_marketplace_state in ('shipped', 'delivered') and o.status = 'packed' then
    update public.orders set status = 'shipped', shipped_at = now() where id = o.id;
  end if;
  return o.id;
end $$;

-- ---------------------------------------------------------------- packing
-- Find the order for a scanned label code and mark it as being packed.
-- Never moves stock. Returns {ok, error?, order_id?, ...}.
create or replace function public.start_pack(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  c text := upper(trim(p_code));
  ids uuid[];
  o public.orders;
  packer text;
begin
  if c = '' then return jsonb_build_object('ok', false, 'error', 'empty'); end if;
  select array_agg(distinct id) into ids from (
    select order_id as id from public.order_label_codes where upper(code) = c
    union all select id from public.orders where upper(tracking_number) = c
    union all select id from public.orders where upper(external_order_id) = c
  ) m;
  if ids is null then return jsonb_build_object('ok', false, 'error', 'not_found', 'code', p_code); end if;
  if array_length(ids, 1) > 1 then return jsonb_build_object('ok', false, 'error', 'ambiguous', 'code', p_code); end if;

  select * into o from public.orders where id = ids[1] for update;

  if o.status in ('packed', 'shipped') then
    select display_name into packer from public.profiles where id = o.packed_by;
    return jsonb_build_object('ok', false, 'error', 'already_packed', 'order_id', o.id, 'packed_at', o.packed_at, 'packed_by', packer);
  elsif o.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'error', 'cancelled', 'order_id', o.id);
  elsif o.marketplace_state = 'unpaid' then
    return jsonb_build_object('ok', false, 'error', 'unpaid', 'order_id', o.id);
  elsif exists (select 1 from public.order_items where order_id = o.id and product_id is null) then
    return jsonb_build_object('ok', false, 'error', 'unmapped_sku', 'order_id', o.id);
  end if;

  if o.status = 'packing' and o.packing_by is distinct from uid and o.packing_started_at > now() - interval '15 minutes' then
    select display_name into packer from public.profiles where id = o.packing_by;
    return jsonb_build_object('ok', false, 'error', 'being_packed', 'order_id', o.id, 'packing_by', packer);
  end if;

  update public.orders set status = 'packing', packing_by = uid, packing_started_at = now(), updated_at = now() where id = o.id;
  return jsonb_build_object('ok', true, 'order_id', o.id);
end $$;

-- Put an order that is being packed back in the queue. Reservation stays.
create or replace function public.park_pack(p_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_user();
  update public.orders set status = 'pending', packing_by = null, packing_started_at = null, updated_at = now()
   where id = p_order and status = 'packing';
end $$;

-- Confirm a pack. p_scanned: {"<product_id>": <units scanned>}. Counts must match the
-- order exactly. Deducts on_hand and releases the reservation once; calling again is a no-op.
create or replace function public.confirm_pack(p_order uuid, p_scanned jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  o public.orders;
  r record;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if o.status in ('packed', 'shipped') then return jsonb_build_object('ok', true, 'already', true); end if;
  if o.status not in ('pending', 'packing') then return jsonb_build_object('ok', false, 'error', o.status::text); end if;
  if o.marketplace_state in ('unpaid', 'cancelled') then return jsonb_build_object('ok', false, 'error', o.marketplace_state::text); end if;
  if exists (select 1 from public.order_items where order_id = o.id and product_id is null) then
    return jsonb_build_object('ok', false, 'error', 'unmapped_sku');
  end if;

  -- Required units per product vs. what was scanned.
  for r in
    select coalesce(req.product_id, sc.product_id) as product_id, coalesce(req.units, 0) as need, coalesce(sc.units, 0) as got
    from (select product_id, sum(quantity)::integer as units from public.order_items where order_id = o.id group by product_id) req
    full join (select key::uuid as product_id, value::integer as units from jsonb_each_text(coalesce(p_scanned, '{}'::jsonb))) sc
      on sc.product_id = req.product_id
  loop
    if r.need <> r.got then
      return jsonb_build_object('ok', false, 'error', 'count_mismatch', 'product_id', r.product_id, 'need', r.need, 'got', r.got);
    end if;
  end loop;

  for r in select * from public.order_items where order_id = o.id order by line_no loop
    perform private._move(r.product_id, 'deduct', r.quantity, -r.quantity, -r.reserved_qty, o.id, null,
                          format('deduct:%s:%s', r.id, o.pack_round));
    update public.order_items set reserved_qty = 0 where id = r.id;
  end loop;

  update public.orders
     set status = 'packed', packed_by = uid, packed_at = now(), packing_by = null, packing_started_at = null, updated_at = now()
   where id = o.id;
  perform private._event(o.id, 'packed', 'ยืนยันแพ็ก ตัดสต็อกแล้ว');
  return jsonb_build_object('ok', true, 'already', false);
end $$;

-- Packed by mistake: put stock back and send the order back to the queue.
create or replace function public.unpack_order(p_order uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders; r public.order_items; next_round integer;
begin
  perform private.require_user();
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  select * into o from public.orders where id = p_order for update;
  if o.status <> 'packed' then raise exception 'not_packed'; end if;
  next_round := o.pack_round + 1;
  for r in select * from public.order_items where order_id = o.id order by line_no loop
    perform private._move(r.product_id, 'return', r.quantity, r.quantity, 0, o.id, 'แพ็กผิด · ' || p_reason,
                          format('unpack:%s:%s', r.id, o.pack_round));
  end loop;
  update public.orders set status = 'pending', pack_round = next_round, packed_by = null, packed_at = null, updated_at = now()
   where id = o.id;
  perform private._event(o.id, 'unpacked', 'คืนสต็อก (แพ็กผิด) · ' || p_reason);
  if o.marketplace_state <> 'cancelled' then
    perform private._reserve_order(o.id);
  end if;
end $$;

-- Courier picked the parcel up. Internal status only; marketplace state is not touched.
create or replace function public.mark_handed_over(p_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_user();
  update public.orders set status = 'shipped', shipped_at = now(), updated_at = now() where id = p_order and status = 'packed';
  if found then perform private._event(p_order, 'handed_over', 'ส่งมอบให้ขนส่งแล้ว'); end if;
end $$;

-- Goods came back (return, failed delivery, cancelled after pack).
-- p_lines: [{"item_id": "...", "good": 1, "damaged": 0}]
create or replace function public.record_return(p_order uuid, p_lines jsonb, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders; ln jsonb; it public.order_items; good integer; bad integer; seq integer;
begin
  perform private.require_user();
  select * into o from public.orders where id = p_order for update;
  if o.status not in ('packed', 'shipped') then raise exception 'not_packed'; end if;
  select count(*) into seq from public.order_events where order_id = o.id and kind = 'returned';
  for ln in select * from jsonb_array_elements(p_lines) loop
    select * into it from public.order_items where id = (ln ->> 'item_id')::uuid and order_id = o.id for update;
    if not found then raise exception 'item_not_in_order'; end if;
    good := coalesce((ln ->> 'good')::integer, 0);
    bad := coalesce((ln ->> 'damaged')::integer, 0);
    if good < 0 or bad < 0 then raise exception 'invalid_quantity'; end if;
    if it.returned_qty + good + bad > it.quantity then raise exception 'return_exceeds_order'; end if;
    perform private._move(it.product_id, 'return', good, good, 0, o.id, coalesce(p_note, 'สินค้าคืน สภาพดี'),
                          format('return:%s:%s:good', it.id, seq));
    perform private._move(it.product_id, 'damage', bad, 0, 0, o.id, coalesce(p_note, 'สินค้าคืน ชำรุด'),
                          format('return:%s:%s:damaged', it.id, seq));
    update public.order_items set returned_qty = returned_qty + good + bad where id = it.id;
  end loop;
  if o.needs_attention = 'cancelled_after_pack' then
    update public.orders set needs_attention = null where id = o.id;
  end if;
  perform private._event(o.id, 'returned', 'บันทึกสินค้าคืน' || coalesce(' · ' || p_note, ''));
end $$;

create or replace function public.bind_label_code(p_code text, p_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user();
begin
  insert into public.order_label_codes (code, order_id, created_by) values (upper(trim(p_code)), p_order, uid);
  perform private._event(p_order, 'label', 'ผูกรหัสใบปะหน้า ' || upper(trim(p_code)));
end $$;

-- ---------------------------------------------------------------- stock admin
create or replace function public.receive_stock(p_product uuid, p_qty integer, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_user();
  if p_qty is null or p_qty <= 0 then raise exception 'invalid_quantity'; end if;
  perform 1 from public.inventory where product_id = p_product for update;
  perform private._move(p_product, 'receive', p_qty, p_qty, 0, null, p_note, null);
end $$;

create or replace function public.adjust_stock(p_product uuid, p_delta integer, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_user();
  if p_delta is null or p_delta = 0 then raise exception 'invalid_quantity'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  perform 1 from public.inventory where product_id = p_product for update;
  perform private._move(p_product, 'adjust', abs(p_delta), p_delta, 0, null, p_reason, null);
end $$;

-- Map a marketplace SKU to a product, then attach and reserve any waiting order lines.
create or replace function public.bind_listing(p_product uuid, p_platform public.platform, p_external_sku text) returns integer
language plpgsql security definer set search_path = '' as $$
declare l public.marketplace_listings; it record; fixed integer := 0;
begin
  perform private.require_user();
  insert into public.marketplace_listings (product_id, platform, external_sku)
  values (p_product, p_platform, trim(p_external_sku))
  returning * into l;

  for it in
    select oi.id, oi.order_id, oi.listing_quantity from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.product_id is null and oi.platform_sku = l.external_sku and o.platform = p_platform
      and o.status in ('pending', 'packing')
    order by o.ordered_at
  loop
    perform 1 from public.orders where id = it.order_id for update;
    update public.order_items set product_id = l.product_id, quantity = it.listing_quantity * l.units_per_item where id = it.id;
    perform private._reserve_order(it.order_id);
    if not exists (select 1 from public.order_items where order_id = it.order_id and product_id is null) then
      update public.orders set needs_attention = null where id = it.order_id and needs_attention = 'unmapped_sku';
    end if;
    perform private._event(it.order_id, 'mapped', 'ผูก SKU ' || l.external_sku);
    fixed := fixed + 1;
  end loop;
  return fixed;
end $$;

create or replace function public.unbind_listing(p_listing uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_user();
  delete from public.marketplace_listings where id = p_listing;
end $$;

-- ---------------------------------------------------------------- sample data
-- Creates one realistic test order. Marked source = 'sample' so it can be told apart.
create or replace function public.create_sample_order() returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  plat public.platform := (array['shopee', 'lazada', 'tiktok']::public.platform[])[1 + floor(random() * 3)::integer];
  ext text;
  trk text;
  items jsonb := '[]'::jsonb;
  l record;
  lines integer := 1 + (random() < 0.3)::integer;
  total numeric := 0;
  q integer;
begin
  perform private.require_user();
  ext := case plat
    when 'shopee' then to_char(now(), 'YYMMDD') || upper(substr(md5(random()::text), 1, 8))
    when 'lazada' then (7e14 + floor(random() * 1e14))::bigint::text
    else (5763e14 + floor(random() * 1e14))::bigint::text end;
  trk := case plat
    when 'shopee' then 'TH' || to_char(now(), 'YYMMDD') || upper(substr(md5(random()::text), 1, 5))
    when 'lazada' then 'LEXDO' || lpad(floor(random() * 1e10)::bigint::text, 10, '0')
    else '8201' || lpad(floor(random() * 1e8)::bigint::text, 8, '0') end;
  for l in
    select ml.external_sku, p.name, p.option_name from public.marketplace_listings ml
    join public.products p on p.id = ml.product_id
    where ml.platform = plat and not p.archived order by random() limit lines
  loop
    q := 1 + (random() < 0.25)::integer;
    items := items || jsonb_build_object('sku', l.external_sku, 'title', l.name || ' ' || l.option_name, 'qty', q, 'price', 890);
    total := total + 890 * q;
  end loop;
  if jsonb_array_length(items) = 0 then raise exception 'no_listings' using hint = 'ผูก SKU ของ Marketplace กับสินค้าก่อน'; end if;
  return public.ingest_order(plat, ext, now(), items, 'ลูกค้าตัวอย่าง', 'ผู้รับตัวอย่าง', total,
                             'ready', case plat when 'shopee' then 'READY_TO_SHIP' when 'lazada' then 'ready_to_ship' else 'AWAITING_SHIPMENT' end,
                             trk, 'sample');
end $$;

-- ---------------------------------------------------------------- security
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.inventory enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_label_codes enable row level security;
alter table public.order_events enable row level security;
alter table public.stock_movements enable row level security;
alter table public.app_settings enable row level security;

create or replace function private.is_active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and not exists (select 1 from public.profiles where id = auth.uid() and disabled)
$$;
grant usage on schema private to authenticated;
grant execute on function private.is_active_user() to authenticated;

-- Read access for signed-in staff on everything.
create policy staff_read on public.profiles for select to authenticated using (private.is_active_user());
create policy staff_read on public.products for select to authenticated using (private.is_active_user());
create policy staff_read on public.inventory for select to authenticated using (private.is_active_user());
create policy staff_read on public.marketplace_listings for select to authenticated using (private.is_active_user());
create policy staff_read on public.orders for select to authenticated using (private.is_active_user());
create policy staff_read on public.order_items for select to authenticated using (private.is_active_user());
create policy staff_read on public.order_label_codes for select to authenticated using (private.is_active_user());
create policy staff_read on public.order_events for select to authenticated using (private.is_active_user());
create policy staff_read on public.stock_movements for select to authenticated using (private.is_active_user());
create policy staff_read on public.app_settings for select to authenticated using (private.is_active_user());

-- Direct writes only where they cannot break stock: product details, own profile, settings.
create policy staff_insert on public.products for insert to authenticated with check (private.is_active_user());
create policy staff_update on public.products for update to authenticated using (private.is_active_user()) with check (private.is_active_user());
create policy own_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy staff_write on public.app_settings for all to authenticated using (private.is_active_user()) with check (private.is_active_user());

revoke all on all tables in schema public from anon;
revoke insert, update, delete on public.inventory, public.stock_movements, public.orders, public.order_items,
  public.order_label_codes, public.order_events, public.marketplace_listings from authenticated;
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_active_user() to authenticated;
grant execute on function
  public.start_pack(text), public.park_pack(uuid), public.confirm_pack(uuid, jsonb), public.unpack_order(uuid, text),
  public.mark_handed_over(uuid), public.record_return(uuid, jsonb, text), public.bind_label_code(text, uuid),
  public.receive_stock(uuid, integer, text), public.adjust_stock(uuid, integer, text),
  public.bind_listing(uuid, public.platform, text), public.unbind_listing(uuid), public.create_sample_order()
  to authenticated;
-- ingest_order is for server-side adapters only.
grant execute on function public.ingest_order(public.platform, text, timestamptz, jsonb, text, text, numeric,
  public.marketplace_state, text, text, public.order_source) to service_role;

-- Live updates for the pack queue and stock numbers (Supabase Realtime).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.orders, public.inventory;
  end if;
end $$;

-- Brand logo storage (public read, staff write).
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('brand', 'brand', true) on conflict (id) do nothing;
    execute $p$create policy brand_staff_write on storage.objects for insert to authenticated
      with check (bucket_id = 'brand' and private.is_active_user())$p$;
    execute $p$create policy brand_staff_update on storage.objects for update to authenticated
      using (bucket_id = 'brand' and private.is_active_user())$p$;
  end if;
end $$;
