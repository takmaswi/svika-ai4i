-- 0015 rehearsal reset: clear a conductor's redemption attempt log
--
-- Demo tooling, not product. Rehearsals and the e2e suite deliberately walk
-- the failure paths (wrong code, already used, offline conflict); repeated
-- runs inside one 10 minute window would rate limit the demo conductor and
-- poison every later test. The seed resets the demo conductor's attempt log
-- before a run, exactly the "one command reset" the P6 demo plan calls for.
--
-- Only the service role may execute it (the seed and CI); no client role
-- can touch the attempt log, and the append only trigger stays in force for
-- everything else. The maintenance flag is transaction local.
create or replace function public.reset_conductor_attempt_log(p_profile uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conductor uuid;
  v_deleted integer;
begin
  select id into v_conductor
  from public.conductors
  where profile_id = p_profile;
  if v_conductor is null then
    return 0;
  end if;

  perform set_config('svika.allow_maintenance', 'on', true);
  delete from public.code_redemption_attempts
  where conductor_id = v_conductor;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.reset_conductor_attempt_log(uuid) from public, anon, authenticated;
grant execute on function public.reset_conductor_attempt_log(uuid) to service_role;
