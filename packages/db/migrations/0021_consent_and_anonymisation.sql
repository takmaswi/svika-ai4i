-- 0021 consent and anonymisation
-- First use consent is a recorded fact, not a checkbox in local storage.
-- Every accept and every withdrawal appends a consent_records row; the app
-- blocks every surface until the latest row for the user says accepted.
-- Deletion anonymises rather than erases: tickets and money are append only
-- history, so anonymise_me() strips who the rider is (name, phone, saved
-- trips) and leaves the history keyed to an opaque id. The privacy page says
-- this plainly to the user.
-- RLS is enabled on the table this migration creates, in this migration.

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null check (action in ('accepted', 'withdrawn')),
  version text not null check (char_length(version) between 1 and 40),
  created_at timestamptz not null default now()
);

create index consent_records_user_idx
  on public.consent_records (user_id, created_at desc);

alter table public.consent_records enable row level security;

create policy "consent select own"
  on public.consent_records for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "consent insert own"
  on public.consent_records for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- consent history is append only for clients: no update or delete policy,
-- and the grants are revoked as a second wall. There is no forbid_mutation
-- trigger here on purpose: the seed (service role, seed trust tier) resets
-- the fresh e2e user's consent before every run so the "fresh user is
-- blocked" test always starts unconsented.
revoke update, delete on table public.consent_records from authenticated, anon;
revoke insert on table public.consent_records from anon;

-- clients may write only the three meaningful columns; id and created_at
-- always come from the defaults
revoke insert on table public.consent_records from authenticated;
grant insert (user_id, action, version) on table public.consent_records to authenticated;

-- when a rider deletes their data the profile row stays (history keys to it)
-- but records when it stopped being personal. Not in the column level update
-- grant from 0001, so clients cannot set it directly.
alter table public.profiles add column anonymised_at timestamptz;

-- The delete action on the privacy page. One transaction: strip the profile,
-- drop saved trips, append the withdrawal so the consent gate closes again.
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
    order by created_at desc
    limit 1;

  update public.profiles
    set full_name = '', phone = null, anonymised_at = now()
    where id = v_uid;

  delete from public.saved_trips where rider_id = v_uid;

  insert into public.consent_records (user_id, action, version)
    values (v_uid, 'withdrawn', coalesce(v_version, 'v1'));
end;
$$;

revoke execute on function public.anonymise_me() from public, anon;
grant execute on function public.anonymise_me() to authenticated;
