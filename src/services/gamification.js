/**
 * Gamification Service — Supabase CRUD for XP, achievements, and streaks.
 *
 * Tables (auto-created via upsert if RLS allows):
 *   - client_xp: { id, client_id, date, xp_earned, sources (jsonb), created_at }
 *   - client_achievements: { id, client_id, achievement_id, unlocked_at }
 *   - client_streaks: { id, client_id, current_streak, longest_streak, last_active_date, updated_at }
 *   - client_gamification: { id, client_id, total_xp, level, total_workouts, total_prs, total_weighins,
 *                            total_checkins, protein_hits, high_xp_days, meal_streak, macro_streak,
 *                            perfect_weeks, weeks_active, updated_at }
 *
 * IMPORTANT: Because we can't create tables from the client, we store everything
 * in the existing `profiles` table under a `gamification` JSONB column as a fallback.
 * When the real tables exist, we use them. Otherwise, we fallback to profiles.gamification.
 */

import { supabase } from './supabase';

// ═══════════════════════════════════════
// Fallback: Store in profiles.gamification
// ═══════════════════════════════════════

/**
 * Load gamification data for a client.
 * Returns { totalXP, achievements, streak, stats } or defaults.
 */
export async function loadGamificationData(clientId) {
  if (!clientId) return getDefaults();

  try {
    // Try dedicated tables first
    const [xpRes, achRes, streakRes, statsRes] = await Promise.allSettled([
      supabase.from('client_xp').select('date, xp_earned, sources').eq('client_id', clientId).order('date', { ascending: true }),
      supabase.from('client_achievements').select('achievement_id, unlocked_at').eq('client_id', clientId),
      supabase.from('client_streaks').select('*').eq('client_id', clientId).single(),
      supabase.from('client_gamification').select('*').eq('client_id', clientId).single(),
    ]);

    // If the tables don't exist, fall back to profiles.gamification
    const tablesExist = xpRes.status === 'fulfilled' && !xpRes.value.error?.message?.includes('does not exist');

    if (tablesExist) {
      const xpLog = xpRes.value.data || [];
      const achievements = (achRes.status === 'fulfilled' ? achRes.value.data : []) || [];
      const streak = streakRes.status === 'fulfilled' ? streakRes.value.data : null;
      const stats = statsRes.status === 'fulfilled' ? statsRes.value.data : null;

      const totalXP = xpLog.reduce((s, r) => s + (r.xp_earned || 0), 0);

      return {
        totalXP: stats?.total_xp || totalXP,
        achievements: achievements.map(a => a.achievement_id),
        streak: {
          current: streak?.current_streak || 0,
          longest: streak?.longest_streak || 0,
          lastActive: streak?.last_active_date || null,
        },
        stats: stats || {},
        xpLog,
      };
    }

    // Fallback: profiles.gamification JSONB
    return await loadFromProfiles(clientId);
  } catch (err) {
    return await loadFromProfiles(clientId);
  }
}

async function loadFromProfiles(clientId) {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('gamification')
      .eq('id', clientId)
      .single();

    if (data?.gamification) {
      return {
        totalXP: data.gamification.totalXP || 0,
        achievements: data.gamification.achievements || [],
        streak: data.gamification.streak || { current: 0, longest: 0, lastActive: null },
        stats: data.gamification.stats || {},
        xpLog: data.gamification.xpLog || [],
      };
    }
  } catch (err) {
    /* swallow */
  }
  return getDefaults();
}

function getDefaults() {
  return {
    totalXP: 0,
    achievements: [],
    streak: { current: 0, longest: 0, lastActive: null },
    stats: {},
    xpLog: [],
  };
}

/**
 * Save gamification data for a client.
 */
export async function saveGamificationData(clientId, data) {
  if (!clientId) return false;

  try {
    // Try dedicated tables first
    const testRes = await supabase.from('client_gamification').select('id').eq('client_id', clientId).limit(1);
    const tablesExist = !testRes.error?.message?.includes('does not exist');

    if (tablesExist) {
      // Upsert stats
      await supabase.from('client_gamification').upsert({
        client_id: clientId,
        total_xp: data.totalXP || 0,
        level: data.level || 1,
        total_workouts: data.stats?.totalWorkouts || 0,
        total_prs: data.stats?.totalPRs || 0,
        total_weighins: data.stats?.totalWeighins || 0,
        total_checkins: data.stats?.totalCheckins || 0,
        protein_hits: data.stats?.proteinHits || 0,
        high_xp_days: data.stats?.highXPDays || 0,
        meal_streak: data.stats?.mealStreak || 0,
        macro_streak: data.stats?.macroStreak || 0,
        perfect_weeks: data.stats?.perfectWeeks || 0,
        weeks_active: data.stats?.weeksActive || 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'client_id' });

      // Upsert streak
      await supabase.from('client_streaks').upsert({
        client_id: clientId,
        current_streak: data.streak?.current || 0,
        longest_streak: data.streak?.longest || 0,
        last_active_date: data.streak?.lastActive || new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'client_id' });

      // Upsert achievements
      if (data.newAchievements?.length) {
        const rows = data.newAchievements.map(aId => ({
          client_id: clientId,
          achievement_id: aId,
          unlocked_at: new Date().toISOString(),
        }));
        await supabase.from('client_achievements').upsert(rows, { onConflict: 'client_id,achievement_id' });
      }

      // Upsert today's XP
      if (data.todayXP) {
        const today = new Date().toISOString().slice(0, 10);
        await supabase.from('client_xp').upsert({
          client_id: clientId,
          date: today,
          xp_earned: data.todayXP.total || 0,
          sources: data.todayXP.breakdown || [],
        }, { onConflict: 'client_id,date' });
      }

      return true;
    }

    // Fallback: save to profiles.gamification
    return await saveToProfiles(clientId, data);
  } catch (err) {
    return await saveToProfiles(clientId, data);
  }
}

async function saveToProfiles(clientId, data) {
  try {
    const gamification = {
      totalXP: data.totalXP || 0,
      achievements: data.achievements || [],
      streak: data.streak || { current: 0, longest: 0, lastActive: null },
      stats: data.stats || {},
      xpLog: (data.xpLog || []).slice(-90), // Keep last 90 days to avoid bloat
    };

    const { error } = await supabase
      .from('profiles')
      .update({ gamification })
      .eq('id', clientId);

    return !error;
  } catch (err) {
    return false;
  }
}

/**
 * Record today's XP and check for new achievements.
 * Called once per day-save cycle.
 */
export async function recordDailyXP(clientId, todayXP, allStats) {
  const existing = await loadGamificationData(clientId);
  const today = new Date().toISOString().slice(0, 10);

  // Update XP log
  const xpLog = [...(existing.xpLog || [])];
  const todayIdx = xpLog.findIndex(r => r.date === today);
  if (todayIdx >= 0) {
    xpLog[todayIdx] = { date: today, xp_earned: todayXP.total, sources: todayXP.breakdown };
  } else {
    xpLog.push({ date: today, xp_earned: todayXP.total, sources: todayXP.breakdown });
  }

  const totalXP = xpLog.reduce((s, r) => s + (r.xp_earned || 0), 0);

  // Merge stats
  const stats = { ...existing.stats, ...allStats, totalXP };

  return await saveGamificationData(clientId, {
    totalXP,
    level: getLevelFromTotalXP(totalXP),
    achievements: existing.achievements,
    streak: existing.streak,
    stats,
    xpLog,
    todayXP,
  });
}

function getLevelFromTotalXP(xp) {
  const levels = [
    { level: 1, xp: 0 }, { level: 2, xp: 500 }, { level: 3, xp: 1500 },
    { level: 4, xp: 3500 }, { level: 5, xp: 7000 }, { level: 6, xp: 12000 },
    { level: 7, xp: 20000 }, { level: 8, xp: 35000 },
  ];
  let lvl = 1;
  for (const l of levels) {
    if (xp >= l.xp) lvl = l.level;
  }
  return lvl;
}
