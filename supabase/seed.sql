-- Local/dev seed: the three FUR DE PARFUM SKUs with sample marketplace listings and opening stock.
insert into public.products (sku, name, option_name, low_stock_threshold, dm_fg, dm_bg) values
  ('PF-FDP-01', 'FUR DE PARFUM', 'กลิ่น 1 (รอตั้งชื่อ)', 20, '#FFFFFF', '#14283A'),
  ('PF-FDP-02', 'FUR DE PARFUM', 'กลิ่น 2 (รอตั้งชื่อ)', 20, '#000000', '#FFFFFF'),
  ('PF-FDP-03', 'FUR DE PARFUM', 'กลิ่น 3 (รอตั้งชื่อ)', 20, '#000000', '#FFFFFF')
on conflict (sku) do nothing;

insert into public.marketplace_listings (product_id, platform, external_sku)
select p.id, v.platform::public.platform, v.external_sku
from (values
  ('PF-FDP-01', 'shopee', 'SP-FDP01'), ('PF-FDP-02', 'shopee', 'SP-FDP02'), ('PF-FDP-03', 'shopee', 'SP-FDP03'),
  ('PF-FDP-01', 'lazada', 'FDP01-50ML'), ('PF-FDP-02', 'lazada', 'FDP02-50ML'), ('PF-FDP-03', 'lazada', 'FDP03-50ML'),
  ('PF-FDP-01', 'tiktok', 'TT-FDP01'), ('PF-FDP-02', 'tiktok', 'TT-FDP02')
) v(sku, platform, external_sku)
join public.products p on p.sku = v.sku
on conflict (platform, external_sku) do nothing;

select private._move(p.id, 'receive', v.qty, v.qty, 0, null, 'สต็อกเริ่มต้น (seed)', 'seed:' || p.sku)
from (values ('PF-FDP-01', 120), ('PF-FDP-02', 64), ('PF-FDP-03', 18)) v(sku, qty)
join public.products p on p.sku = v.sku;
