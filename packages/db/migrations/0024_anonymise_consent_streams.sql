-- 0024 anonymise across consent streams
-- 0023 added a second consent stream (emergency-v1) in the same table.
-- anonymise_me picked the latest accepted version blindly, so a rider whose
-- newest accept was the emergency stream would get an emergency withdrawal
-- appended and the app gate (scoped to the app stream) would stay open.
-- Now: the app withdrawal always carries an app stream version, and if
-- emergency details existed their own withdrawal is recorded before the row
-- goes.

create or replace function public.anonymise_me()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_version text;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  select version into v_version
    from public.consent_records
    where user_id = v_uid and action = 'accepted'
      and version not like 'emergency%'
    order by created_at desc
    limit 1;

  update public.profiles
    set full_name = '', phone = null, anonymised_at = now()
    where id = v_uid;

  delete from public.saved_trips where rider_id = v_uid;
  delete from public.rider_prefs where rider_id = v_uid;

  if exists (select 1 from public.emergency_details where rider_id = v_uid) then
    insert into public.consent_records (user_id, action, version)
      values (v_uid, 'withdrawn', 'emergency-v1');
  end if;
  delete from public.emergency_details where rider_id = v_uid;

  insert into public.consent_records (user_id, action, version)
    values (v_uid, 'withdrawn', coalesce(v_version, 'v1'));
end;
$$;
