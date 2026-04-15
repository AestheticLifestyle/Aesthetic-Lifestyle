import { supabase } from './supabase';

export async function sendMessage(senderId, receiverId, text) {
  const { error } = await supabase.from('messages')
    .insert({ sender_id: senderId, receiver_id: receiverId, text });
  return !error;
}

export async function fetchMessages(userId, otherUserId) {
  const { data } = await supabase.from('messages').select('*')
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`)
    .order('created_at', { ascending: true });
  return data || [];
}

export function subscribeToMessages(userId, callback) {
  return supabase.channel('messages')
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages',
      filter: `receiver_id=eq.${userId}`,
    }, payload => callback(payload.new))
    .subscribe();
}

/**
 * Fetch the latest message for each client (for coach chat sidebar).
 * Returns { [clientId]: { text, created_at, sender_id } }
 */
export async function fetchLatestMessages(coachId, clientIds) {
  if (!clientIds?.length) return {};
  // Fetch recent messages involving the coach and any client
  const { data } = await supabase.from('messages')
    .select('sender_id, receiver_id, text, created_at')
    .or(`sender_id.eq.${coachId},receiver_id.eq.${coachId}`)
    .order('created_at', { ascending: false })
    .limit(200);

  if (!data) return {};

  const result = {};
  for (const msg of data) {
    const clientId = msg.sender_id === coachId ? msg.receiver_id : msg.sender_id;
    if (!clientIds.includes(clientId)) continue;
    if (!result[clientId]) {
      result[clientId] = {
        text: msg.text,
        created_at: msg.created_at,
        isFromClient: msg.sender_id !== coachId,
      };
    }
  }
  return result;
}

// Goal ID → label mapping (shared)
export const GOAL_LABELS = {
  'cut': 'Cutting', 'lean-bulk': 'Lean Bulk', 'recomp': 'Body Recomp',
  'maintenance': 'Maintenance', 'comp-prep': 'Comp Prep',
};

// ── Client Management ─────────────────────────────────────────────

/** Update goal / target fields on a coach_clients row */
export async function updateClientSettings(coachId, clientId, fields) {
  // Only allow whitelisted columns
  const ALLOWED = ['goal', 'step_target', 'target_weight', 'calorie_target',
    'protein_target', 'carb_target', 'fat_target', 'total_weeks', 'workout_days', 'notes_coach'];
  const payload = {};
  for (const k of ALLOWED) { if (fields[k] !== undefined) payload[k] = fields[k]; }
  if (!Object.keys(payload).length) return { ok: false, error: 'Nothing to update' };

  const { error } = await supabase.from('coach_clients')
    .update(payload)
    .eq('coach_id', coachId)
    .eq('client_id', clientId);
  if (error) { console.error('[updateClientSettings]', error); return { ok: false, error: error.message }; }
  return { ok: true };
}

/** Archive a client (hides from active list but preserves all data) */
export async function archiveClient(coachId, clientId) {
  const { error } = await supabase.from('coach_clients')
    .update({ archived: true })
    .eq('coach_id', coachId)
    .eq('client_id', clientId);
  if (error) { console.error('[archiveClient]', error); return false; }
  return true;
}

/** Reactivate an archived client */
export async function reactivateClient(coachId, clientId) {
  const { error } = await supabase.from('coach_clients')
    .update({ archived: false })
    .eq('coach_id', coachId)
    .eq('client_id', clientId);
  if (error) { console.error('[reactivateClient]', error); return false; }
  return true;
}

// Fetch all clients for a coach (with real stats: weight, adherence, streak)
// Also includes "pending" clients from invite codes with client_setup that haven't been redeemed
export async function fetchClients(coachId, { includeArchived = false } = {}) {
  // Get coach_clients rows + pending invite codes in parallel
  let linksQuery = supabase.from('coach_clients').select('*').eq('coach_id', coachId);
  if (!includeArchived) linksQuery = linksQuery.or('archived.is.null,archived.eq.false');
  const [linksRes, pendingRes] = await Promise.allSettled([
    linksQuery,
    supabase.from('invite_codes').select('id, code, label, client_setup, used_count, max_uses, created_at')
      .eq('coach_id', coachId).eq('active', true).not('client_setup', 'is', null),
  ]);

  const links = linksRes.status === 'fulfilled' ? (linksRes.value?.data || []) : [];
  const pendingCodes = pendingRes.status === 'fulfilled' ? (pendingRes.value?.data || []) : [];

  // Build pending client entries from unused invite codes
  const pendingClients = pendingCodes
    .filter(c => c.used_count < c.max_uses && c.client_setup)
    .map(c => {
      const setup = c.client_setup;
      return {
        client_id: `pending-${c.id}`,
        invite_code_id: c.id,
        code: c.code,
        coach_id: coachId,
        client_name: setup.clientName || c.label || 'New Client',
        email: '',
        avatar_url: null,
        goal: GOAL_LABELS[setup.goal] || setup.goal || '',
        goalId: setup.goal || '',
        status: 'pending',
        isPending: true,
        start_date: c.created_at?.slice(0, 10) || '',
        program_week: 1,
        total_weeks: 12,
        step_target: setup.stepTarget || 10000,
        workout_days: [],
        weight: null,
        adherence: 0,
        streak: 0,
        lastActive: '—',
        clientSetup: setup,
      };
    });

  if (!links.length && !pendingClients.length) return [];
  if (!links.length) return pendingClients;

  const clientIds = links.map(l => l.client_id);
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  // Batch-fetch all stats in parallel
  const [profilesRes, weightsRes, checkinsRes, nutritionRes, workoutsRes] = await Promise.allSettled([
    supabase.from('profiles').select('id, full_name, email, avatar_url').in('id', clientIds),
    supabase.from('weight_log').select('client_id, date, weight').in('client_id', clientIds).order('date', { ascending: false }).limit(50),
    supabase.from('daily_checkins').select('client_id, date').in('client_id', clientIds).gte('date', sevenDaysAgo).order('date', { ascending: false }),
    supabase.from('nutrition_log').select('client_id, date').in('client_id', clientIds).gte('date', sevenDaysAgo),
    supabase.from('workout_sessions').select('client_id, date').in('client_id', clientIds).gte('date', sevenDaysAgo),
  ]);

  const profiles = profilesRes.status === 'fulfilled' ? (profilesRes.value?.data || []) : [];
  const weights = weightsRes.status === 'fulfilled' ? (weightsRes.value?.data || []) : [];
  const checkins = checkinsRes.status === 'fulfilled' ? (checkinsRes.value?.data || []) : [];
  const nutritionLogs = nutritionRes.status === 'fulfilled' ? (nutritionRes.value?.data || []) : [];
  const workoutSessions = workoutsRes.status === 'fulfilled' ? (workoutsRes.value?.data || []) : [];

  const activeClients = links.map(link => {
    const cid = link.client_id;
    const profile = profiles.find(p => p.id === cid);

    // Latest weight
    const clientWeights = weights.filter(w => w.client_id === cid);
    const latestWeight = clientWeights.length ? clientWeights[0].weight : null;

    // Streak: consecutive days with a daily checkin (going backwards from yesterday)
    const clientCheckins = checkins.filter(c => c.client_id === cid).map(c => c.date);
    let streak = 0;
    const d = new Date();
    d.setDate(d.getDate() - 1);
    while (true) {
      const key = d.toISOString().slice(0, 10);
      if (clientCheckins.includes(key)) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
    // Also count today if checked in
    if (clientCheckins.includes(today)) streak++;

    // Adherence: weighted score (nutrition 50%, workouts 30%, checkins 20%)
    const clientNutrition = new Set(nutritionLogs.filter(n => n.client_id === cid).map(n => n.date));
    const clientWorkouts = new Set(workoutSessions.filter(w => w.client_id === cid).map(w => w.date));
    const checkinDays = new Set(clientCheckins).size;
    const nutritionScore = Math.min(clientNutrition.size / 7, 1) * 50;
    const workoutScore = Math.min(clientWorkouts.size / 7, 1) * 30;
    const checkinScore = Math.min(checkinDays / 7, 1) * 20;
    const adherence = Math.round(nutritionScore + workoutScore + checkinScore);

    // Last active: most recent checkin or nutrition log
    const allDates = [...clientCheckins, ...Array.from(clientNutrition)].sort().reverse();
    let lastActive = '—';
    if (allDates.length) {
      const la = allDates[0];
      if (la === today) lastActive = 'Today';
      else {
        const diff = Math.floor((Date.now() - new Date(la + 'T12:00:00').getTime()) / 86400000);
        lastActive = diff === 1 ? 'Yesterday' : `${diff}d ago`;
      }
    }

    // Status based on adherence
    let status = 'on-track';
    if (adherence < 40) status = 'at-risk';
    else if (adherence < 70) status = 'attention';

    return {
      client_id: cid,
      coach_id: link.coach_id,
      client_name: profile?.full_name || 'Unknown',
      email: profile?.email || '',
      avatar_url: profile?.avatar_url || null,
      goal: GOAL_LABELS[link.goal] || link.goal || '',
      goalId: link.goal || '',
      status,
      start_date: link.start_date || '',
      program_week: link.program_week || 1,
      total_weeks: link.total_weeks || 12,
      step_target: link.step_target || 10000,
      workout_days: link.workout_days || [],
      weight: latestWeight,
      adherence,
      streak,
      lastActive,
      // Archive & target fields
      archived: link.archived || false,
      target_weight: link.target_weight || null,
      calorie_target: link.calorie_target || null,
      protein_target: link.protein_target || null,
      carb_target: link.carb_target || null,
      fat_target: link.fat_target || null,
      notes_coach: link.notes_coach || null,
    };
  });

  // Merge: active clients first, then pending ones
  return [...activeClients, ...pendingClients];
}

// Fetch all check-ins for coach review (both daily and weekly)
export async function fetchPendingCheckins(coachId) {
  // First get client IDs for this coach
  const { data: links } = await supabase
    .from('coach_clients')
    .select('client_id')
    .eq('coach_id', coachId);

  const clientIds = (links || []).map(l => l.client_id);

  // Also include the coach's own ID (coach may also be a client/athlete)
  if (!clientIds.includes(coachId)) clientIds.push(coachId);

  if (!clientIds.length) return [];

  // Get profile names
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', clientIds);

  const getName = (clientId) => {
    const p = (profiles || []).find(pr => pr.id === clientId);
    return p?.full_name || 'Client';
  };

  const allCheckins = [];

  // ── Weekly check-ins ──
  const { data: weeklyCheckins } = await supabase
    .from('weekly_checkins')
    .select('*')
    .in('client_id', clientIds)
    .order('created_at', { ascending: false })
    .limit(50);

  (weeklyCheckins || []).forEach(ci => {
    allCheckins.push({
      id: ci.id,
      client_id: ci.client_id,
      client_name: getName(ci.client_id),
      type: 'weekly',
      date: ci.date,
      week_number: ci.week_number,
      mood: ci.mood,
      sleep: ci.sleep_quality,
      energy: ci.energy,
      stress: null,
      weight: null,
      notes: ci.biggest_struggle || ci.what_went_well || ci.questions_for_coach || null,
      // Weekly-specific fields
      digestion: ci.digestion,
      pain: ci.pain,
      pain_detail: ci.pain_detail,
      nutrition_adherence: ci.nutrition_adherence,
      workouts_completed: ci.workouts_completed,
      water_avg: ci.water_avg,
      steps_goal: ci.steps_goal,
      biggest_struggle: ci.biggest_struggle,
      what_went_well: ci.what_went_well,
      what_to_improve: ci.what_to_improve,
      motivation: ci.motivation,
      questions_for_coach: ci.questions_for_coach,
      coach_feedback: ci.coach_feedback,
      status: ci.coach_feedback ? 'reviewed' : 'pending',
    });
  });

  // ── Daily check-ins (last 14 days) ──
  const since = new Date();
  since.setDate(since.getDate() - 14);
  const { data: dailyCheckins } = await supabase
    .from('daily_checkins')
    .select('*')
    .in('client_id', clientIds)
    .gte('date', since.toISOString().slice(0, 10))
    .order('date', { ascending: false })
    .limit(50);

  (dailyCheckins || []).forEach(ci => {
    // Skip empty daily check-ins — only show ones with actual meaningful data
    const hasMood = ci.mood != null && ci.mood !== '' && ci.mood !== 'none';
    const hasSleep = ci.sleep != null && ci.sleep > 0;
    const hasEnergy = ci.energy != null && ci.energy > 0;
    const hasStress = ci.stress != null && ci.stress > 0;
    const hasWeight = ci.weight != null && ci.weight > 0;
    const hasNote = ci.note != null && String(ci.note).trim() !== '';
    const hasHydration = ci.hydration != null && ci.hydration > 0;
    const hasSteps = ci.steps != null && ci.steps > 0;

    // Must have at least 2 meaningful fields, or a note — a single default value doesn't count
    const filledCount = [hasMood, hasSleep, hasEnergy, hasStress, hasWeight, hasHydration, hasSteps].filter(Boolean).length;
    if (!hasNote && filledCount < 2) return;

    allCheckins.push({
      id: ci.id,
      client_id: ci.client_id,
      client_name: getName(ci.client_id),
      type: 'daily',
      date: ci.date,
      mood: ci.mood,
      sleep: ci.sleep,
      energy: ci.energy,
      stress: ci.stress,
      weight: ci.weight,
      notes: ci.note,
      coach_feedback: ci.coach_feedback || null,
      status: ci.coach_feedback ? 'reviewed' : 'pending',
    });
  });

  // Sort all by date (most recent first)
  allCheckins.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return allCheckins;
}

// Fetch training templates (coach-created, not assigned to any client)
export async function fetchTrainingTemplates(coachId) {
  const { data } = await supabase.from('training_plans')
    .select('id, name, client_id')
    .eq('coach_id', coachId)
    .is('client_id', null)
    .order('created_at', { ascending: false });
  if (!data?.length) return [];

  // Deduplicate by name (keep most recent, which is first due to ordering)
  const seen = new Set();
  const unique = data.filter(p => {
    const key = p.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const templates = [];
  for (const plan of unique) {
    const { data: days } = await supabase
      .from('training_plan_days').select('id, name, sort_order')
      .eq('training_plan_id', plan.id).order('sort_order');

    if (!days?.length) {
      templates.push({ id: plan.id, name: plan.name, days: [] });
      continue;
    }

    const dayIds = days.map(d => d.id);
    const { data: exercises } = await supabase
      .from('training_plan_exercises').select('*')
      .in('training_plan_day_id', dayIds).order('sort_order');

    templates.push({
      id: plan.id,
      name: plan.name,
      days: days.map(day => ({
        name: day.name,
        exercises: (exercises || [])
          .filter(ex => ex.training_plan_day_id === day.id)
          .map(ex => ({
            name: ex.name,
            sets: ex.sets || 3,
            reps: ex.target_reps || '10-12',
            rest: ex.rest_seconds || 90,
            muscle: ex.muscle_group || '',
          })),
      })),
    });
  }
  return templates;
}

// Fetch nutrition templates (coach-created)
export async function fetchNutritionTemplates(coachId) {
  const { data, error } = await supabase.from('meal_plans')
    .select('id, name, meals, client_id')
    .eq('coach_id', coachId)
    .is('client_id', null)
    .order('created_at', { ascending: false });
  if (!data?.length) return [];

  return data.map(plan => ({
    id: plan.id,
    name: plan.name,
    targets: calculatePlanTargets(plan.meals || []),
    meals: (plan.meals || []).map(m => ({
      name: m.name,
      time: m.time || '',
      foods: (m.foods || []).map(f => ({
        fname: f.fname, grams: f.grams,
        kcal: f.kcal || 0, p: f.p || 0, c: f.c || 0, f: f.f || 0,
        per100: f.per100 || null,
      })),
    })),
  }));
}

function calculatePlanTargets(meals) {
  let calories = 0, protein = 0, carbs = 0, fat = 0;
  (meals || []).forEach(m => {
    (m.foods || []).forEach(f => {
      calories += f.kcal || 0;
      protein += f.p || 0;
      carbs += f.c || 0;
      fat += f.f || 0;
    });
  });
  return { calories, protein, carbs, fat };
}
