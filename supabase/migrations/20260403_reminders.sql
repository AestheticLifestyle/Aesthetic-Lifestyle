-- ══════════════════════════════════════════════════════════
-- Reminder Rules & Notifications
-- ══════════════════════════════════════════════════════════

-- Reminder rules: coach configures per client
CREATE TABLE IF NOT EXISTS reminder_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  client_id UUID NOT NULL,
  -- Individual toggles
  daily_checkin BOOLEAN DEFAULT true,
  weekly_checkin BOOLEAN DEFAULT true,
  meal_logging BOOLEAN DEFAULT true,
  weight_logging BOOLEAN DEFAULT true,
  workout_reminder BOOLEAN DEFAULT true,
  water_intake BOOLEAN DEFAULT true,
  step_target BOOLEAN DEFAULT true,
  -- Timing config
  daily_checkin_time TIME DEFAULT '20:00',
  weekly_checkin_day INTEGER DEFAULT 0, -- 0=Sunday
  -- Active flag
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(coach_id, client_id)
);

-- Notifications: generated reminders shown to clients
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  coach_id UUID,
  type TEXT NOT NULL, -- daily_checkin, weekly_checkin, meal_logging, weight_logging, workout, water, steps, coach_message
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  icon TEXT DEFAULT 'bell',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reminder_rules_client ON reminder_rules(client_id);
CREATE INDEX IF NOT EXISTS idx_notifications_client ON notifications(client_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- RLS
ALTER TABLE reminder_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Reminder rules: coach can manage, client can read their own
DROP POLICY IF EXISTS "reminder_rules_coach" ON reminder_rules;
CREATE POLICY "reminder_rules_coach" ON reminder_rules
  FOR ALL USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "reminder_rules_client_read" ON reminder_rules;
CREATE POLICY "reminder_rules_client_read" ON reminder_rules
  FOR SELECT USING (auth.uid() = client_id);

-- Notifications: client can read/update their own, coach can insert for their clients
DROP POLICY IF EXISTS "notifications_client" ON notifications;
CREATE POLICY "notifications_client" ON notifications
  FOR ALL USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS "notifications_coach_insert" ON notifications;
CREATE POLICY "notifications_coach_insert" ON notifications
  FOR INSERT WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "notifications_coach_read" ON notifications;
CREATE POLICY "notifications_coach_read" ON notifications
  FOR SELECT USING (auth.uid() = coach_id);
