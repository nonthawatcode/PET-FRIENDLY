-- 1) Handing over without photos is allowed ("ไม่มีรูป" button): photo list may be empty.
alter table public.handovers drop constraint handovers_photo_paths_check;

create or replace function public.hand_over(p_orders uuid[], p_courier text, p_photos text[], p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); h uuid; o record; n integer := 0;
begin
  if coalesce(trim(p_courier), '') = '' then raise exception 'courier_required'; end if;
  if coalesce(cardinality(p_orders), 0) = 0 then raise exception 'nothing_selected'; end if;

  insert into public.handovers (courier, photo_paths, note, created_by)
  values (trim(p_courier), coalesce(p_photos, '{}'), nullif(trim(p_note), ''), uid)
  returning id into h;

  for o in select id from public.orders where id = any (p_orders) and status = 'packed' order by id for update loop
    update public.orders set status = 'shipped', shipped_at = now(), handover_id = h, updated_at = now() where id = o.id;
    perform private._event(o.id, 'handed_over', 'ส่งมอบให้ ' || trim(p_courier) || ' แล้ว');
    n := n + 1;
  end loop;

  if n = 0 then raise exception 'nothing_to_hand_over'; end if;
  return jsonb_build_object('handover_id', h, 'count', n);
end $$;

-- 2) "ล้างแจ้งเตือน": staff can delete all notifications.
create policy staff_delete on public.notifications for delete to authenticated using (private.is_active_user());
grant delete on public.notifications to authenticated;
