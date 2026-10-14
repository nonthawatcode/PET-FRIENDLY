-- Staff can read logo files through the API too (storage needs this to replace/check files).
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    execute $p$create policy brand_staff_read on storage.objects for select to authenticated
      using (bucket_id = 'brand' and private.is_active_user())$p$;
  end if;
end $$;
