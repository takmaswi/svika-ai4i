-- 0009 route typical duration
-- End to end minutes for the outbound run, used by the planner to weight
-- ride edges. Values come from the verified seed network (Mhofu's corridor
-- timings), later replaced by learned per segment times from P3/P4 data.

alter table public.routes
  add column typical_duration_minutes integer
    check (typical_duration_minutes is null or typical_duration_minutes > 0);
