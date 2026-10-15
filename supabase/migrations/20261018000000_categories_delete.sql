-- Staff can delete a category; its products become "no category" (category_id set null).
create policy staff_delete on public.categories for delete to authenticated using (private.is_active_user());
grant delete on public.categories to authenticated;
