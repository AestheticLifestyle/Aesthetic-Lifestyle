import { create } from 'zustand';
import {
  getLevelFromXP, calculateDailyXP, checkAchievements,
  calculateStreak, getAchievement, ACHIEVEMENTS,
} from '../utils/gamification';
import { loadGamificationData, saveGamificationData } from '../services/gamification';

export const useGamificationStore = create((set, get) => ({
  // ── State ──
  totalXP: 0,
  level: null,          // getLevelFromXP result object
  achievements: [],     // array of achievement IDs
  streak: { current: 0, longest: 0, lastActive: null },
  stats: {},            // accumulated stats (totalWorkouts, totalWeighins, etc.)
  xpLog: [],            // [{ date, xp_earned, sources }]
  todayXP: null,        // { total, breakdown }
  loaded: false,
  saving: false,

  // Recently unlocked — for toast / animation
  recentUnlock: null,   // achievement object or null

  // ── Load from Supabase ──
  loadData: async (clientId) => {
    if (!clientId) return;
    try {
      const data = await loadGamificationData(clientId);
      const level = getLevelFromXP(data.totalXP);

      // Calculate today's entry from log
      const today = new Date().toISOString().slice(0, 10);
      const todayEntry = (data.xpLog || []).find(r => r.date === today);

      set({
        totalXP: data.totalXP,
        level,
        achievements: data.achievements || [],
        streak: data.streak || { current: 0, longest: 0, lastActive: null },
        stats: data.stats || {},
        xpLog: data.xpLog || [],
        todayXP: todayEntry ? { total: todayEntry.xp_earned, breakdown: todayEntry.sources || [] } : null,
        loaded: true,
      });
    } catch (err) {
      set({ loaded: true });
    }
  },

  // ── Calculate and save today's XP ──
  updateTodayXP: async (clientId, dayActivities, accumulatedStats) => {
    if (!clientId) return;

    const state = get();
    const todayXP = calculateDailyXP(dayActivities);
    const today = new Date().toISOString().slice(0, 10);

    // Update XP log
    const xpLog = [...state.xpLog];
    const idx = xpLog.findIndex(r => r.date === today);
    if (idx >= 0) {
      xpLog[idx] = { date: today, xp_earned: todayXP.total, sources: todayXP.breakdown };
    } else {
      xpLog.push({ date: today, xp_earned: todayXP.total, sources: todayXP.breakdown });
    }

    // Recalculate total XP
    const totalXP = xpLog.reduce((s, r) => s + (r.xp_earned || 0), 0);
    const level = getLevelFromXP(totalXP);

    // Calculate streak from active dates
    const activeDates = xpLog.filter(r => r.xp_earned > 0).map(r => r.date);
    const streak = calculateStreak(activeDates);

    // Merge stats
    const stats = {
      ...state.stats,
      ...accumulatedStats,
      totalXP,
      currentStreak: streak.current,
    };

    // Check for new achievements
    const newlyUnlocked = checkAchievements(stats, state.achievements);
    const allAchievements = [...state.achievements, ...newlyUnlocked];

    // Add bonus XP from achievements
    let bonusXP = 0;
    newlyUnlocked.forEach(id => {
      const ach = getAchievement(id);
      if (ach) bonusXP += ach.bonusXP || 0;
    });

    const finalTotalXP = totalXP + bonusXP;
    const finalLevel = getLevelFromXP(finalTotalXP);

    // Set recent unlock for toast animation (only first one)
    const recentUnlock = newlyUnlocked.length > 0 ? getAchievement(newlyUnlocked[0]) : null;

    set({
      totalXP: finalTotalXP,
      level: finalLevel,
      achievements: allAchievements,
      streak,
      stats,
      xpLog,
      todayXP,
      recentUnlock,
    });

    // Persist (debounced in calling component, or immediate)
    set({ saving: true });
    await saveGamificationData(clientId, {
      totalXP: finalTotalXP,
      level: finalLevel.level,
      achievements: allAchievements,
      streak,
      stats,
      xpLog: xpLog.slice(-90),
      todayXP,
      newAchievements: newlyUnlocked,
    });
    set({ saving: false });
  },

  // ── Dismiss recent unlock toast ──
  dismissRecentUnlock: () => set({ recentUnlock: null }),

  // ── Get achievement progress ──
  getAchievementProgress: () => {
    const { achievements } = get();
    const unlockedSet = new Set(achievements);
    return ACHIEVEMENTS.map(ach => ({
      ...ach,
      unlocked: unlockedSet.has(ach.id),
    }));
  },
}));
