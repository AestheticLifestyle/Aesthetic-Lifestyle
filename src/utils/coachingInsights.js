/**
 * Coaching Intelligence Engine
 * Detects plateaus, suggests adjustments, and generates insights.
 */

// ── Plateau Detection ──
// A plateau = weight hasn't changed meaningfully in X days despite adherence
export function detectPlateau(weightLog, { days = 14, threshold = 0.3 } = {}) {
  if (!weightLog || weightLog.length < 4) return null;

  const sorted = [...weightLog].sort((a, b) => a.date.localeCompare(b.date));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const recent = sorted.filter(w => w.date >= cutoffStr);
  if (recent.length < 3) return null;

  const weights = recent.map(w => w.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min;
  const avg = weights.reduce((s, w) => s + w, 0) / weights.length;

  // If weight hasn't moved more than threshold kg in the window
  if (range <= threshold) {
    return {
      detected: true,
      days: recent.length,
      avgWeight: parseFloat(avg.toFixed(1)),
      range: parseFloat(range.toFixed(2)),
      since: recent[0].date,
      message: `Weight has been stable at ~${avg.toFixed(1)} kg for ${recent.length} entries (±${(range / 2).toFixed(1)} kg). Consider adjusting calories or training.`,
    };
  }

  return { detected: false };
}

// ── Weight Trend Analysis ──
export function analyzeWeightTrend(weightLog, { days = 28 } = {}) {
  if (!weightLog || weightLog.length < 2) return null;

  const sorted = [...weightLog].sort((a, b) => a.date.localeCompare(b.date));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const recent = sorted.filter(w => w.date >= cutoffStr);
  if (recent.length < 2) return null;

  const first = recent[0];
  const last = recent[recent.length - 1];
  const totalChange = last.weight - first.weight;
  const weeklyRate = (totalChange / days) * 7;

  // Calculate 7-day rolling average for smoothing
  const weekAvg = recent.slice(-7);
  const currentAvg = weekAvg.reduce((s, w) => s + w.weight, 0) / weekAvg.length;

  const prevWeek = recent.slice(-14, -7);
  const prevAvg = prevWeek.length ? prevWeek.reduce((s, w) => s + w.weight, 0) / prevWeek.length : null;

  const weekChange = prevAvg ? currentAvg - prevAvg : null;

  return {
    totalChange: parseFloat(totalChange.toFixed(1)),
    weeklyRate: parseFloat(weeklyRate.toFixed(2)),
    currentAvg: parseFloat(currentAvg.toFixed(1)),
    prevAvg: prevAvg ? parseFloat(prevAvg.toFixed(1)) : null,
    weekChange: weekChange ? parseFloat(weekChange.toFixed(1)) : null,
    direction: totalChange < -0.2 ? 'losing' : totalChange > 0.2 ? 'gaining' : 'stable',
    entries: recent.length,
  };
}

// ── Smart Calorie Adjustment ──
export function suggestCalorieAdjustment(goal, weightTrend, currentCalories) {
  if (!weightTrend || !goal) return null;

  const { weeklyRate, direction } = weightTrend;
  const suggestions = [];

  if (goal === 'cut') {
    // Cutting: want to lose 0.5–1% body weight per week (~0.4–0.8 kg)
    if (direction === 'stable' || direction === 'gaining') {
      const deficit = Math.round(Math.max(100, Math.min(300, Math.abs(weeklyRate) * 500 + 100)));
      suggestions.push({
        type: 'calories',
        action: 'decrease',
        amount: deficit,
        reason: direction === 'gaining'
          ? `Weight is trending up (${weeklyRate > 0 ? '+' : ''}${weeklyRate} kg/week). Reduce calories to stay in deficit.`
          : `Weight has stalled. Reduce calories by ${deficit} kcal to restart fat loss.`,
        newTarget: currentCalories ? currentCalories - deficit : null,
        priority: direction === 'gaining' ? 'high' : 'medium',
      });
      // Also suggest steps increase
      suggestions.push({
        type: 'activity',
        action: 'increase',
        amount: 2000,
        reason: 'Add 2,000 extra steps/day as an alternative to cutting more calories.',
        priority: 'low',
      });
    } else if (weeklyRate < -1.0) {
      // Losing too fast — risk of muscle loss
      suggestions.push({
        type: 'calories',
        action: 'increase',
        amount: 150,
        reason: `Losing too fast (${weeklyRate} kg/week). Slow down to preserve muscle. Add ~150 kcal.`,
        newTarget: currentCalories ? currentCalories + 150 : null,
        priority: 'high',
      });
    }
  }

  if (goal === 'lean-bulk') {
    // Lean bulk: want to gain 0.2–0.4 kg/week
    if (direction === 'losing' || direction === 'stable') {
      const surplus = Math.round(Math.max(100, Math.min(300, Math.abs(weeklyRate) * 400 + 150)));
      suggestions.push({
        type: 'calories',
        action: 'increase',
        amount: surplus,
        reason: direction === 'losing'
          ? `Weight is trending down (${weeklyRate} kg/week). You need a bigger surplus.`
          : `Weight is stalling. Increase calories by ${surplus} kcal to support lean gains.`,
        newTarget: currentCalories ? currentCalories + surplus : null,
        priority: 'medium',
      });
    } else if (weeklyRate > 0.6) {
      // Gaining too fast — too much fat
      suggestions.push({
        type: 'calories',
        action: 'decrease',
        amount: 150,
        reason: `Gaining too fast (${weeklyRate} kg/week). Slow down to minimize fat gain. Cut ~150 kcal.`,
        newTarget: currentCalories ? currentCalories - 150 : null,
        priority: 'medium',
      });
    }
  }

  if (goal === 'recomp' || goal === 'maintenance') {
    // Maintenance: weight should stay stable
    if (Math.abs(weeklyRate) > 0.3) {
      const adjust = weeklyRate > 0 ? -100 : 100;
      suggestions.push({
        type: 'calories',
        action: weeklyRate > 0 ? 'decrease' : 'increase',
        amount: Math.abs(adjust),
        reason: `Weight is drifting ${weeklyRate > 0 ? 'up' : 'down'} (${weeklyRate > 0 ? '+' : ''}${weeklyRate} kg/week). Small adjustment to maintain.`,
        newTarget: currentCalories ? currentCalories + adjust : null,
        priority: 'low',
      });
    }
  }

  return suggestions.length ? suggestions : null;
}

// ── Weighted Adherence Score ──
// nutrition: 50%, workouts: 30%, daily checkins: 20%
export function calculateAdherence({ nutritionDays = 0, workoutDays = 0, checkinDays = 0, totalDays = 7 }) {
  if (totalDays === 0) return 0;
  const nutritionScore = Math.min(nutritionDays / totalDays, 1) * 50;
  const workoutScore = Math.min(workoutDays / totalDays, 1) * 30;
  const checkinScore = Math.min(checkinDays / totalDays, 1) * 20;
  return Math.round(nutritionScore + workoutScore + checkinScore);
}

// ── Generate Client Alerts for Coach ──
export function generateClientAlerts(client, weightLog) {
  const alerts = [];

  // Low adherence alert
  if (client.adherence != null && client.adherence < 50) {
    alerts.push({
      type: 'adherence',
      severity: 'high',
      icon: '⚠️',
      message: `Adherence dropped to ${client.adherence}%. Reach out for accountability.`,
    });
  }

  // Plateau alert
  const plateau = detectPlateau(weightLog);
  if (plateau?.detected) {
    alerts.push({
      type: 'plateau',
      severity: 'medium',
      icon: '📊',
      message: plateau.message,
    });
  }

  // No activity alert
  if (client.lastActive && client.lastActive !== 'Today' && client.lastActive !== 'Yesterday') {
    const daysMatch = client.lastActive.match(/(\d+)d ago/);
    if (daysMatch && parseInt(daysMatch[1]) >= 3) {
      alerts.push({
        type: 'inactive',
        severity: parseInt(daysMatch[1]) >= 5 ? 'high' : 'medium',
        icon: '🔕',
        message: `No activity for ${daysMatch[1]} days. Check in on them.`,
      });
    }
  }

  // Streak broken
  if (client.streak === 0) {
    alerts.push({
      type: 'streak',
      severity: 'low',
      icon: '💔',
      message: 'Streak broken. Encourage them to get back on track.',
    });
  }

  return alerts;
}

// ── Weekly Summary for Client ──
export function generateWeeklySummary({ weightLog, nutritionDays, workoutDays, checkinDays, stepAvg, stepGoal, goal }) {
  const trend = analyzeWeightTrend(weightLog, { days: 7 });
  const adherence = calculateAdherence({ nutritionDays, workoutDays, checkinDays, totalDays: 7 });

  const highlights = [];
  const improvements = [];

  // Weight feedback
  if (trend) {
    if (goal === 'cut' && trend.direction === 'losing') {
      highlights.push(`Down ${Math.abs(trend.totalChange)} kg this week — right on track!`);
    } else if (goal === 'lean-bulk' && trend.direction === 'gaining' && trend.weeklyRate <= 0.5) {
      highlights.push(`Up ${trend.totalChange} kg this week — clean gains!`);
    } else if (trend.direction === 'stable') {
      improvements.push('Weight hasn\'t moved this week. Review your intake.');
    }
  }

  // Adherence feedback
  if (adherence >= 80) {
    highlights.push(`${adherence}% adherence — outstanding consistency!`);
  } else if (adherence >= 60) {
    improvements.push(`Adherence at ${adherence}%. Small improvements make big differences.`);
  } else {
    improvements.push(`Adherence at ${adherence}%. Focus on logging meals and completing workouts.`);
  }

  // Steps
  if (stepAvg && stepGoal) {
    if (stepAvg >= stepGoal) {
      highlights.push(`Averaging ${Math.round(stepAvg).toLocaleString()} steps — crushing it!`);
    } else {
      const pct = Math.round((stepAvg / stepGoal) * 100);
      improvements.push(`Steps at ${pct}% of goal. Add a 15-min walk to hit target.`);
    }
  }

  // Nutrition
  if (nutritionDays >= 6) {
    highlights.push('Logged meals consistently — great discipline.');
  } else if (nutritionDays <= 3) {
    improvements.push('Only logged meals ' + nutritionDays + ' days. Consistency is key.');
  }

  return { highlights, improvements, adherence, trend };
}
