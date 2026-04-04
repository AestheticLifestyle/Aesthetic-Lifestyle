import { supabase } from './supabase';

// ── Meal Plans (coach-created templates) ──

export async function fetchMealPlan(clientId) {
  const { data, error } = await supabase
    .from('meal_plans').select('id, name, meals')
    .eq('client_id', clientId).eq('is_active', true).single();
  if (error) console.warn('[fetchMealPlan] error:', error.message, '| client:', clientId);
  if (!data) { console.warn('[fetchMealPlan] no active plan for client:', clientId); return null; }

  return (data.meals || []).map(meal => ({
    name: meal.name,
    time: meal.time || '',
    logged: false,
    foods: (meal.foods || []).map(f => ({
      fname: f.fname, grams: f.grams,
      p: f.p, c: f.c, f: f.f, kcal: f.kcal,
      per100: f.per100 || null,
      checked: false,
    })),
  }));
}

export async function saveMealPlan(clientId, coachId, meals, planName = 'Meal Plan') {
  // Deactivate existing
  const { error: deactivateErr } = await supabase.from('meal_plans')
    .update({ is_active: false })
    .eq('client_id', clientId).eq('is_active', true);
  if (deactivateErr) console.warn('[saveMealPlan] deactivate error:', deactivateErr);

  const planMeals = meals.map(m => ({
    name: m.name, time: m.time,
    foods: m.foods.map(f => ({
      fname: f.fname, grams: f.grams,
      p: f.p, c: f.c, f: f.f, kcal: f.kcal,
      per100: f.per100 || null,
    })),
  }));

  const { data, error } = await supabase.from('meal_plans').insert({
    client_id: clientId, coach_id: coachId,
    name: planName, is_active: true, meals: planMeals,
  }).select('id');

  if (error) {
    console.error('[saveMealPlan] insert error:', error);
    return { ok: false, error: error.message };
  }
  console.log('[saveMealPlan] success, id:', data?.[0]?.id);
  return { ok: true };
}

// ── Coach Nutrition Templates (saved with client_id = null) ──

export async function saveNutritionTemplate(coachId, plan) {
  const planMeals = (plan.meals || []).map(m => ({
    name: m.name, time: m.time,
    foods: (m.foods || []).map(f => ({
      fname: f.fname, grams: f.grams,
      p: f.p, c: f.c, f: f.f, kcal: f.kcal,
      per100: f.per100 || null,
    })),
  }));

  // If plan has a real Supabase UUID, update it; otherwise insert new
  const isExisting = plan.id && !String(plan.id).startsWith('new-');

  if (isExisting) {
    const { error } = await supabase.from('meal_plans').update({
      name: plan.name, meals: planMeals,
    }).eq('id', plan.id);
    if (error) { console.error('[saveTemplate] update error:', error); return { ok: false, error: error.message }; }
    return { ok: true, id: plan.id };
  } else {
    const { data, error } = await supabase.from('meal_plans').insert({
      coach_id: coachId, client_id: null,
      name: plan.name, meals: planMeals,
      is_active: false,
    }).select('id');
    if (error) { console.error('[saveTemplate] insert error:', error); return { ok: false, error: error.message }; }
    const newId = data?.[0]?.id;
    console.log('[saveTemplate] created:', newId);
    return { ok: true, id: newId };
  }
}

export async function deleteNutritionTemplate(planId) {
  const { error } = await supabase.from('meal_plans').delete().eq('id', planId);
  if (error) { console.error('[deleteTemplate] error:', error); return false; }
  return true;
}

// ── Daily Nutrition Logs ──

export async function saveDailyNutritionLog(clientId, meals, dateKey) {
  const today = dateKey || new Date().toISOString().slice(0, 10);
  const realMeals = meals.filter(m => m.name !== 'Quick Add');
  const mealsLogged = realMeals.filter(m => m.logged).length;
  let totalKcal = 0, totalP = 0, totalC = 0, totalF = 0;

  // Count ALL checked foods, excluding removed plan foods
  meals.forEach(m => {
    m.foods.forEach(f => {
      if (f.checked && !f.removed) { totalKcal += f.kcal || 0; totalP += f.p || 0; totalC += f.c || 0; totalF += f.f || 0; }
    });
  });

  const mealsData = meals.map(m => ({
    name: m.name, logged: m.logged,
    foods: m.foods.map(f => ({
      fname: f.fname, grams: f.grams || 0, checked: f.checked,
      kcal: f.kcal || 0, p: f.p || 0, c: f.c || 0, f: f.f || 0,
      per100: f.per100 || null, addedByClient: f.addedByClient || false,
      removed: f.removed || false,
    })),
  }));

  const { error } = await supabase.from('daily_nutrition_logs').upsert({
    client_id: clientId, date: today,
    meals_logged: mealsLogged, meals_total: realMeals.length,
    total_kcal: Math.round(totalKcal), total_protein: Math.round(totalP),
    total_carbs: Math.round(totalC), total_fat: Math.round(totalF),
    meals_data: mealsData,
  }, { onConflict: 'client_id,date' });
  return !error;
}

export async function fetchDailyNutritionLog(clientId, date) {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase.from('daily_nutrition_logs')
    .select('*').eq('client_id', clientId).eq('date', targetDate).single();
  if (error || !data) return null;
  return data;
}

export async function fetchNutritionLogHistory(clientId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data } = await supabase.from('daily_nutrition_logs')
    .select('date, meals_logged, meals_total, total_kcal, total_protein, total_carbs, total_fat')
    .eq('client_id', clientId)
    .gte('date', since.toISOString().slice(0, 10))
    .order('date', { ascending: false });
  return data || [];
}

// ── Coach: Update client macro targets by scaling meal plan ──
export async function updateClientMacroTargets(clientId, coachId, newTargets) {
  // Fetch current active meal plan
  const { data: plan, error: planErr } = await supabase
    .from('meal_plans').select('id, name, meals')
    .eq('client_id', clientId).eq('is_active', true).single();

  if (planErr || !plan) {
    // No active meal plan — create a minimal one with the targets
    const baseMeals = [
      { name: 'Meal 1', time: '08:00', foods: [] },
      { name: 'Meal 2', time: '12:00', foods: [] },
      { name: 'Meal 3', time: '18:00', foods: [] },
    ];
    const { error } = await supabase.from('meal_plans').insert({
      client_id: clientId, coach_id: coachId,
      name: 'Macro Plan', is_active: true, meals: baseMeals,
      targets: newTargets,
    });
    return !error;
  }

  // Calculate current totals from meal plan foods
  let curKcal = 0, curP = 0, curC = 0, curF = 0;
  (plan.meals || []).forEach(m => (m.foods || []).forEach(f => {
    curKcal += f.kcal || 0; curP += f.p || 0; curC += f.c || 0; curF += f.f || 0;
  }));

  // If there are foods, scale them proportionally to hit new targets
  if (curKcal > 0) {
    const ratio = newTargets.calories / curKcal;
    const scaledMeals = plan.meals.map(m => ({
      ...m,
      foods: (m.foods || []).map(f => {
        const r = ratio;
        const newGrams = Math.round((f.grams || 100) * r);
        return {
          ...f,
          grams: newGrams,
          kcal: Math.round((f.kcal || 0) * r),
          p: Math.round((f.p || 0) * (newTargets.protein / (curP || 1))),
          c: Math.round((f.c || 0) * (newTargets.carbs / (curC || 1))),
          f: Math.round((f.f || 0) * (newTargets.fat / (curF || 1))),
        };
      }),
    }));

    const { error } = await supabase.from('meal_plans')
      .update({ meals: scaledMeals, targets: newTargets })
      .eq('id', plan.id);
    return !error;
  }

  // No foods in plan — just store targets metadata
  const { error } = await supabase.from('meal_plans')
    .update({ targets: newTargets })
    .eq('id', plan.id);
  return !error;
}
