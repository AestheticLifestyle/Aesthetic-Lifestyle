-- ══════════════════════════════════════════════
-- GAMIFICATION SYSTEM — Database Migration
-- ══════════════════════════════════════════════
-- Run this in Supabase SQL editor to create the gamification tables.
-- The app also has a fallback mode that stores gamification data
-- in the profiles.gamification JSONB column, so these tables are
-- optional but recommended for production use.

-- 1. Add gamification JSONB column to profiles (fallback storage)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gamification jsonb DEFAULT NULL;

-- 2. Client XP log (one row per client per day)
CREATE TABLE IF NOT EXISTS client_xp (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  xp_earned integer NOT NULL DEFAULT 0,
  sources jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, date)
);

-- 3. Client achievements (one row per unlocked achievement)
CREATE TABLE IF NOT EXISTS client_achievements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id text NOT NULL,
  unlocked_at timestamptz DEFAULT now(),
  UNIQUE(client_id, achievement_id)
);

-- 4. Client streaks (single row per client, updated daily)
CREATE TABLE IF NOT EXISTS client_streaks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_active_date date,
  updated_at timestamptz DEFAULT now()
);

-- 5. Client gamification stats (single row per client, aggregated)
CREATE TABLE IF NOT EXISTS client_gamification (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  total_xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  total_workouts integer DEFAULT 0,
  total_prs integer DEFAULT 0,
  total_weighins integer DEFAULT 0,
  total_checkins integer DEFAULT 0,
  protein_hits integer DEFAULT 0,
  high_xp_days integer DEFAULT 0,
  meal_streak integer DEFAULT 0,
  macro_streak integer DEFAULT 0,
  perfect_weeks integer DEFAULT 0,
  weeks_active integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_client_xp_client_date ON client_xp(client_id, date);
CREATE INDEX IF NOT EXISTS idx_client_achievements_client ON client_achievements(client_id);
CREATE INDEX IF NOT EXISTS idx_client_streaks_client ON client_streaks(client_id);
CREATE INDEX IF NOT EXISTS idx_client_gamification_client ON client_gamification(client_id);

-- ── Row Level Security ──
ALTER TABLE client_xp ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_gamification ENABLE ROW LEVEL SECURITY;

-- Clients can read/write their own gamification data
CREATE POLICY "Users can manage own xp" ON client_xp
  FOR ALL USING (auth.uid() = client_id);

CREATE POLICY "Users can manage own achievements" ON client_achievements
  FOR ALL USING (auth.uid() = client_id);

CREATE POLICY "Users can manage own streaks" ON client_streaks
  FOR ALL USING (auth.uid() = client_id);

CREATE POLICY "Users can manage own gamification" ON client_gamification
  FOR ALL USING (auth.uid() = client_id);

-- Coaches can read their clients' gamification data
CREATE POLICY "Coaches can read client xp" ON client_xp
  FOR SELECT USING (is_coach_of(client_id));

CREATE POLICY "Coaches can read client achievements" ON client_achievements
  FOR SELECT USING (is_coach_of(client_id));

CREATE POLICY "Coaches can read client streaks" ON client_streaks
  FOR SELECT USING (is_coach_of(client_id));

CREATE POLICY "Coaches can read client gamification" ON client_gamification
  FOR SELECT USING (is_coach_of(client_id));
