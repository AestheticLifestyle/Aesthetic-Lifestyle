-- ════════════════════════════════════════════════════════════════════
-- Add archive support to coach_clients
-- ════════════════════════════════════════════════════════════════════
-- Adds an `archived` boolean so coaches can hide inactive clients
-- without deleting the relationship (preserves all historical data).

alter table public.coach_clients
  add column if not exists archived boolean default false;

-- Index for fast filtering
create index if not exists idx_coach_clients_archived
  on public.coach_clients(coach_id, archived);

-- Also add editable target fields if they don't exist yet
alter table public.coach_clients
  add column if not exists target_weight numeric,
  add column if not exists calorie_target integer,
  add column if not exists protein_target integer,
  add column if not exists carb_target integer,
  add column if not exists fat_target integer,
  add column if not exists notes_coach text;
