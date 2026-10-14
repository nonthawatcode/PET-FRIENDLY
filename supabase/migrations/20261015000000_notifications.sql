-- Notifications: an in-app list (bell) plus phone push notifications.
-- Rows are created by the database (new order, low stock) or by the daily check
-- (parcels not handed to a courier, photo storage nearly full). The app server sends
-- the phone notifications for rows that have not been pushed yet (pushed_at is null).

create table public.notifications (
  id bigint generated always as identity primary key,
  kind text not null,              -- new_order | low_stock | handover_overdue | storage_full
  title text not null,
  body text not null,
  url text not null default '/',
  dedupe_key text unique,          -- stops the same alert being created twice
  pushed_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_created_idx on public.notifications (created_at desc);
create index notifications_unpushed_idx on public.notifications (id) where pushed_at is null;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

-- Web-push signing keys, generated once by the app server. Only the service role reads this.
create table public.push_config (
  id boolean primary key default true check (id),
  vapid_public text not null,
  vapid_private text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles add column notifications_seen_at timestamptz not null default now();
grant update (notifications_seen_at) on public.profiles to authenticated;

alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_config enable row level security;
create policy staff_read on public.notifications for select to authenticated using (private.is_active_user());
create policy own_read on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.notifications, public.push_subscriptions from authenticated;
revoke all on public.notifications, public.push_subscriptions, public.push_config from anon;
revoke all on public.push_config from authenticated;

create or replace function private.notify(p_kind text, p_title text, p_body text, p_url text, p_key text) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (kind, title, body, url, dedupe_key)
  values (p_kind, p_title, p_body, p_url, p_key)
  on conflict (dedupe_key) do nothing;
$$;

-- New order arrives (from a marketplace, a file import, or the sample generator).
create or replace function private.on_order_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify('new_order',
    'ออเดอร์ใหม่ · ' || case new.platform when 'shopee' then 'Shopee' when 'lazada' then 'Lazada' else 'TikTok Shop' end
      || case when new.source = 'sample' then ' (ตัวอย่าง)' else '' end,
    new.external_order_id || coalesce(' · ' || to_char(new.total_amount, 'FM999,999,990') || ' บาท', ''),
    '/orders?range=all&order=' || new.id, 'order:' || new.id);
  return new;
end $$;
create trigger orders_notify after insert on public.orders
  for each row execute function private.on_order_created();

-- Low stock: only when "available" drops to the alert level (not on every change).
create or replace function private.on_inventory_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p public.products; was integer := old.on_hand - old.reserved; now_ integer := new.on_hand - new.reserved;
begin
  select * into p from public.products where id = new.product_id;
  if p.archived then return new; end if;
  if was > p.low_stock_threshold and now_ <= p.low_stock_threshold then
    perform private.notify('low_stock', 'สินค้าใกล้หมด · ' || p.sku,
      coalesce(nullif(p.option_name, ''), p.name) || ' เหลือพร้อมขาย ' || now_ || ' ชิ้น',
      '/stock?sku=' || p.sku, 'low:' || p.id || ':' || (now() at time zone 'Asia/Bangkok')::date);
  end if;
  return new;
end $$;
create trigger inventory_notify after update on public.inventory
  for each row execute function private.on_inventory_changed();

-- Daily check (called by the app's scheduled job with the service role).
create or replace function public.run_daily_checks(p_storage_limit_mb integer default 1024) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'Asia/Bangkok')::date;
  late integer;
  used_bytes bigint := 0;
  pct integer;
begin
  select count(*) into late from public.orders
   where status = 'packed' and (packed_at at time zone 'Asia/Bangkok')::date < today;
  if late > 0 then
    perform private.notify('handover_overdue', 'มีกล่องค้างส่งขนส่ง',
      late || ' กล่องแพ็กแล้วแต่ยังไม่ได้ส่งขนส่ง', '/?handover=1', 'overdue:' || today);
  end if;

  if exists (select 1 from pg_namespace where nspname = 'storage') then
    execute 'select coalesce(sum((metadata->>''size'')::bigint), 0) from storage.objects' into used_bytes;
  end if;
  pct := round(used_bytes * 100.0 / (greatest(p_storage_limit_mb, 1)::bigint * 1024 * 1024));
  if pct >= 80 then
    perform private.notify('storage_full', 'พื้นที่เก็บรูปใกล้เต็ม',
      'ใช้ไปแล้ว ' || pct || '% (' || round(used_bytes / 1048576.0) || ' จาก ' || p_storage_limit_mb || ' MB)',
      '/account', 'storage:' || pct / 5 * 5 || ':' || date_trunc('week', today));
  end if;
  return jsonb_build_object('late', late, 'storage_pct', pct);
end $$;

-- Save this phone/browser for push notifications.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user();
begin
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (uid, p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (endpoint) do update set user_id = uid, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
end $$;

create or replace function public.remove_push_subscription(p_endpoint text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_user();
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
end $$;

-- The public half of the signing key is public by design; browsers need it to subscribe.
create or replace function public.vapid_public_key() returns text
language sql stable security definer set search_path = '' as $$
  select vapid_public from public.push_config where id
$$;

revoke execute on function public.run_daily_checks(integer), public.save_push_subscription(text, text, text, text),
  public.remove_push_subscription(text), public.vapid_public_key() from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text), public.remove_push_subscription(text),
  public.vapid_public_key() to authenticated;
grant execute on function public.run_daily_checks(integer) to service_role;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
