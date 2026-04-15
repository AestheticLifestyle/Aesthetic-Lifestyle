-- ════════════════════════════════════════════════════════════════════
-- Add preferences JSONB column to profiles
-- ════════════════════════════════════════════════════════════════════
-- Stores user preferences (notifications, reminders, dark mode, units)
-- as a flexible JSON object instead of adding individual columns.

alter table public.profiles
  add column if not exists preferences jsonb default '{}';
