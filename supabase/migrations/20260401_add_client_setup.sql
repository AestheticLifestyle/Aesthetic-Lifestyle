-- ============================================
-- Add client_setup JSONB column to invite_codes
-- ============================================
-- Stores pre-configured client profile data (name, goal, training plan, nutrition plan)
-- that gets applied when a client redeems the invite code.

ALTER TABLE invite_codes
  ADD COLUMN IF NOT EXISTS client_setup jsonb DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN invite_codes.client_setup IS 'Optional JSONB with pre-configured client setup: { clientName, goal, stepTarget, trainingPlan, nutritionPlan }';

-- Allow clients to delete their own coach link (disconnect)
DROP POLICY IF EXISTS "Clients delete own link" ON coach_clients;
CREATE POLICY "Clients delete own link"
  ON coach_clients FOR DELETE
  USING (client_id = auth.uid());

-- Allow coaches to delete client links
DROP POLICY IF EXISTS "Coaches delete own clients" ON coach_clients;
CREATE POLICY "Coaches delete own clients"
  ON coach_clients FOR DELETE
  USING (coach_id = auth.uid());

-- Allow authenticated users to update invite_codes used_count (for redemption)
DROP POLICY IF EXISTS "Anyone can increment used_count" ON invite_codes;
CREATE POLICY "Anyone can increment used_count"
  ON invite_codes FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
