import { supabase } from './supabase';

// ── Daily Check-ins ──

export async function saveDailyCheckin(data) {
  const { error } = await supabase.from('daily_checkins')
    .upsert(data, { onConflict: 'client_id,date' });
  if (error) console.error('[saveDailyCheckin] error:', error.message, error.details, error.hint);
  return !error;
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
  const { error } = await supabase.from(table)
    .update({ coach_feedback: feedback, coach_responded_at: new Date().toISOString() })
    .eq('id', checkinId);
  return !error;
}

// ── Steps & Cardio ──

export async function saveSteps(clientId, date, steps) {
  const { error } = await supabase.from('daily_checkins')
    .upsert({ client_id: clientId, date, steps }, { onConflict: 'client_id,date' });
  return !error;
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
