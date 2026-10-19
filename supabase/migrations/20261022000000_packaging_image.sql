-- Photo for each packaging item (stored in the public "brand" bucket under packaging/).
alter table public.packaging_items add column image_url text;
