import { supabase } from './supabase';

// ── Training Plans ──

export async function fetchTrainingPlan(clientId) {
  const { data: plan } = await supabase
    .from('training_plans').select('id, name')
    .eq('client_id', clientId).eq('is_active', true).single();
  if (!plan) return null;

  const { data: days } = await supabase
    .from('training_plan_days').select('id, name, day_of_week, sort_order')
    .eq('training_plan_id', plan.id).order('sort_order');
  if (!days?.length) return null;

  const dayIds = days.map(d => d.id);
  const { data: exercises } = await supabase
    .from('training_plan_exercises').select('*')
    .in('training_plan_day_id', dayIds).order('sort_order');

  return {
    name: plan.name,
    days: days.map(day => ({
      name: day.name,
      exercises: (exercises || [])
        .filter(ex => ex.training_plan_day_id === day.id)
        .map(ex => ({
          name: ex.name,
          sets: ex.sets || 3,
          targetReps: ex.target_reps || '10-12',
          previous: Array(ex.sets || 3).fill({ kg: 0, reps: 0 }),
          current: Array(ex.sets || 3).fill({ kg: null, reps: null, done: false }),
        })),
    })),
  };
}

export async function saveTrainingPlan(clientId, coachId, planName, days) {
  // Deactivate existing
  await supabase.from('training_plans').update({ is_active: false })
    .eq('client_id', clientId).eq('is_active', true);

  const { data: plan, error } = await supabase.from('training_plans').insert({
    client_id: clientId, coach_id: coachId, name: planName || 'Training Plan', is_active: true,
  }).select('id').single();
  if (error || !plan) return false;

  for (let di = 0; di < days.length; di++) {
    const day = days[di];
    const { data: dayRow } = await supabase.from('training_plan_days').insert({
      training_plan_id: plan.id, name: day.name, day_of_week: di, sort_order: di,
    }).select('id').single();
    if (!dayRow) continue;

    const exRows = day.exercises.map((ex, ei) => ({
      training_plan_day_id: dayRow.id, name: ex.name,
      sets: ex.sets || 3, target_reps: ex.targetReps || '10-12', sort_order: ei,
    }));
    if (exRows.length) await supabase.from('training_plan_exercises').insert(exRows);
  }
  return true;
}

// ── Workout Sessions ──

export async function saveWorkoutSession(clientId, dayIndex, dayName, exercises, notes) {
  let totalVolume = 0;
  exercises.forEach(ex => {
    ex.current.forEach(s => { if (s.done) totalVolume += (s.kg || 0) * (s.reps || 0); });
  });

  const today = new Date().toISOString().slice(0, 10);
  const { data: session, error } = await supabase.from('workout_sessions').insert({
    client_id: clientId, day_index: dayIndex, day_name: dayName || '',
    date: today, total_volume: totalVolume, notes: notes || null,
  }).select('id').single();
  if (error || !session) return false;

  const setRows = [];
  exercises.forEach(ex => {
    ex.current.forEach((s, si) => {
      if (s.done) {
        setRows.push({
          session_id: session.id, exercise_name: ex.name,
          set_number: si + 1, weight_kg: s.kg || 0, reps: s.reps || 0, is_done: true,
        });
      }
    });
  });
  if (setRows.length) await supabase.from('workout_sets').insert(setRows);
  return true;
}

export async function fetchWorkoutHistory(clientId) {
  const { data: sessions } = await supabase.from('workout_sessions')
    .select('id, day_index, day_name, date, total_volume, notes')
    .eq('client_id', clientId).order('date', { ascending: false }).limit(100);
  if (!sessions?.length) return {};

  const sessionIds = sessions.map(s => s.id);
  const { data: sets } = await supabase.from('workout_sets')
    .select('*').in('session_id', sessionIds);

  const history = {};
  sessions.forEach(sess => {
    if (!history[sess.day_index]) history[sess.day_index] = [];
    const sessionSets = (sets || []).filter(s => s.session_id === sess.id);
    history[sess.day_index].push({
      date: sess.date, day_name: sess.day_name || '', volume: sess.total_volume, notes: sess.notes,
      sets: sessionSets.map(s => ({
        exercise: s.exercise_name, set: s.set_number,
        kg: s.weight_kg, reps: s.reps,
      })),
    });
  });
  return history;
}
