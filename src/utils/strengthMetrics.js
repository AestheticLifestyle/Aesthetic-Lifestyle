/**
 * Strength Metrics — 1RM estimation, PR detection, strength standards
 */

/**
 * Estimate 1RM using Epley formula: weight × (1 + reps/30)
 * Most accurate for reps 1-10
 */
export function estimate1RM(weight, reps) {
  if (!weight || weight <= 0 || !reps || reps <= 0) return 0;
  if (reps === 1) return weight;
  // Epley formula
  return Math.round(weight * (1 + reps / 30));
}

/**
 * Estimate weight needed for target reps from a known 1RM
 */
export function estimateWeightForReps(oneRM, targetReps) {
  if (!oneRM || targetReps <= 0) return 0;
  if (targetReps === 1) return oneRM;
  return Math.round(oneRM / (1 + targetReps / 30));
}

/**
 * Find the best (highest estimated 1RM) set from an array of sets
 * @param {Array} sets - [{kg, reps}, ...]
 * @returns {Object} { e1rm, kg, reps } or null
 */
export function bestSet(sets) {
  if (!sets?.length) return null;
  let best = null;
  for (const s of sets) {
    const kg = s.kg || s.weight || 0;
    const reps = s.reps || 0;
    if (kg <= 0 || reps <= 0) continue;
    const e1rm = estimate1RM(kg, reps);
    if (!best || e1rm > best.e1rm) {
      best = { e1rm, kg, reps };
    }
  }
  return best;
}

/**
 * Extract all-time PRs from workout history for each exercise
 * @param {Object} workoutHistory - keyed by dayIdx, each value is array of sessions with .sets
 * @returns {Object} { "Bench Press": { e1rm, kg, reps, date }, ... }
 */
export function extractAllTimePRs(workoutHistory) {
  if (!workoutHistory) return {};
  const prs = {};

  Object.values(workoutHistory).forEach(sessions => {
    (sessions || []).forEach(session => {
      const date = session.date;
      (session.sets || []).forEach(s => {
        const name = s.exercise;
        if (!name) return;
        const kg = s.kg || s.weight || 0;
        const reps = s.reps || 0;
        if (kg <= 0 || reps <= 0) return;
        const e1rm = estimate1RM(kg, reps);

        if (!prs[name] || e1rm > prs[name].e1rm) {
          prs[name] = { e1rm, kg, reps, date };
        }
      });
    });
  });

  return prs;
}

/**
 * Check if a set is a new PR compared to the all-time best
 * @returns 'e1rm' | 'weight' | 'reps' | null
 */
export function checkPR(exerciseName, kg, reps, allTimePRs) {
  const pr = allTimePRs[exerciseName];
  if (!pr) return 'e1rm'; // First ever set = PR

  const currentE1rm = estimate1RM(kg, reps);
  if (currentE1rm > pr.e1rm) return 'e1rm';
  if (kg > pr.kg) return 'weight';
  if (kg === pr.kg && reps > pr.reps) return 'reps';
  return null;
}

/**
 * Strength level estimation (rough, based on body weight ratios)
 * Returns: 'beginner' | 'novice' | 'intermediate' | 'advanced' | 'elite'
 */
export function strengthLevel(exerciseName, oneRM, bodyWeight) {
  if (!oneRM || !bodyWeight || bodyWeight <= 0) return null;
  const ratio = oneRM / bodyWeight;
  const name = (exerciseName || '').toLowerCase();

  // Rough standards for common compound lifts (male)
  if (/bench press/i.test(name)) {
    if (ratio < 0.6) return 'beginner';
    if (ratio < 0.9) return 'novice';
    if (ratio < 1.25) return 'intermediate';
    if (ratio < 1.6) return 'advanced';
    return 'elite';
  }
  if (/squat/i.test(name)) {
    if (ratio < 0.8) return 'beginner';
    if (ratio < 1.2) return 'novice';
    if (ratio < 1.65) return 'intermediate';
    if (ratio < 2.1) return 'advanced';
    return 'elite';
  }
  if (/deadlift/i.test(name)) {
    if (ratio < 1.0) return 'beginner';
    if (ratio < 1.4) return 'novice';
    if (ratio < 1.9) return 'intermediate';
    if (ratio < 2.4) return 'advanced';
    return 'elite';
  }
  if (/overhead press|ohp|shoulder press/i.test(name)) {
    if (ratio < 0.35) return 'beginner';
    if (ratio < 0.55) return 'novice';
    if (ratio < 0.8) return 'intermediate';
    if (ratio < 1.05) return 'advanced';
    return 'elite';
  }
  if (/barbell row/i.test(name)) {
    if (ratio < 0.5) return 'beginner';
    if (ratio < 0.75) return 'novice';
    if (ratio < 1.05) return 'intermediate';
    if (ratio < 1.35) return 'advanced';
    return 'elite';
  }

  // Generic — no level for non-standard exercises
  return null;
}

const LEVEL_COLORS = {
  beginner: 'var(--t3)',
  novice: 'var(--blue)',
  intermediate: 'var(--green)',
  advanced: 'var(--gold)',
  elite: 'var(--red, #e74c3c)',
};

export function getLevelColor(level) {
  return LEVEL_COLORS[level] || 'var(--t3)';
}
