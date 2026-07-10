-- 0025 rider prefs upsert grant
-- The prefs write is an upsert; ON CONFLICT DO UPDATE re-sets every insert
-- column including rider_id, which the 0023 column grant left out, so every
-- second write was refused. Updating rider_id is safe to allow: the update
-- policy's WITH CHECK pins it to auth.uid(), so it can only ever be written
-- back as itself.
grant update (rider_id, commute_alerts, voice_en, voice_sn)
  on table public.rider_prefs to authenticated;
