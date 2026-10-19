-- New marketplace: LINE SHOPPING.
alter type public.platform add value if not exists 'line';

create or replace function private.on_order_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify('new_order',
    'ออเดอร์ใหม่ · ' || case new.platform::text when 'shopee' then 'Shopee' when 'lazada' then 'Lazada' when 'line' then 'LINE SHOPPING' else 'TikTok Shop' end
      || case when new.source = 'sample' then ' (ตัวอย่าง)' else '' end,
    new.external_order_id || coalesce(' · ' || to_char(new.total_amount, 'FM999,999,990') || ' บาท', ''),
    '/orders?range=all&order=' || new.id, 'order:' || new.id);
  return new;
end $$;
