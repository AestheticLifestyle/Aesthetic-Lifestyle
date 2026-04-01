/**
 * Gamification Engine — Aesthetic Lifestyle App
 *
 * XP system, levels, achievements, and streak rewards.
 * Designed to drive adherence through Duolingo-style engagement loops.
 */

// ══════════════════════════════════════
// XP REWARDS — points earned per action
// ══════════════════════════════════════
export const XP_REWARDS = {
  LOG_WORKOUT:      25,
  LOG_ALL_MEALS:    20,
  HIT_STEP_TARGET:  15,
  HIT_CALORIE_TARGET: 15,
  HIT_PROTEIN_TARGET: 15,
  DAILY_CHECKIN:    10,
  LOG_WEIGHT:       10,
  LOG_WATER_3L:     10,
};

// ══════════════════════════════════════
// LEVELS — rank progression
// ══════════════════════════════════════
export const LEVELS = [
  { level: 1, title: 'Beginner',    xpRequired: 0,      color: '#6b7280' },
  { level: 2, title: 'Committed',   xpRequired: 500,    color: '#3b82f6' },
  { level: 3, title: 'Disciplined', xpRequired: 1500,   color: '#8b5cf6' },
  { level: 4, title: 'Dedicated',   xpRequired: 3500,   color: '#06b6d4' },
  { level: 5, title: 'Machine',     xpRequired: 7000,   color: '#f59e0b' },
  { level: 6, title: 'Elite',       xpRequired: 12000,  color: '#ef4444' },
  { level: 7, title: 'Aesthetic',   xpRequired: 20000,  color: '#d4af37' },
  { level: 8, title: 'Legend',      xpRequired: 35000,  color: '#ffd700' },
];

/**
 * Get current level info from total XP
 */
export function getLevelFromXP(totalXP) {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (totalXP >= lvl.xpRequired) current = lvl;
    else break;
  }
  const nextLevel = LEVELS.find(l => l.level === current.level + 1);
  const xpIntoLevel = totalXP - current.xpRequired;
  const xpForNext = nextLevel ? nextLevel.xpRequired - current.xpRequired : 0;
  const progress = xpForNext > 0 ? Math.min(xpIntoLevel / xpForNext, 1) : 1;

  return {
    ...current,
    totalXP,
    nextLevel,
    xpIntoLevel,
    xpForNext,
    progress, // 0-1 fraction to next level
    isMaxLevel: !nextLevel,
  };
}

// ══════════════════════════════════════
// ACHIEVEMENTS — unlockable badges
// ══════════════════════════════════════
export const ACHIEVEMENT_CATEGORIES = {
  STREAK: 'streak',
  TRAINING: 'training',
  NUTRITION: 'nutrition',
  PROGRESS: 'progress',
  CONSISTENCY: 'consistency',
};

export const ACHIEVEMENTS = [
  // ── Streak Milestones ──
  { id: 'streak_7',   category: 'streak',   title: 'Week Warrior',     description: '7-day streak',        icon: '🔥', requirement: { type: 'streak', days: 7 },   bonusXP: 100 },
  { id: 'streak_14',  category: 'streak',   title: 'Two Week Titan',   description: '14-day streak',       icon: '🔥', requirement: { type: 'streak', days: 14 },  bonusXP: 250 },
  { id: 'streak_28',  category: 'streak',   title: 'Monthly Master',   description: '28-day streak',       icon: '🔥', requirement: { type: 'streak', days: 28 },  bonusXP: 500 },
  { id: 'streak_60',  category: 'streak',   title: 'Iron Will',        description: '60-day streak',       icon: '💎', requirement: { type: 'streak', days: 60 },  bonusXP: 1000 },
  { id: 'streak_90',  category: 'streak',   title: 'Unstoppable',      description: '90-day streak',       icon: '👑', requirement: { type: 'streak', days: 90 },  bonusXP: 2000 },

  // ── Training ──
  { id: 'first_workout',    category: 'training', title: 'First Rep',       description: 'Complete your first workout',      icon: '💪', requirement: { type: 'total_workouts', count: 1 },    bonusXP: 50 },
  { id: 'workouts_25',      category: 'training', title: 'Quarter Century', description: 'Complete 25 workouts',             icon: '🏋️', requirement: { type: 'total_workouts', count: 25 },   bonusXP: 200 },
  { id: 'workouts_50',      category: 'training', title: 'Half Century',    description: 'Complete 50 workouts',             icon: '🏋️', requirement: { type: 'total_workouts', count: 50 },   bonusXP: 400 },
  { id: 'workouts_100',     category: 'training', title: 'Century Club',    description: 'Complete 100 workouts',            icon: '🏆', requirement: { type: 'total_workouts', count: 100 },  bonusXP: 1000 },
  { id: 'pr_10',            category: 'training', title: 'PR Crusher',      description: 'Set 10 personal records',          icon: '📈', requirement: { type: 'total_prs', count: 10 },       bonusXP: 300 },

  // ── Nutrition ──
  { id: 'meals_7_streak',   category: 'nutrition', title: 'Meal Prep Pro',   description: 'Log all meals 7 days in a row',   icon: '🍽️', requirement: { type: 'meal_streak', days: 7 },      bonusXP: 200 },
  { id: 'protein_30',       category: 'nutrition', title: 'Protein Machine', description: 'Hit protein target 30 times',     icon: '🥩', requirement: { type: 'protein_hits', count: 30 },    bonusXP: 400 },
  { id: 'macro_master',     category: 'nutrition', title: 'Macro Master',    description: 'Hit all macros 7 days in a row',  icon: '🎯', requirement: { type: 'macro_streak', days: 7 },     bonusXP: 500 },

  // ── Progress ──
  { id: 'first_weighin',    category: 'progress',  title: 'Scale Starter',     description: 'Log your first weight entry',    icon: '⚖️', requirement: { type: 'total_weighins', count: 1 },   bonusXP: 25 },
  { id: 'weighin_30',       category: 'progress',  title: 'Weigh-in Warrior',  description: 'Log weight 30 times',            icon: '⚖️', requirement: { type: 'total_weighins', count: 30 },  bonusXP: 300 },
  { id: 'lost_5kg',         category: 'progress',  title: '5 Down',            description: 'Lose 5 kg from starting weight', icon: '🔥', requirement: { type: 'weight_lost', kg: 5 },         bonusXP: 500 },
  { id: 'transformation_12',category: 'progress',  title: 'Transformation',    description: 'Complete 12 weeks of tracking',  icon: '🦋', requirement: { type: 'weeks_active', count: 12 },    bonusXP: 1000 },

  // ── Consistency ──
  { id: 'checkin_10',        category: 'consistency', title: 'Check-in Champ',   description: 'Complete 10 weekly check-ins',   icon: '📋', requirement: { type: 'total_checkins', count: 10 },  bonusXP: 200 },
  { id: 'perfect_week',      category: 'consistency', title: 'Perfect Week',     description: 'Hit all targets every day for 7 days', icon: '⭐', requirement: { type: 'perfect_week', count: 1 }, bonusXP: 500 },
  { id: 'daily_grinder_30',  category: 'consistency', title: 'Daily Grinder',    description: 'Score 100+ XP in a single day 30 times', icon: '⚡', requirement: { type: 'high_xp_days', count: 30 }, bonusXP: 400 },
  { id: 'xp_1000',           category: 'consistency', title: 'Thousand Club',    description: 'Earn 1,000 total XP',            icon: '🌟', requirement: { type: 'total_xp', amount: 1000 },    bonusXP: 100 },
  { id: 'xp_10000',          category: 'consistency', title: 'Ten Thousand',     description: 'Earn 10,000 total XP',           icon: '💫', requirement: { type: 'total_xp', amount: 10000 },   bonusXP: 500 },
];

/**
 * Calculate daily XP from a day's activities.
 * Returns { total, breakdown: [{ source, xp }] }
 */
export function calculateDailyXP({
  loggedWorkout = false,
  loggedAllMeals = false,
  hitStepTarget = false,
  hitCalorieTarget = false,
  hitProteinTarget = false,
  dailyCheckin = false,
  loggedWeight = false,
  loggedWater3L = false,
}) {
  const breakdown = [];
  if (loggedWorkout)      breakdown.push({ source: 'Workout',        xp: XP_REWARDS.LOG_WORKOUT });
  if (loggedAllMeals)     breakdown.push({ source: 'All Meals',      xp: XP_REWARDS.LOG_ALL_MEALS });
  if (hitStepTarget)      breakdown.push({ source: 'Step Target',    xp: XP_REWARDS.HIT_STEP_TARGET });
  if (hitCalorieTarget)   breakdown.push({ source: 'Calorie Target', xp: XP_REWARDS.HIT_CALORIE_TARGET });
  if (hitProteinTarget)   breakdown.push({ source: 'Protein Target', xp: XP_REWARDS.HIT_PROTEIN_TARGET });
  if (dailyCheckin)       breakdown.push({ source: 'Daily Check-in', xp: XP_REWARDS.DAILY_CHECKIN });
  if (loggedWeight)       breakdown.push({ source: 'Weight Log',     xp: XP_REWARDS.LOG_WEIGHT });
  if (loggedWater3L)      breakdown.push({ source: 'Water Goal',     xp: XP_REWARDS.LOG_WATER_3L });

  return {
    total: breakdown.reduce((s, b) => s + b.xp, 0),
    breakdown,
  };
}

/**
 * Check which achievements are newly unlocked given current stats.
 * Returns array of achievement IDs that should be unlocked.
 */
export function checkAchievements(stats, alreadyUnlocked = []) {
  const unlockedSet = new Set(alreadyUnlocked);
  const newlyUnlocked = [];

  for (const ach of ACHIEVEMENTS) {
    if (unlockedSet.has(ach.id)) continue;

    const req = ach.requirement;
    let met = false;

    switch (req.type) {
      case 'streak':
        met = (stats.currentStreak || 0) >= req.days;
        break;
      case 'total_workouts':
        met = (stats.totalWorkouts || 0) >= req.count;
        break;
      case 'total_prs':
        met = (stats.totalPRs || 0) >= req.count;
        break;
      case 'meal_streak':
        met = (stats.mealStreak || 0) >= req.days;
        break;
      case 'protein_hits':
        met = (stats.proteinHits || 0) >= req.count;
        break;
      case 'macro_streak':
        met = (stats.macroStreak || 0) >= req.days;
        break;
      case 'total_weighins':
        met = (stats.totalWeighins || 0) >= req.count;
        break;
      case 'weight_lost':
        met = (stats.weightLost || 0) >= req.kg;
        break;
      case 'weeks_active':
        met = (stats.weeksActive || 0) >= req.count;
        break;
      case 'total_checkins':
        met = (stats.totalCheckins || 0) >= req.count;
        break;
      case 'perfect_week':
        met = (stats.perfectWeeks || 0) >= req.count;
        break;
      case 'high_xp_days':
        met = (stats.highXPDays || 0) >= req.count;
        break;
      case 'total_xp':
        met = (stats.totalXP || 0) >= req.amount;
        break;
    }

    if (met) newlyUnlocked.push(ach.id);
  }

  return newlyUnlocked;
}

/**
 * Get achievement definition by ID.
 */
export function getAchievement(id) {
  return ACHIEVEMENTS.find(a => a.id === id) || null;
}

/**
 * Calculate streak from a sorted list of active dates (YYYY-MM-DD strings).
 * An active date is any date where at least 1 XP was earned.
 */
export function calculateStreak(activeDates) {
  if (!activeDates.length) return { current: 0, longest: 0 };

  const dateSet = new Set(activeDates);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  // Current streak: count back from today (or yesterday if today not yet active)
  let current = 0;
  let checkDate = dateSet.has(today) ? today : yesterday;

  if (!dateSet.has(checkDate)) {
    current = 0;
  } else {
    const d = new Date(checkDate + 'T12:00:00');
    while (dateSet.has(d.toISOString().slice(0, 10))) {
      current++;
      d.setDate(d.getDate() - 1);
    }
  }

  // Longest streak
  let longest = 0;
  let run = 0;
  const sorted = [...activeDates].sort();
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) { run = 1; }
    else {
      const prev = new Date(sorted[i - 1] + 'T12:00:00');
      const curr = new Date(sorted[i] + 'T12:00:00');
      const diff = (curr - prev) / 86400000;
      run = diff === 1 ? run + 1 : 1;
    }
    if (run > longest) longest = run;
  }

  return { current, longest };
}

// ══════════════════════════════════════
// STREAK MILESTONE REWARDS
// ══════════════════════════════════════
export const STREAK_MILESTONES = [7, 14, 28, 60, 90];

export function getStreakMilestone(streak) {
  const milestone = [...STREAK_MILESTONES].reverse().find(m => streak >= m);
  if (!milestone) return null;
  const ach = ACHIEVEMENTS.find(a => a.requirement.type === 'streak' && a.requirement.days === milestone);
  return ach || null;
}

/**
 * Generate shareable achievement card data.
 * Returns an object with all info needed to render the share card.
 */
export function buildShareCardData(achievement, level, streak, userName) {
  return {
    achievement,
    level,
    streak,
    userName: userName || 'Athlete',
    appName: 'Aesthetic Lifestyle',
    timestamp: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
  };
}
