-- "โกดัง": packaging materials (bottles, caps, boxes…) and shared design files.

create table public.packaging_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  kind text not null default 'อื่น ๆ',             -- ขวด | ฝา | กล่อง | อื่น ๆ
  qty integer not null default 0 check (qty >= 0),
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.design_files (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  path text not null unique,                       -- in the private storage bucket "design"
  size bigint not null default 0,
  mime text,
  note text,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.packaging_items enable row level security;
alter table public.design_files enable row level security;
create policy staff_all on public.packaging_items for all to authenticated using (private.is_active_user()) with check (private.is_active_user());
create policy staff_all on public.design_files for all to authenticated using (private.is_active_user()) with check (private.is_active_user());
revoke all on public.packaging_items, public.design_files from anon;
grant select, insert, update, delete on public.packaging_items, public.design_files to authenticated;

-- Add or take away packaging stock in one step (never below zero).
create or replace function public.adjust_packaging(p_item uuid, p_delta integer) returns integer
language plpgsql security definer set search_path = '' as $$
declare q integer;
begin
  perform private.require_user();
  if p_delta is null or p_delta = 0 then raise exception 'invalid_quantity'; end if;
  update public.packaging_items set qty = qty + p_delta, updated_at = now() where id = p_item returning qty into q;
  if q is null then raise exception 'not_found'; end if;
  return q;
exception when check_violation then
  raise exception 'packaging_short';
end $$;
revoke execute on function public.adjust_packaging(uuid, integer) from public, anon;
grant execute on function public.adjust_packaging(uuid, integer) to authenticated;

-- Private bucket for design files: staff can upload, view and delete.
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('design', 'design', false) on conflict (id) do nothing;
    execute $p$create policy design_staff_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'design' and private.is_active_user())$p$;
    execute $p$create policy design_staff_read on storage.objects for select to authenticated
      using (bucket_id = 'design' and private.is_active_user())$p$;
    execute $p$create policy design_staff_delete on storage.objects for delete to authenticated
      using (bucket_id = 'design' and private.is_active_user())$p$;
  end if;
end $$;
