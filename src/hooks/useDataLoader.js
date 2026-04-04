import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useClientStore } from '../stores/clientStore';
import { useCoachStore } from '../stores/coachStore';
import { supabase } from '../services/supabase';

// Service imports
import { fetchTrainingPlan, fetchWorkoutHistory } from '../services/training';
import { fetchMealPlan, fetchDailyNutritionLog } from '../services/nutrition';
import { fetchWeightLog, fetchMeasurements, fetchProgressPhotos } from '../services/progress';
import { fetchClients, fetchPendingCheckins, fetchTrainingTemplates, fetchNutritionTemplates } from '../services/chat';

function todayKey() { return new Date().toISOString().slice(0, 10); }

/**
 * Central hook that loads all data for the current user on login.
 */
export function useDataLoader() {
  const { user, role } = useAuthStore();
  const loadedRole = useRef(null);

  const store = useClientStore();
  const {
    setTrainingPlan, setWorkoutHistory, setMeals, setMacroTargets,
    setWeightLog, setMeasurements, setPhotos, _setDayData, setGoal,
  } = store;

  const coachStore = useCoachStore();
  const {
    setClients, setStats, setPendingCheckins,
    setTrainingTemplates, setNutritionTemplates,
    clients: coachClients,
  } = coachStore;

  useEffect(() => {
    if (!user) return;
    // Skip if we already loaded for this exact role
    if (loadedRole.current === role) return;
    loadedRole.current = role;

    const userId = user.id;

    if (role === 'client') {
      // If coach is switching to client view, use linked client's ID
      const linkedClient = coachClients?.[0]?.client_id;
      // Fall back to sessionStorage (survives page refresh before coach data loads)
      const savedClientId = sessionStorage.getItem('overrideClientId');
      const clientId = linkedClient || savedClientId || userId;
      loadClientData(clientId);
    } else if (role === 'coach') {
      loadCoachData(userId);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  async function loadClientData(clientId) {
    try {
      const today = todayKey();

      // Parallel fetch for speed
      const [plan, weightLog, measurements, photos, nutritionLog, dailyCheckin, goalRes] = await Promise.allSettled([
        fetchTrainingPlan(clientId),
        fetchWeightLog(clientId),
        fetchMeasurements(clientId),
        fetchProgressPhotos(clientId),
        fetchDailyNutritionLog(clientId, today),
        supabase.from('daily_checkins')
          .select('hydration, steps')
          .eq('client_id', clientId)
          .eq('date', today)
          .single(),
        supabase.from('coach_clients')
          .select('goal, step_goal, water_goal')
          .eq('client_id', clientId)
          .single(),
      ]);

      if (plan.status === 'fulfilled' && plan.value) {
        setTrainingPlan(plan.value);
      }

      if (weightLog.status === 'fulfilled') {
        setWeightLog(weightLog.value);
      }

      if (measurements.status === 'fulfilled') {
        setMeasurements(measurements.value);
      }

      if (photos.status === 'fulfilled') {
        setPhotos(photos.value || []);
      }

      // Load goal + targets from coach_clients
      if (goalRes.status === 'fulfilled' && goalRes.value?.data) {
        const cc = goalRes.value.data;
        if (cc.goal) setGoal(cc.goal);
        if (cc.step_goal) store.setStepGoal?.(cc.step_goal);
        if (cc.water_goal) store.setWaterGoal?.(cc.water_goal);
      }

      // Load today's water/steps from daily_checkins
      let todayWater = 0;
      let todaySteps = 0;
      if (dailyCheckin.status === 'fulfilled' && dailyCheckin.value?.data) {
        todayWater = Math.round((dailyCheckin.value.data.hydration || 0) * 1000);
        todaySteps = dailyCheckin.value.data.steps || 0;
      }

      // Restore today's nutrition state if available
      if (nutritionLog.status === 'fulfilled' && nutritionLog.value?.meals_data) {
        const mealPlan = await fetchMealPlan(clientId);
        if (mealPlan) {
          const todayLog = nutritionLog.value.meals_data;
          const mergedMeals = mealPlan.map(meal => {
            const saved = todayLog.find(s => s.name === meal.name);
            if (saved) {
              return {
                ...meal,
                logged: saved.logged,
                foods: meal.foods.map(food => {
                  const savedFood = (saved.foods || []).find(sf => sf.fname === food.fname);
                  return { ...food, checked: savedFood?.checked || false };
                }),
              };
            }
            return meal;
          });
          setMeals(mergedMeals);
        }
      } else {
        const mealPlan = await fetchMealPlan(clientId);
        if (mealPlan) setMeals(mealPlan);
      }

      // Set today's water/steps in per-date store
      _setDayData(today, {
        waterML: todayWater,
        currentSteps: todaySteps,
        loaded: true,
      });

      // Workout history
      const history = await fetchWorkoutHistory(clientId);
      if (history) setWorkoutHistory(history);

      // Mark data as loaded so screens can stop showing skeletons
      store.setDataLoaded(true);

    } catch (err) {
      console.error('[DataLoader] Client data error:', err);
      store.setDataLoaded(true); // still mark loaded so screens don't hang
    }
  }

  async function loadCoachData(coachId) {
    try {
      const [clientsRes, checkinsRes, templatesRes, nutritionRes] = await Promise.allSettled([
        fetchClients(coachId),
        fetchPendingCheckins(coachId),
        fetchTrainingTemplates(coachId),
        fetchNutritionTemplates(coachId),
      ]);

      const clients = clientsRes.status === 'fulfilled' ? (clientsRes.value || []) : [];
      setClients(clients);

      const checkins = checkinsRes.status === 'fulfilled' ? (checkinsRes.value || []) : [];
      setPendingCheckins(checkins);

      const templates = templatesRes.status === 'fulfilled' ? (templatesRes.value || []) : [];
      setTrainingTemplates(templates);

      const nutrition = nutritionRes.status === 'fulfilled' ? (nutritionRes.value || []) : [];
      setNutritionTemplates(nutrition);

      setStats({
        totalClients: clients.length,
        activeToday: 0,
        pendingCheckins: checkins.length,
        avgAdherence: clients.length
          ? Math.round(clients.reduce((s, c) => s + (c.adherence || 0), 0) / clients.length)
          : 0,
      });
    } catch (err) {
      console.error('[DataLoader] Coach data error:', err);
    }
  }
}
