-- Packaging types (ขวด, ฝา, กล่อง …) managed by staff. Renaming a type renames it on its
-- items; a type that still has items cannot be deleted.
create table public.packaging_kinds (
  name text primary key check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);
insert into public.packaging_kinds (name, created_at) values
  ('ขวด', now()), ('ฝา', now() + interval '1 second'), ('กล่อง', now() + interval '2 second'), ('อื่น ๆ', now() + interval '3 second');
insert into public.packaging_kinds (name) select distinct kind from public.packaging_items on conflict do nothing;

alter table public.packaging_items alter column kind drop default;
alter table public.packaging_items add constraint packaging_items_kind_fkey
  foreign key (kind) references public.packaging_kinds (name) on update cascade on delete restrict;

alter table public.packaging_kinds enable row level security;
create policy staff_all on public.packaging_kinds for all to authenticated using (private.is_active_user()) with check (private.is_active_user());
revoke all on public.packaging_kinds from anon;
grant select, insert, update, delete on public.packaging_kinds to authenticated;
