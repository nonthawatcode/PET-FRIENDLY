-- Handing parcels to a courier: one "handover" = one trip to a courier drop-off point,
-- with the courier name, photos of the parcels, and the orders in it.

create table public.handovers (
  id uuid primary key default gen_random_uuid(),
  courier text not null check (length(trim(courier)) > 0),
  photo_paths text[] not null check (cardinality(photo_paths) > 0),
  note text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.orders add column handover_id uuid references public.handovers (id);
create index orders_handover_idx on public.orders (handover_id);

alter table public.handovers enable row level security;
create policy staff_read on public.handovers for select to authenticated using (private.is_active_user());
revoke insert, update, delete on public.handovers from authenticated;
revoke all on public.handovers from anon;

-- Mark packed orders as handed to a courier. Photos are uploaded first (storage bucket
-- "handover"); their paths are stored here. Orders that are no longer "packed" are skipped.
create or replace function public.hand_over(p_orders uuid[], p_courier text, p_photos text[], p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); h uuid; o record; n integer := 0;
begin
  if coalesce(trim(p_courier), '') = '' then raise exception 'courier_required'; end if;
  if coalesce(cardinality(p_photos), 0) = 0 then raise exception 'photo_required'; end if;
  if coalesce(cardinality(p_orders), 0) = 0 then raise exception 'nothing_selected'; end if;

  insert into public.handovers (courier, photo_paths, note, created_by)
  values (trim(p_courier), p_photos, nullif(trim(p_note), ''), uid)
  returning id into h;

  for o in select id from public.orders where id = any (p_orders) and status = 'packed' order by id for update loop
    update public.orders set status = 'shipped', shipped_at = now(), handover_id = h, updated_at = now() where id = o.id;
    perform private._event(o.id, 'handed_over', 'ส่งมอบให้ ' || trim(p_courier) || ' แล้ว');
    n := n + 1;
  end loop;

  if n = 0 then raise exception 'nothing_to_hand_over'; end if;
  return jsonb_build_object('handover_id', h, 'count', n);
end $$;

revoke execute on function public.hand_over(uuid[], text, text[], text) from public, anon;
grant execute on function public.hand_over(uuid[], text, text[], text) to authenticated;

-- Private photo bucket: staff can upload and view.
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('handover', 'handover', false) on conflict (id) do nothing;
    execute $p$create policy handover_staff_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'handover' and private.is_active_user())$p$;
    execute $p$create policy handover_staff_read on storage.objects for select to authenticated
      using (bucket_id = 'handover' and private.is_active_user())$p$;
  end if;
end $$;
