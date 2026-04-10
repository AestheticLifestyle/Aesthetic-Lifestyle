-- ════════════════════════════════════════════════════════════════════
-- Fix Row-Level Security policies for daily_checkins and weekly_checkins
-- ════════════════════════════════════════════════════════════════════
-- Symptom: "new row violates row-level security policy for table daily_checkins"
-- Cause:   INSERT/UPDATE policies were missing or mis-configured so clients
--          could not save their own check-ins and coaches could not leave feedback.
--
-- This migration:
--   1. Ensures RLS is enabled
--   2. Drops any stale/conflicting policies
--   3. Recreates a clean policy set:
--        • Clients can SELECT / INSERT / UPDATE / DELETE their own rows
--        • Coaches can SELECT / UPDATE rows for any client linked via coach_clients
-- ════════════════════════════════════════════════════════════════════

-- ── daily_checkins ──────────────────────────────────────────────────
alter table public.daily_checkins enable row level security;

drop policy if exists "daily_checkins_select_own"         on public.daily_checkins;
drop policy if exists "daily_checkins_insert_own"         on public.daily_checkins;
drop policy if exists "daily_checkins_update_own"         on public.daily_checkins;
drop policy if exists "daily_checkins_delete_own"         on public.daily_checkins;
drop policy if exists "daily_checkins_select_coach"       on public.daily_checkins;
drop policy if exists "daily_checkins_update_coach"       on public.daily_checkins;
-- Legacy / common accidental names we might have created earlier
drop policy if exists "Clients can view own daily checkins"            on public.daily_checkins;
drop policy if exists "Clients can insert own daily checkins"          on public.daily_checkins;
drop policy if exists "Clients can update own daily checkins"          on public.daily_checkins;
drop policy if exists "Clients can delete own daily checkins"          on public.daily_checkins;
drop policy if exists "Coaches can view their clients daily checkins"  on public.daily_checkins;
drop policy if exists "Coaches can update their clients daily checkins" on public.daily_checkins;
drop policy if exists "Enable read access for all users"               on public.daily_checkins;
drop policy if exists "Enable insert for authenticated users only"     on public.daily_checkins;

create policy "daily_checkins_select_own"
on public.daily_checkins for select
to authenticated
using (client_id = auth.uid());

create policy "daily_checkins_insert_own"
on public.daily_checkins for insert
to authenticated
with check (client_id = auth.uid());

create policy "daily_checkins_update_own"
on public.daily_checkins for update
to authenticated
using (client_id = auth.uid())
with check (client_id = auth.uid());

create policy "daily_checkins_delete_own"
on public.daily_checkins for delete
to authenticated
using (client_id = auth.uid());

-- Coach can see all check-ins for their linked clients
create policy "daily_checkins_select_coach"
on public.daily_checkins for select
to authenticated
using (
  exists (
    select 1 from public.coach_clients cc
    where cc.client_id = public.daily_checkins.client_id
      and cc.coach_id  = auth.uid()
  )
);

-- Coach can update check-ins for their linked clients (e.g. leave feedback)
create policy "daily_checkins_update_coach"
on public.daily_checkins for update
to authenticated
using (
  exists (
    select 1 from public.coach_clients cc
    where cc.client_id = public.daily_checkins.client_id
      and cc.coach_id  = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.coach_clients cc
    where cc.client_id = public.daily_checkins.client_id
      and cc.coach_id  = auth.uid()
  )
);

-- ── weekly_checkins ─────────────────────────────────────────────────
alter table public.weekly_checkins enable row level security;

drop policy if exists "weekly_checkins_select_own"    on public.weekly_checkins;
drop policy if exists "weekly_checkins_insert_own"    on public.weekly_checkins;
drop policy if exists "weekly_checkins_update_own"    on public.weekly_checkins;
drop policy if exists "weekly_checkins_delete_own"    on public.weekly_checkins;
drop policy if exists "weekly_checkins_select_coach"  on public.weekly_checkins;
drop policy if exists "weekly_checkins_update_coach"  on public.weekly_checkins;
drop policy if exists "Clients can view own weekly checkins"             on public.weekly_checkins;
drop policy if exists "Clients can insert own weekly checkins"           on public.weekly_checkins;
drop policy if exists "Clients can update own weekly checkins"           on public.weekly_checkins;
drop policy if exists "Coaches can view their clients weekly checkins"   on public.weekly_checkins;
drop policy if exists "Coaches can update their clients weekly checkins" on public.weekly_checkins;

create policy "weekly_checkins_select_own"
on public.weekly_checkins for select
to authenticated
using (client_id = auth.uid());

create policy "weekly_checkins_insert_own"
on public.weekly_checkins for insert
to authenticated
with check (client_id = auth.uid());

create policy "weekly_checkins_update_own"
on public.weekly_checkins for update
to authenticated
using (client_id = auth.uid())
with check (client_id = auth.uid());

create policy "weekly_checkins_delete_own"
on public.weekly_checkins for delete
to authenticated
using (client_id = auth.uid());

create policy "weekly_checkins_select_coach"
on public.weekly_checkins for select
to authenticated
using (
  exists (
    select 1 from public.coach_clients cc
    where cc.client_id = public.weekly_checkins.client_id
      and cc.coach_id  = auth.uid()
  )
);

create policy "weekly_checkins_update_coach"
on public.weekly_checkins for update
to authenticated
using (
  exists (
    select 1 from public.coach_clients cc
    where cc.client_id = public.weekly_checkins.client_id
      and cc.coach_id  = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.coach_clients cc
    where cc.client_id = public.weekly_checkins.client_id
      and cc.coach_id  = auth.uid()
  )
);
