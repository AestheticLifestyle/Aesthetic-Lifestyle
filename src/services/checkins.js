import { supabase } from './supabase';

// ── Daily Check-ins ──

// Whitelist of columns known to exist in the daily_checkins table.
// Keep this list in sync with the DB schema. Any field passed to
// saveDailyCheckin that isn't in this list will be silently dropped
// before hitting Supabase (prevents "column does not exist" errors).
const DAILY_CHECKIN_COLUMNS = new Set([
  'client_id', 'date',
  'mood', 'sleep', 'energy', 'stress',
  'weight', 'hydration', 'steps',
  'note', 'coach_feedback', 'coach_responded_at',
]);

function cleanDailyPayload(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!DAILY_CHECKIN_COLUMNS.has(k)) continue;
    if (v === undefined) continue; // never send undefined
    out[k] = v;
  }
  return out;
}

export async function saveDailyCheckin(data) {
  const { client_id, date } = data;
  if (!client_id || !date) {
    console.error('[saveDailyCheckin] missing client_id or date', { client_id, date });
    return { ok: false, error: 'Missing client_id or date' };
  }

  const clean = cleanDailyPayload(data);
  // Never overwrite unrelated columns with null — only send keys that were provided
  const updateFields = { ...clean };
  delete updateFields.client_id;
  delete updateFields.date;

  // Check for existing row
  const { data: existing, error: selErr } = await supabase
    .from('daily_checkins')
    .select('id')
    .eq('client_id', client_id)
    .eq('date', date)
    .maybeSingle();

  if (selErr) {
    console.error('[saveDailyCheckin] select error:', selErr);
    return { ok: false, error: selErr.message || 'Select failed' };
  }

  let error;
  if (existing) {
    ({ error } = await supabase
      .from('daily_checkins')
      .update(updateFields)
      .eq('client_id', client_id)
      .eq('date', date));
  } else {
    ({ error } = await supabase
      .from('daily_checkins')
      .insert({ client_id, date, ...updateFields }));
  }

  if (error) {
    console.error('[saveDailyCheckin] write error:', error.message, error.details, error.hint, error.code);
    return { ok: false, error: error.message || 'Save failed', code: error.code, details: error.details };
  }
  return { ok: true };
}

export async function fetchDailyCheckins(clientId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase.from('daily_checkins')
    .select('*').eq('client_id', clientId)
    .gte('date', since.toISOString().slice(0, 10))
    .order('date', { ascending: false });
  if (error) console.error('[fetchDailyCheckins] error:', error.message, error.details);
  if (data) console.log('[fetchDailyCheckins] got', data.length, 'rows for', clientId);
  return data || [];
}

// ── Weekly Check-ins ──

export async function saveWeeklyCheckin(clientId, checkinData) {
  const { error } = await supabase.from('weekly_checkins')
    .upsert({ ...checkinData, client_id: clientId }, { onConflict: 'client_id,week_number' });
  return !error;
}

export async function fetchWeeklyCheckins(clientId) {
  const { data } = await supabase.from('weekly_checkins')
    .select('*').eq('client_id', clientId)
    .order('week_number', { ascending: true });
  return data || [];
}

export async function saveCoachFeedback(checkinId, feedback, type = 'weekly') {
  const table = type === 'daily' ? 'daily_checkins' : 'weekly_checkins';
  // Note: pending/reviewed status is derived client-side from the presence of
  // coach_feedback (see fetchPendingCheckins in services/chat.js), so we only
  // need to update the feedback + timestamp columns here.
  const { error } = await supabase.from(table)
    .update({ coach_feedback: feedback, coach_responded_at: new Date().toISOString() })
    .eq('id', checkinId);
  if (error) console.error('[saveCoachFeedback] error:', error.message, error.details, error.hint);
  return !error;
}

// ── Steps & Cardio ──

export async function saveSteps(clientId, date, steps) {
  return saveDailyCheckin({ client_id: clientId, date, steps });
}

export async function saveCardioSession(clientId, session) {
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from('cardio_sessions').insert({
    client_id: clientId, date: today,
    type: session.type || 'Walking',
    duration_minutes: session.duration_minutes || 0,
    distance_km: session.distance_km || 0,
    kcal_burned: session.kcal_burned || 0,
    notes: session.notes || '',
  });
  return !error;
}

// ── Goal ──

export async function saveClientGoal(clientId, goal) {
  const { error } = await supabase.from('coach_clients')
    .update({ goal })
    .eq('client_id', clientId);
  return !error;
}
