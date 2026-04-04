import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { saveDailyNutritionLog, fetchDailyNutritionLog, fetchMealPlan } from '../services/nutrition';
import { saveDailyCheckin } from '../services/checkins';

function todayKey() { return new Date().toISOString().slice(0, 10); }

/**
 * Per-date daily data structure.
 * Each date key maps to its own water, steps, meal-check states, etc.
 */
function emptyDayData() {
  return {
    waterML: 0,
    currentSteps: 0,
    workout: false,
    mealStates: null,      // [{ logged, foods: [{ checked }] }] — null = not loaded yet
    extraFoods: [],        // [{ mealIdx: number|null, fname, grams, kcal, p, c, f, per100, checked }]
    removedPlanFoods: [],  // ['mealIdx-foodIdx', ...] — plan foods hidden by client for this day
    gramOverrides: {},     // { 'mealIdx-foodIdx': newGrams } — per-day gram changes for plan foods
    loaded: false,
  };
}

/**
 * Recalculate macros for a food given a new gram amount, using per100 data.
 * Falls back to proportional scaling from original values if per100 is missing.
 */
function recalcMacros(food, newGrams) {
  if (food.per100) {
    const mult = newGrams / 100;
    return {
      grams: newGrams,
      kcal: Math.round(food.per100.kcal * mult),
      p: Math.round(food.per100.p * mult),
      c: Math.round(food.per100.c * mult),
      f: Math.round(food.per100.f * mult),
    };
  }
  // Proportional scaling from original grams
  if (food._origGrams && food._origGrams > 0) {
    const ratio = newGrams / food._origGrams;
    return {
      grams: newGrams,
      kcal: Math.round((food._origKcal || food.kcal) * ratio),
      p: Math.round((food._origP || food.p) * ratio),
      c: Math.round((food._origC || food.c) * ratio),
      f: Math.round((food._origF || food.f) * ratio),
    };
  }
  return { grams: newGrams };
}

/**
 * Calculate macro targets by summing all foods across all meals.
 */
function calcTargetsFromMeals(meals) {
  let calories = 0, protein = 0, carbs = 0, fat = 0;
  (meals || []).forEach(m => {
    (m.foods || []).forEach(f => {
      calories += f.kcal || 0;
      protein += f.p || 0;
      carbs += f.c || 0;
      fat += f.f || 0;
    });
  });
  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
  };
}

export const useClientStore = create((set, get) => ({
  // ── Loading state ──
  dataLoaded: false,
  setDataLoaded: (v) => set({ dataLoaded: v }),

  // ── Date navigation ──
  selectedDate: todayKey(),
  isToday: true,

  // ── Per-date data map ──
  dayDataMap: {}, // { [dateKey]: { waterML, currentSteps, workout, mealStates, loaded } }

  // Get day data for a specific date (creates empty if missing)
  _getDayData: (dateKey) => {
    const map = get().dayDataMap;
    return map[dateKey] || emptyDayData();
  },

  // Set day data for a specific date
  _setDayData: (dateKey, updates) => {
    const current = get()._getDayData(dateKey);
    set(s => ({
      dayDataMap: {
        ...s.dayDataMap,
        [dateKey]: { ...current, ...updates },
      },
    }));
  },

  // ── Convenience getters for the SELECTED date ──
  get waterML() { return get()._getDayData(get().selectedDate).waterML; },
  get currentSteps() { return get()._getDayData(get().selectedDate).currentSteps; },

  // ── Date navigation ──
  setSelectedDate: (dateStr) => {
    const state = get();
    // Save current day before switching
    _autosave(state);
    set({ selectedDate: dateStr, isToday: dateStr === todayKey() });
    // Load target day data
    _loadDayIfNeeded(dateStr, get);
  },

  goToPrevDay: () => {
    const state = get();
    _autosave(state);
    const d = new Date(state.selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    const key = d.toISOString().slice(0, 10);
    set({ selectedDate: key, isToday: key === todayKey() });
    _loadDayIfNeeded(key, get);
  },

  goToNextDay: () => {
    const state = get();
    const d = new Date(state.selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    const key = d.toISOString().slice(0, 10);
    if (key > todayKey()) return;
    _autosave(state);
    set({ selectedDate: key, isToday: key === todayKey() });
    _loadDayIfNeeded(key, get);
  },

  goToToday: () => {
    const state = get();
    if (state.isToday) return;
    _autosave(state);
    const key = todayKey();
    set({ selectedDate: key, isToday: true });
    _loadDayIfNeeded(key, get);
  },

  // ── Training ──
  trainingPlan: null,
  workoutHistory: {},
  activeWorkoutDay: 0,
  workoutActive: false,

  // ── Nutrition (meal plan template — same for all days) ──
  mealPlanTemplate: [], // The base meal plan from coach (no check states)
  macroTargets: { calories: 2400, protein: 180, carbs: 260, fat: 70 },

  // ── Daily tracking (these are now per-date via dayDataMap) ──
  stepGoal: 10000,
  setStepGoal: (v) => set({ stepGoal: v }),
  waterGoal: 3000,    // ml — coach can override via coach_clients
  setWaterGoal: (v) => set({ waterGoal: v }),

  // ── Progress ──
  weightLog: [],
  measurements: [],
  photos: [], // Array of { pose, url, date, storage_path }

  // ── Goals ──
  goal: '', // 'cut', 'lean-bulk', 'recomp', 'maintenance', 'comp-prep'
  goals: { type: '', targetWeight: null, startWeight: null, targetDate: null, why: '' },

  // ── Daily log (for streak calendar etc) ──
  dailyLog: {},

  // ══════════════════════════════════════
  // ACTIONS
  // ══════════════════════════════════════

  setTrainingPlan: (plan) => set({ trainingPlan: plan }),
  setWorkoutDay: (idx) => set({ activeWorkoutDay: idx }),
  setWorkoutActive: (active) => set({ workoutActive: active }),
  setWorkoutHistory: (history) => set({ workoutHistory: history }),

  // Set meal plan template (base plan from coach, no per-day check states)
  setMealPlanTemplate: (meals) => {
    const targets = calcTargetsFromMeals(meals);
    set({ mealPlanTemplate: meals, macroTargets: targets });
  },
  setMacroTargets: (targets) => set({ macroTargets: targets }),

  // Legacy setter — used by useDataLoader. Sets template AND applies to today.
  setMeals: (meals) => {
    // Extract the template (without checked states) and per-day states
    const template = meals.map(m => ({
      name: m.name, time: m.time || '',
      foods: (m.foods || []).map(f => ({
        fname: f.fname, grams: f.grams, p: f.p, c: f.c, f: f.f, kcal: f.kcal,
        per100: f.per100 || null,
      })),
    }));
    const targets = calcTargetsFromMeals(template);
    const mealStates = meals.map(m => ({
      logged: m.logged || false,
      foods: (m.foods || []).map(f => ({ checked: f.checked || false })),
    }));
    const dateKey = get().selectedDate;
    set(s => ({
      mealPlanTemplate: template,
      macroTargets: targets,
      dayDataMap: {
        ...s.dayDataMap,
        [dateKey]: { ...(s.dayDataMap[dateKey] || emptyDayData()), mealStates, loaded: true },
      },
    }));
  },

  // Get merged meals for the selected date (template + per-day check states + extra foods)
  getMealsForDate: () => {
    const state = get();
    const template = state.mealPlanTemplate;
    const dayData = state._getDayData(state.selectedDate);
    const mealStates = dayData.mealStates;
    const extraFoods = dayData.extraFoods || [];
    const removedSet = new Set(dayData.removedPlanFoods || []);
    const gramOverrides = dayData.gramOverrides || {};

    // Build plan meals
    const meals = template.map((meal, mi) => {
      const ms = mealStates?.[mi];
      const planFoods = meal.foods.map((food, fi) => {
        const key = `${mi}-${fi}`;
        const overrideGrams = gramOverrides[key];
        let displayFood = {
          ...food,
          checked: ms?.foods?.[fi]?.checked || false,
          _planFoodIdx: fi,
          _mealIdx: mi,
          _removed: removedSet.has(key),
          _origGrams: food.grams,
          _origKcal: food.kcal, _origP: food.p, _origC: food.c, _origF: food.f,
        };
        // Apply gram override if present
        if (overrideGrams != null && overrideGrams !== food.grams) {
          const recalced = recalcMacros(displayFood, overrideGrams);
          displayFood = { ...displayFood, ...recalced };
        }
        return displayFood;
      });
      // Append extra foods that belong to this meal
      const mealExtras = extraFoods
        .map((ef, ei) => ({ ...ef, _extraIdx: ei }))
        .filter(ef => ef.mealIdx === mi);
      return {
        ...meal,
        logged: ms?.logged || false,
        foods: [...planFoods, ...mealExtras],
      };
    });

    // Collect extra foods not assigned to any meal (mealIdx === null) → "Quick Add" section
    const unassigned = extraFoods
      .map((ef, ei) => ({ ...ef, _extraIdx: ei }))
      .filter(ef => ef.mealIdx === null || ef.mealIdx === undefined);
    if (unassigned.length > 0) {
      meals.push({
        name: 'Quick Add',
        time: '',
        logged: false,
        _isQuickAdd: true,
        foods: unassigned,
      });
    }

    return meals;
  },

  // ── Nutrition actions (date-aware) ──
  logMeal: (mealIdx) => {
    const state = get();
    const dateKey = state.selectedDate;
    const dayData = state._getDayData(dateKey);
    const template = state.mealPlanTemplate;

    // Build or clone meal states
    const mealStates = dayData.mealStates
      ? dayData.mealStates.map(ms => ({ ...ms, foods: ms.foods.map(f => ({ ...f })) }))
      : template.map(m => ({ logged: false, foods: m.foods.map(() => ({ checked: false })) }));

    if (mealStates[mealIdx]) {
      mealStates[mealIdx].logged = true;
      mealStates[mealIdx].foods = mealStates[mealIdx].foods.map(f => ({ ...f, checked: true }));
    }

    state._setDayData(dateKey, { mealStates });
    _debouncedSaveCurrentDay();
  },

  toggleFoodCheck: (mealIdx, foodIdx) => {
    const state = get();
    const dateKey = state.selectedDate;
    const dayData = state._getDayData(dateKey);
    const template = state.mealPlanTemplate;

    const mealStates = dayData.mealStates
      ? dayData.mealStates.map(ms => ({ ...ms, foods: ms.foods.map(f => ({ ...f })) }))
      : template.map(m => ({ logged: false, foods: m.foods.map(() => ({ checked: false })) }));

    if (mealStates[mealIdx]?.foods?.[foodIdx]) {
      mealStates[mealIdx].foods[foodIdx].checked = !mealStates[mealIdx].foods[foodIdx].checked;
      const allChecked = mealStates[mealIdx].foods.every(f => f.checked);
      mealStates[mealIdx].logged = allChecked;
    }

    state._setDayData(dateKey, { mealStates });
    _debouncedSaveCurrentDay();
  },

  // ── Extra foods (client-added, outside the plan) ──
  addExtraFood: (food, mealIdx = null) => {
    const state = get();
    const dateKey = state.selectedDate;
    const dayData = state._getDayData(dateKey);
    const extraFoods = [...(dayData.extraFoods || []), { ...food, mealIdx, checked: true, addedByClient: true }];
    state._setDayData(dateKey, { extraFoods });
    _debouncedSaveCurrentDay();
  },

  removeExtraFood: (extraIdx) => {
    const state = get();
    const dateKey = state.selectedDate;
    const dayData = state._getDayData(dateKey);
    const extraFoods = (dayData.extraFoods || []).filter((_, i) => i !== extraIdx);
    state._setDayData(dateKey, { extraFoods });
    _debouncedSaveCurrentDay();
  },

  toggleExtraFoodCheck: (extraIdx) => {
    const state = get();
    const dateKey = state.selectedDate;
    const dayData = state._getDayData(dateKey);
    const extraFoods = (dayData.extraFoods || []).map((f, i) =>
      i === extraIdx ? { ...f, checked: !f.checked } : f
    );
    state._setDayData(dateKey, { extraFoods });
    _debouncedSaveCurrentDay();
  },

  getExtraFoodsForDate: () => {
    const state = get();
    const dayData = state._getDayData(state.selectedDate);
    return dayData.extraFoods || [];
  },

  // ── Remove / restore plan foods (per-day, doesn't change the template) ──
  removePlanFood: (mealIdx, foodIdx) => {
    const state = get();
    const dateKey = state.selectedDate;
    const dayData = state._getDayData(dateKey);
    const key = `${mealIdx}-${foodIdx}`;
    const removed = [...(dayData.removedPlanFoods || [])];
    if (!removed.includes(key)) removed.push(key);
    state._setDayData(dateKey, { removedPlanFoods: removed });
    _debouncedSaveCurrentDay();
  },

  restorePlanFood: (mealIdx, foodIdx) => {
    const state = get();
    const dateKey = state.selectedDate;
    const dayData = state._getDayData(dateKey);
    const key = `${mealIdx}-${foodIdx}`;
    const removed = (dayData.removedPlanFoods || []).filter(k => k !== key);
    state._setDayData(dateKey, { removedPlanFoods: removed });
    _debouncedSaveCurrentDay();
  },

  // ── Gram overrides (per-day, doesn't change the template) ──
  updateFoodGrams: (mealIdx, foodIdx, newGrams) => {
    const state = get();
    const dateKey = state.selectedDate;
    const dayData = state._getDayData(dateKey);
    const key = `${mealIdx}-${foodIdx}`;
    const overrides = { ...(dayData.gramOverrides || {}), [key]: newGrams };
    state._setDayData(dateKey, { gramOverrides: overrides });
    _debouncedSaveCurrentDay();
  },

  resetFoodGrams: (mealIdx, foodIdx) => {
    const state = get();
    const dateKey = state.selectedDate;
    const dayData = state._getDayData(dateKey);
    const key = `${mealIdx}-${foodIdx}`;
    const overrides = { ...(dayData.gramOverrides || {}) };
    delete overrides[key];
    state._setDayData(dateKey, { gramOverrides: overrides });
    _debouncedSaveCurrentDay();
  },

  // ── Water (date-aware) ──
  addWater: (ml = 250) => {
    const state = get();
    const dateKey = state.selectedDate;
    const dayData = state._getDayData(dateKey);
    state._setDayData(dateKey, { waterML: dayData.waterML + ml });
  },

  setWater: (ml) => {
    const dateKey = get().selectedDate;
    get()._setDayData(dateKey, { waterML: ml });
  },

  // ── Steps (date-aware) ──
  setSteps: (steps) => {
    const dateKey = get().selectedDate;
    get()._setDayData(dateKey, { currentSteps: steps });
  },

  // ── Weight log ──
  setWeightLog: (log) => set({ weightLog: log }),
  addWeight: (date, weight) => set(s => {
    const existing = s.weightLog.findIndex(w => w.date === date);
    const log = [...s.weightLog];
    if (existing >= 0) log[existing] = { date, weight };
    else log.push({ date, weight });
    log.sort((a, b) => a.date.localeCompare(b.date));
    return { weightLog: log };
  }),

  setMeasurements: (m) => set({ measurements: m }),
  addMeasurement: (date, data) => set(s => {
    const existing = s.measurements.findIndex(m => m.date === date);
    const list = [...s.measurements];
    if (existing >= 0) list[existing] = { ...list[existing], ...data, date };
    else list.push({ ...data, date });
    list.sort((a, b) => a.date.localeCompare(b.date));
    return { measurements: list };
  }),
  setPhotos: (p) => set({ photos: Array.isArray(p) ? p : [] }),
  addPhoto: (photoObj) => set(s => {
    // photoObj = { pose, url, date, storage_path }
    // Replace existing photo for same pose+date, keep others
    const filtered = s.photos.filter(p => !(p.pose === photoObj.pose && p.date === photoObj.date));
    const updated = [...filtered, photoObj].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    return { photos: updated };
  }),
  setGoal: (goal) => set({ goal }),
  setGoals: (g) => set({ goals: g }),

  // ── Daily log for streak ──
  getDailyLog: (dateKey) => {
    const logs = get().dailyLog;
    return logs[dateKey] || { weight: null, steps: 0, waterML: 0, workout: false };
  },
  updateDailyLog: (dateKey, data) => set(s => ({
    dailyLog: { ...s.dailyLog, [dateKey]: { ...s.getDailyLog(dateKey), ...data } },
  })),
}));


// ══════════════════════════════════════
// INTERNAL: Auto-save & auto-load helpers
// ══════════════════════════════════════

let _saveTimer = null;
let _inlineSaveTimer = null;

function _autosave(state) {
  // Debounced save of current day's data to Supabase (used on date navigation)
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _saveCurrentDayToSupabase(state);
  }, 500);
}

/**
 * Debounced save triggered by inline actions (food check, meal log, etc).
 * Reads fresh state from the store so it always saves the latest data.
 */
function _debouncedSaveCurrentDay() {
  clearTimeout(_inlineSaveTimer);
  _inlineSaveTimer = setTimeout(() => {
    const freshState = useClientStore.getState();
    _saveCurrentDayToSupabase(freshState);
  }, 1000);
}

async function _saveCurrentDayToSupabase(state) {
  try {
    // We need current auth user
    const { useAuthStore } = await import('./authStore');
    const authState = useAuthStore.getState();
    const user = authState.user;
    if (!user?.id) return;

    // If coach is in client view, save under the client's ID
    const clientId = authState.roleOverride
      ? (sessionStorage.getItem('overrideClientId') || user.id)
      : user.id;

    const dateKey = state.selectedDate;
    const dayData = state._getDayData(dateKey);
    const template = state.mealPlanTemplate;

    // Save nutrition log
    const hasData = (template.length > 0 && dayData.mealStates) || (dayData.extraFoods && dayData.extraFoods.length > 0);
    if (hasData) {
      const extraFoods = dayData.extraFoods || [];
      const removedSet = new Set(dayData.removedPlanFoods || []);
      const gramOverrides = dayData.gramOverrides || {};
      const mergedMeals = template.map((meal, mi) => {
        const ms = dayData.mealStates?.[mi];
        const planFoods = meal.foods.map((food, fi) => {
          const key = `${mi}-${fi}`;
          const overrideGrams = gramOverrides[key];
          let saved = {
            ...food,
            checked: ms?.foods?.[fi]?.checked || false,
            removed: removedSet.has(key),
          };
          // Apply gram override for saving
          if (overrideGrams != null && overrideGrams !== food.grams) {
            const recalced = recalcMacros({ ...food, _origGrams: food.grams, _origKcal: food.kcal, _origP: food.p, _origC: food.c, _origF: food.f }, overrideGrams);
            saved = { ...saved, ...recalced, gramsOverridden: true, origGrams: food.grams };
          }
          return saved;
        });
        // Append extra foods assigned to this meal
        const mealExtras = extraFoods.filter(ef => ef.mealIdx === mi).map(ef => ({
          fname: ef.fname, grams: ef.grams, kcal: ef.kcal, p: ef.p, c: ef.c, f: ef.f,
          per100: ef.per100 || null, checked: ef.checked, addedByClient: true,
        }));
        return {
          ...meal,
          logged: ms?.logged || false,
          foods: [...planFoods, ...mealExtras],
        };
      });
      // Unassigned extras as a "Quick Add" pseudo-meal
      const unassigned = extraFoods.filter(ef => ef.mealIdx === null || ef.mealIdx === undefined);
      if (unassigned.length > 0) {
        mergedMeals.push({
          name: 'Quick Add', time: '', logged: false,
          foods: unassigned.map(ef => ({
            fname: ef.fname, grams: ef.grams, kcal: ef.kcal, p: ef.p, c: ef.c, f: ef.f,
            per100: ef.per100 || null, checked: ef.checked, addedByClient: true,
          })),
        });
      }
      await saveDailyNutritionLog(clientId, mergedMeals, dateKey);
    }

    // Save daily checkin (water + steps)
    if (dayData.waterML > 0 || dayData.currentSteps > 0) {
      await saveDailyCheckin({
        client_id: clientId,
        date: dateKey,
        hydration: +(dayData.waterML / 1000).toFixed(1),
        steps: dayData.currentSteps,
      });
    }
  } catch (err) {
    console.warn('[AutoSave] Error:', err);
  }
}

async function _loadDayIfNeeded(dateKey, getState) {
  const state = getState();
  const dayData = state._getDayData(dateKey);

  // Already loaded this day
  if (dayData.loaded) return;

  try {
    const { useAuthStore } = await import('./authStore');
    const authState = useAuthStore.getState();
    const user = authState.user;
    if (!user?.id) return;

    // If coach is in client view, use the override client ID
    const clientId = authState.roleOverride
      ? (sessionStorage.getItem('overrideClientId') || user.id)
      : user.id;

    // Load nutrition log for this date
    const nutritionLog = await fetchDailyNutritionLog(clientId, dateKey);

    let mealStates = null;
    let waterML = 0;
    let currentSteps = 0;

    let extraFoods = [];
    let removedPlanFoods = [];
    let gramOverrides = {};
    if (nutritionLog?.meals_data) {
      const template = state.mealPlanTemplate;
      mealStates = template.map((meal, mi) => {
        const saved = (nutritionLog.meals_data || []).find(s => s.name === meal.name);
        // Restore extra foods that were added to this meal
        if (saved?.foods) {
          saved.foods.filter(sf => sf.addedByClient).forEach(sf => {
            extraFoods.push({
              fname: sf.fname, grams: sf.grams || 0,
              kcal: sf.kcal || 0, p: sf.p || 0, c: sf.c || 0, f: sf.f || 0,
              per100: sf.per100 || null, checked: sf.checked || false,
              addedByClient: true, mealIdx: mi,
            });
          });
        }
        return {
          logged: saved?.logged || false,
          foods: meal.foods.map((food, fi) => {
            const savedFood = (saved?.foods || []).find(sf => sf.fname === food.fname && !sf.addedByClient);
            // Restore removed state
            if (savedFood?.removed) {
              removedPlanFoods.push(`${mi}-${fi}`);
            }
            // Restore gram overrides
            if (savedFood?.gramsOverridden && savedFood?.origGrams != null) {
              gramOverrides[`${mi}-${fi}`] = savedFood.grams;
            }
            return { checked: savedFood?.checked || false };
          }),
        };
      });
      // Restore Quick Add foods (unassigned extras)
      const quickAdd = (nutritionLog.meals_data || []).find(s => s.name === 'Quick Add');
      if (quickAdd?.foods) {
        quickAdd.foods.filter(sf => sf.addedByClient).forEach(sf => {
          extraFoods.push({
            fname: sf.fname, grams: sf.grams || 0,
            kcal: sf.kcal || 0, p: sf.p || 0, c: sf.c || 0, f: sf.f || 0,
            per100: sf.per100 || null, checked: sf.checked || false,
            addedByClient: true, mealIdx: null,
          });
        });
      }
    }

    // Load daily checkin for water/steps
    const { data: checkin } = await supabase
      .from('daily_checkins')
      .select('hydration, steps')
      .eq('client_id', clientId)
      .eq('date', dateKey)
      .single();

    if (checkin) {
      waterML = Math.round((checkin.hydration || 0) * 1000);
      currentSteps = checkin.steps || 0;
    }

    state._setDayData(dateKey, {
      mealStates,
      extraFoods,
      removedPlanFoods,
      gramOverrides,
      waterML,
      currentSteps,
      loaded: true,
    });

  } catch (err) {
    console.warn('[LoadDay] Error:', err);
    // Mark as loaded anyway so we don't retry endlessly
    state._setDayData(dateKey, { loaded: true });
  }
}
