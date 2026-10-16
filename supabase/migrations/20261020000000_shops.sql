-- Consignment shops (e.g. PETCLUB). Stock sent to a shop leaves the central stock and is
-- tracked per shop until the shop reports it sold or returns it.

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  contact text,
  phone text,
  address text,
  archived boolean not null default false,       -- "ลบ" hides the shop; its history stays
  created_at timestamptz not null default now()
);
create unique index shops_name_idx on public.shops (lower(name)) where not archived;

-- Delivery notes (ใบส่งของ) and return notes (ใบรับคืน).
create table public.shop_docs (
  id uuid primary key default gen_random_uuid(),
  no bigint generated always as identity,
  shop_id uuid not null references public.shops (id),
  kind text not null check (kind in ('send', 'return')),
  note text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.shop_stock (
  shop_id uuid not null references public.shops (id),
  product_id uuid not null references public.products (id),
  qty integer not null default 0 check (qty >= 0),
  primary key (shop_id, product_id)
);

create table public.shop_moves (
  id bigint generated always as identity primary key,
  shop_id uuid not null references public.shops (id),
  product_id uuid not null references public.products (id),
  kind text not null check (kind in ('send', 'sold', 'return', 'adjust')),
  qty integer not null,                           -- change at the shop (+ sent, − sold/returned)
  doc_id uuid references public.shop_docs (id),
  note text,
  actor uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index shop_moves_shop_idx on public.shop_moves (shop_id, created_at desc);

alter table public.shops enable row level security;
alter table public.shop_docs enable row level security;
alter table public.shop_stock enable row level security;
alter table public.shop_moves enable row level security;
create policy staff_read on public.shops for select to authenticated using (private.is_active_user());
create policy staff_insert on public.shops for insert to authenticated with check (private.is_active_user());
create policy staff_update on public.shops for update to authenticated using (private.is_active_user()) with check (private.is_active_user());
create policy staff_read on public.shop_docs for select to authenticated using (private.is_active_user());
create policy staff_read on public.shop_stock for select to authenticated using (private.is_active_user());
create policy staff_read on public.shop_moves for select to authenticated using (private.is_active_user());
revoke all on public.shops, public.shop_docs, public.shop_stock, public.shop_moves from anon;
grant select, insert, update on public.shops to authenticated;
grant select on public.shop_docs, public.shop_stock, public.shop_moves to authenticated;

create or replace function private._shop_move(p_shop uuid, p_product uuid, p_kind text, p_qty integer, p_doc uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.shop_stock (shop_id, product_id, qty) values (p_shop, p_product, 0) on conflict do nothing;
  update public.shop_stock set qty = qty + p_qty where shop_id = p_shop and product_id = p_product;
  insert into public.shop_moves (shop_id, product_id, kind, qty, doc_id, note, actor)
  values (p_shop, p_product, p_kind, p_qty, p_doc, p_note, auth.uid());
exception when check_violation then
  raise exception 'shop_stock_short' using detail = p_product::text;
end $$;

-- Send stock to a shop. p_items = {"<product id>": qty, ...}. Only "available" stock
-- (in stock minus reserved for orders) can be sent.
create or replace function public.send_to_shop(p_shop uuid, p_items jsonb, p_note text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); d uuid; s public.shops; it record; inv public.inventory; dn text;
begin
  select * into s from public.shops where id = p_shop and not archived;
  if not found then raise exception 'shop_not_found'; end if;
  if p_items is null or not exists (select 1 from jsonb_each_text(p_items) where value::int > 0) then raise exception 'nothing_selected'; end if;
  insert into public.shop_docs (shop_id, kind, note, created_by) values (p_shop, 'send', nullif(trim(p_note), ''), uid) returning id into d;
  select 'DN-' || lpad(no::text, 5, '0') into dn from public.shop_docs where id = d;
  for it in select key::uuid as product_id, value::int as qty from jsonb_each_text(p_items) where value::int > 0 order by key loop
    select * into inv from public.inventory where product_id = it.product_id for update;
    if not found or inv.on_hand - inv.reserved < it.qty then raise exception 'insufficient_stock' using detail = it.product_id::text; end if;
    perform private._move(it.product_id, 'deduct', it.qty, -it.qty, 0, null, 'ส่งฝากขาย ' || s.name || ' · ' || dn, 'shop:' || d || ':' || it.product_id);
    perform private._shop_move(p_shop, it.product_id, 'send', it.qty, d, null);
  end loop;
  return d;
end $$;

-- Shop returns unsold stock: back into central stock.
create or replace function public.return_from_shop(p_shop uuid, p_items jsonb, p_note text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); d uuid; s public.shops; it record; rn text;
begin
  select * into s from public.shops where id = p_shop;
  if not found then raise exception 'shop_not_found'; end if;
  if p_items is null or not exists (select 1 from jsonb_each_text(p_items) where value::int > 0) then raise exception 'nothing_selected'; end if;
  insert into public.shop_docs (shop_id, kind, note, created_by) values (p_shop, 'return', nullif(trim(p_note), ''), uid) returning id into d;
  select 'RN-' || lpad(no::text, 5, '0') into rn from public.shop_docs where id = d;
  for it in select key::uuid as product_id, value::int as qty from jsonb_each_text(p_items) where value::int > 0 order by key loop
    perform private._shop_move(p_shop, it.product_id, 'return', -it.qty, d, null);
    perform 1 from public.inventory where product_id = it.product_id for update;
    perform private._move(it.product_id, 'return', it.qty, it.qty, 0, null, 'รับคืนจาก ' || s.name || ' · ' || rn, 'shopret:' || d || ':' || it.product_id);
  end loop;
  return d;
end $$;

-- Shop reports pieces sold (central stock is not touched; it left when sent).
create or replace function public.shop_sold(p_shop uuid, p_product uuid, p_qty integer, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_user();
  if p_qty is null or p_qty <= 0 then raise exception 'invalid_quantity'; end if;
  perform private._shop_move(p_shop, p_product, 'sold', -p_qty, null, nullif(trim(p_note), ''));
end $$;

-- Correct the count at a shop (e.g. after a stock check at the shop).
create or replace function public.shop_adjust(p_shop uuid, p_product uuid, p_delta integer, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_user();
  if p_delta is null or p_delta = 0 then raise exception 'invalid_quantity'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  perform private._shop_move(p_shop, p_product, 'adjust', p_delta, null, trim(p_reason));
end $$;

revoke execute on function public.send_to_shop(uuid, jsonb, text), public.return_from_shop(uuid, jsonb, text),
  public.shop_sold(uuid, uuid, integer, text), public.shop_adjust(uuid, uuid, integer, text) from public, anon;
grant execute on function public.send_to_shop(uuid, jsonb, text), public.return_from_shop(uuid, jsonb, text),
  public.shop_sold(uuid, uuid, integer, text), public.shop_adjust(uuid, uuid, integer, text) to authenticated;

-- Mock-up shop to try the feature with.
insert into public.shops (name, contact, phone, address) values ('PETCLUB (ตัวอย่าง)', 'ฝ่ายจัดซื้อ', '02-000-0000', 'กรุงเทพฯ');
