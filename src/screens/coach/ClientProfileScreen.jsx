import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCoachStore } from '../../stores/coachStore';
import { useAuthStore } from '../../stores/authStore';
import { Card, ProgressRing } from '../../components/ui';
import { Icon } from '../../utils/icons';
import { detectPlateau, analyzeWeightTrend, suggestCalorieAdjustment } from '../../utils/coachingInsights';

// Services — fetch all client data
import { fetchWeightLog, fetchMeasurements, fetchProgressPhotos } from '../../services/progress';
import { fetchDailyCheckins, fetchWeeklyCheckins, saveClientGoal } from '../../services/checkins';
import { fetchMealPlan, fetchNutritionLogHistory } from '../../services/nutrition';
import { fetchTrainingPlan, fetchWorkoutHistory } from '../../services/training';
import SupplementsPanel from '../../components/coach/SupplementsPanel';

// ── Helpers ──
function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function daysAgo(d) {
  if (!d) return null;
  const diff = Math.floor((Date.now() - new Date(d + 'T00:00:00').getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${diff}d ago`;
}

// ── Section: Header ──
function ProfileHeader({ client, onBack }) {
  const name = client.client_name || client.name || 'Client';
  const statusMap = {
    'on-track': { label: 'On Track', cls: 't-gr' },
    'attention': { label: 'Attention', cls: 't-or' },
    'at-risk': { label: 'At Risk', cls: 't-rd' },
  };
  const s = statusMap[client.status || 'on-track'] || statusMap['on-track'];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
      <button
        className="btn btn-secondary btn-sm"
        onClick={onBack}
        style={{ padding: '6px 10px', minWidth: 0 }}
      >
        <Icon name="chevron-left" size={16} />
      </button>
      <div style={{
        width: 48, height: 48, borderRadius: '50%', background: 'var(--gold-d)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--gold)', fontFamily: 'var(--fd)', fontSize: 20, fontWeight: 600, flexShrink: 0,
      }}>
        {name.charAt(0)}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: 0.5 }}>{name}</div>
        <div style={{ fontSize: 11, color: 'var(--t3)' }}>
          {client.goal || 'No goal set'}{client.start_date ? ` · Started ${formatDate(client.start_date)}` : ''}
        </div>
      </div>
      <span className={`tag ${s.cls}`}>{s.label}</span>
    </div>
  );
}

// ── Section: Key Metrics ──
function KeyMetrics({ weightLog, checkins, weeklyCheckins }) {
  const latestWeight = weightLog.length ? weightLog[weightLog.length - 1] : null;

  // Weight change over last 7 days
  const weightChange = useMemo(() => {
    if (weightLog.length < 2) return null;
    const recent = weightLog[weightLog.length - 1].weight;
    const weekAgoIdx = weightLog.findIndex(w => {
      const diff = (Date.now() - new Date(w.date + 'T00:00:00').getTime()) / 86400000;
      return diff <= 7;
    });
    if (weekAgoIdx < 0 || weekAgoIdx === weightLog.length - 1) return null;
    return (recent - weightLog[weekAgoIdx].weight).toFixed(1);
  }, [weightLog]);

  // Avg steps last 7 days
  const avgSteps = useMemo(() => {
    const recent = checkins.slice(0, 7).filter(c => c.steps > 0);
    if (!recent.length) return 0;
    return Math.round(recent.reduce((s, c) => s + (c.steps || 0), 0) / recent.length);
  }, [checkins]);

  // Avg water last 7 days
  const avgWater = useMemo(() => {
    const recent = checkins.slice(0, 7).filter(c => c.hydration > 0);
    if (!recent.length) return 0;
    return (recent.reduce((s, c) => s + (c.hydration || 0), 0) / recent.length).toFixed(1);
  }, [checkins]);

  // Streak
  const streak = useMemo(() => {
    let count = 0;
    const today = new Date().toISOString().slice(0, 10);
    const sorted = [...checkins].sort((a, b) => b.date.localeCompare(a.date));
    const d = new Date();
    d.setDate(d.getDate() - 1);
    for (let i = 0; i < 60; i++) {
      const key = d.toISOString().slice(0, 10);
      if (sorted.find(c => c.date === key)) { count++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return count;
  }, [checkins]);

  // Check-in completion (weekly)
  const checkinCount = weeklyCheckins?.length || 0;

  return (
    <div className="g4" style={{ marginBottom: 18 }}>
      <Card>
        <div className="kl">Weight</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, margin: '4px 0' }}>
          <span className="kv">{latestWeight ? latestWeight.weight : '—'}</span>
          {latestWeight && <span className="ku">kg</span>}
        </div>
        {weightChange !== null && (
          <div style={{ fontSize: 10, color: parseFloat(weightChange) <= 0 ? 'var(--green)' : 'var(--orange)' }}>
            {parseFloat(weightChange) > 0 ? '+' : ''}{weightChange} kg this week
          </div>
        )}
        {latestWeight && (
          <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 2 }}>
            Last: {daysAgo(latestWeight.date)}
          </div>
        )}
      </Card>
      <Card>
        <div className="kl">Avg Steps</div>
        <div className="kv" style={{ color: 'var(--green)', margin: '4px 0' }}>{avgSteps.toLocaleString()}</div>
        <div style={{ fontSize: 10, color: 'var(--t3)' }}>Last 7 days</div>
      </Card>
      <Card>
        <div className="kl">Avg Water</div>
        <div className="kv" style={{ color: 'var(--blue)', margin: '4px 0' }}>{avgWater}</div>
        <div style={{ fontSize: 10, color: 'var(--t3)' }}>L / day (7d)</div>
      </Card>
      <Card>
        <div className="kl">Streak</div>
        <div className="kv" style={{ color: 'var(--gold)', margin: '4px 0' }}>{streak}</div>
        <div style={{ fontSize: 10, color: 'var(--t3)' }}>
          {streak === 1 ? 'day' : 'days'} · {checkinCount} check-ins
        </div>
      </Card>
    </div>
  );
}

// ── Section: Weight Trend ──
function WeightTrend({ weightLog }) {
  if (weightLog.length < 2) {
    return (
      <Card title="Weight Trend">
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--t3)', fontSize: 12 }}>
          Not enough data to show a trend yet.
        </div>
      </Card>
    );
  }

  const last30 = weightLog.slice(-30);
  const weights = last30.map(w => w.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const chartH = 100;

  return (
    <Card title="Weight Trend" subtitle={`${last30.length} entries`}>
      <svg width="100%" height={chartH + 30} viewBox={`0 0 ${last30.length * 20} ${chartH + 30}`} style={{ overflow: 'visible' }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const y = chartH - pct * chartH + 10;
          return (
            <g key={pct}>
              <line x1={0} y1={y} x2={last30.length * 20} y2={y} stroke="var(--b3)" strokeWidth={0.5} />
              <text x={-4} y={y + 3} fontSize={8} fill="var(--t3)" textAnchor="end">
                {(min + pct * range).toFixed(1)}
              </text>
            </g>
          );
        })}
        {/* Line */}
        <polyline
          fill="none"
          stroke="var(--gold)"
          strokeWidth={2}
          points={last30.map((w, i) => {
            const x = i * 20 + 10;
            const y = chartH - ((w.weight - min) / range) * chartH + 10;
            return `${x},${y}`;
          }).join(' ')}
        />
        {/* Dots */}
        {last30.map((w, i) => {
          const x = i * 20 + 10;
          const y = chartH - ((w.weight - min) / range) * chartH + 10;
          return <circle key={i} cx={x} cy={y} r={3} fill="var(--gold)" />;
        })}
        {/* Date labels (first, middle, last) */}
        {[0, Math.floor(last30.length / 2), last30.length - 1].map(idx => (
          <text key={idx} x={idx * 20 + 10} y={chartH + 26} fontSize={8} fill="var(--t3)" textAnchor="middle">
            {formatDate(last30[idx].date).replace(/ \d{4}$/, '')}
          </text>
        ))}
      </svg>
    </Card>
  );
}

// ── Section: Nutrition Overview ──
function NutritionOverview({ nutritionHistory, mealPlan }) {
  const macroTargets = useMemo(() => {
    if (!mealPlan?.length) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    let kcal = 0, p = 0, c = 0, f = 0;
    mealPlan.forEach(m => m.foods.forEach(fd => { kcal += fd.kcal || 0; p += fd.p || 0; c += fd.c || 0; f += fd.f || 0; }));
    return { calories: Math.round(kcal), protein: Math.round(p), carbs: Math.round(c), fat: Math.round(f) };
  }, [mealPlan]);

  // Last 7 days averages
  const avgMacros = useMemo(() => {
    const recent = nutritionHistory.slice(0, 7);
    if (!recent.length) return null;
    const n = recent.length;
    return {
      kcal: Math.round(recent.reduce((s, r) => s + (r.total_kcal || 0), 0) / n),
      protein: Math.round(recent.reduce((s, r) => s + (r.total_protein || 0), 0) / n),
      carbs: Math.round(recent.reduce((s, r) => s + (r.total_carbs || 0), 0) / n),
      fat: Math.round(recent.reduce((s, r) => s + (r.total_fat || 0), 0) / n),
      adherence: Math.round(recent.reduce((s, r) => s + (r.meals_total > 0 ? r.meals_logged / r.meals_total : 0), 0) / n * 100),
    };
  }, [nutritionHistory]);

  if (!mealPlan?.length && !nutritionHistory.length) {
    return (
      <Card title="Nutrition">
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--t3)', fontSize: 12 }}>
          No meal plan or nutrition data yet.
        </div>
      </Card>
    );
  }

  return (
    <Card title="Nutrition" subtitle="7-day average">
      {macroTargets.calories > 0 && (
        <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 10 }}>
          Targets: {macroTargets.calories} kcal · {macroTargets.protein}P · {macroTargets.carbs}C · {macroTargets.fat}F
        </div>
      )}
      {avgMacros ? (
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
          {[
            { label: 'Calories', val: avgMacros.kcal, max: macroTargets.calories, unit: '', color: 'var(--gold)' },
            { label: 'Protein', val: avgMacros.protein, max: macroTargets.protein, unit: 'g', color: 'var(--green)' },
            { label: 'Carbs', val: avgMacros.carbs, max: macroTargets.carbs, unit: 'g', color: 'var(--blue)' },
            { label: 'Fat', val: avgMacros.fat, max: macroTargets.fat, unit: 'g', color: 'var(--orange)' },
          ].map(m => (
            <div key={m.label} style={{ textAlign: 'center' }}>
              <ProgressRing value={m.val} max={m.max || 1} size={52} stroke={4} color={m.color}>
                <span style={{ fontSize: 10, fontWeight: 600 }}>{m.max ? Math.round(m.val / m.max * 100) : 0}%</span>
              </ProgressRing>
              <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 4, fontFamily: 'var(--fd)' }}>
                {m.val}{m.unit}
              </div>
              <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1 }}>
                {m.label}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 10, color: 'var(--t3)', fontSize: 12 }}>
          No nutrition logs yet.
        </div>
      )}
      {avgMacros && (
        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: 'var(--t3)' }}>
          Meal adherence: <span style={{ color: avgMacros.adherence >= 80 ? 'var(--green)' : avgMacros.adherence >= 50 ? 'var(--orange)' : 'var(--red)', fontWeight: 600 }}>
            {avgMacros.adherence}%
          </span>
        </div>
      )}
    </Card>
  );
}

// ── Section: Training Summary ──
function TrainingSummary({ trainingPlan, workoutHistory }) {
  const recentSessions = useMemo(() => {
    if (!workoutHistory) return [];
    const all = [];
    Object.entries(workoutHistory).forEach(([dayIdx, sessions]) => {
      sessions.forEach(s => all.push({ ...s, dayIdx: parseInt(dayIdx) }));
    });
    return all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  }, [workoutHistory]);

  return (
    <Card title="Training" subtitle={trainingPlan?.name || 'No plan'}>
      {trainingPlan?.days?.length ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 8 }}>
            {trainingPlan.days.length}-day split
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {trainingPlan.days.map((day, i) => (
              <span key={i} className="tag" style={{ fontSize: 10, padding: '3px 8px' }}>
                {day.name} ({day.exercises?.length || 0})
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>No training plan assigned.</div>
      )}

      {recentSessions.length > 0 && (
        <>
          <div className="kl" style={{ marginTop: 10, marginBottom: 6 }}>Recent Sessions</div>
          {recentSessions.map((s, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 0', borderBottom: i < recentSessions.length - 1 ? '1px solid var(--b2)' : 'none',
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{s.day_name || `Day ${s.dayIdx + 1}`}</div>
                <div style={{ fontSize: 10, color: 'var(--t3)' }}>{formatDate(s.date)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontFamily: 'var(--fd)', color: 'var(--gold)' }}>
                  {(s.volume || 0).toLocaleString()} kg
                </div>
                <div style={{ fontSize: 9, color: 'var(--t3)' }}>volume</div>
              </div>
            </div>
          ))}
        </>
      )}
      {recentSessions.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 6 }}>No workout sessions logged yet.</div>
      )}
    </Card>
  );
}

// ── Section: Weekly Check-ins ──
function WeeklyCheckinsSection({ checkins }) {
  const recent = (checkins || []).slice(-4).reverse();

  if (!recent.length) {
    return (
      <Card title="Weekly Check-ins">
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--t3)', fontSize: 12 }}>
          No weekly check-ins submitted yet.
        </div>
      </Card>
    );
  }

  return (
    <Card title="Weekly Check-ins" subtitle={`${checkins.length} total`}>
      {recent.map((ci, i) => (
        <div key={ci.id || i} style={{
          padding: '10px 0',
          borderBottom: i < recent.length - 1 ? '1px solid var(--b2)' : 'none',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Week {ci.week_number}</span>
            <span style={{ fontSize: 10, color: ci.coach_feedback ? 'var(--green)' : 'var(--orange)' }}>
              {ci.coach_feedback ? 'Reviewed' : 'Pending'}
            </span>
          </div>
          {ci.energy_level && (
            <div style={{ fontSize: 11, color: 'var(--t3)' }}>
              Energy: {ci.energy_level}/10 · Sleep: {ci.sleep_quality || '—'}/10 · Stress: {ci.stress_level || '—'}/10
            </div>
          )}
          {ci.notes && (
            <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 4, lineHeight: 1.4 }}>
              "{ci.notes.slice(0, 150)}{ci.notes.length > 150 ? '...' : ''}"
            </div>
          )}
          {ci.coach_feedback && (
            <div style={{
              fontSize: 11, color: 'var(--gold)', marginTop: 6, padding: '6px 8px',
              background: 'var(--gold-d)', borderRadius: 6, lineHeight: 1.4,
            }}>
              Coach: {ci.coach_feedback.slice(0, 150)}{ci.coach_feedback.length > 150 ? '...' : ''}
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}

// ── Section: Measurements ──
function MeasurementsSection({ measurements }) {
  if (!measurements?.length) {
    return (
      <Card title="Measurements">
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--t3)', fontSize: 12 }}>
          No measurements recorded yet.
        </div>
      </Card>
    );
  }

  const latest = measurements[measurements.length - 1];
  const prev = measurements.length > 1 ? measurements[measurements.length - 2] : null;

  const fields = [
    { label: 'Waist', key: 'waist', unit: 'cm' },
    { label: 'Chest', key: 'chest', unit: 'cm' },
    { label: 'Arms', key: 'arms', unit: 'cm' },
    { label: 'Thighs', key: 'thighs', unit: 'cm' },
  ];

  return (
    <Card title="Measurements" subtitle={`Last: ${formatDate(latest.date)}`}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {fields.map(f => {
          const val = latest[f.key];
          const prevVal = prev?.[f.key];
          const diff = val && prevVal ? (val - prevVal).toFixed(1) : null;
          return (
            <div key={f.key} style={{ flex: '1 1 80px', minWidth: 80 }}>
              <div className="kl">{f.label}</div>
              <div style={{ fontSize: 16, fontFamily: 'var(--fd)', margin: '2px 0' }}>
                {val || '—'}<span style={{ fontSize: 10, color: 'var(--t3)' }}>{val ? f.unit : ''}</span>
              </div>
              {diff && (
                <div style={{ fontSize: 10, color: parseFloat(diff) <= 0 ? 'var(--green)' : 'var(--orange)' }}>
                  {parseFloat(diff) > 0 ? '+' : ''}{diff}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Section: Progress Photos ──
function ProgressPhotosSection({ photos }) {
  // photos is now an array: [{ pose, url, date }, ...]
  const photoArr = Array.isArray(photos) ? photos : [];

  if (photoArr.length === 0) {
    return (
      <Card title="Progress Photos">
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--t3)', fontSize: 12 }}>
          No progress photos uploaded yet.
        </div>
      </Card>
    );
  }

  // Group by week (using monday key)
  const weekGroups = useMemo(() => {
    const groups = {};
    photoArr.forEach(p => {
      if (!p.date) return;
      const d = new Date(p.date + 'T12:00:00');
      const day = d.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const monday = new Date(d);
      monday.setDate(d.getDate() + mondayOffset);
      const key = monday.toISOString().slice(0, 10);
      if (!groups[key]) groups[key] = {};
      groups[key][p.pose] = p;
    });
    // Sort weeks newest first
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [photoArr]);

  const poses = ['front', 'side', 'back'];

  return (
    <Card title="Progress Photos" subtitle={`${weekGroups.length} week${weekGroups.length !== 1 ? 's' : ''}`}>
      {weekGroups.map(([weekKey, poseMap]) => {
        const monday = new Date(weekKey + 'T12:00:00');
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const label = `${monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — ${sunday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
        return (
          <div key={weekKey} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
              {label}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              {poses.map(pose => {
                const p = poseMap[pose];
                if (!p) return (
                  <div key={pose} style={{
                    width: 100, height: 140, background: 'var(--b2)', borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: 'var(--t3)', textTransform: 'capitalize',
                  }}>
                    {pose}
                  </div>
                );
                return (
                  <div key={pose} style={{ textAlign: 'center' }}>
                    <img
                      src={p.url}
                      alt={pose}
                      style={{ width: 100, height: 140, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--b2)' }}
                    />
                    <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 4, textTransform: 'capitalize' }}>
                      {pose}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </Card>
  );
}

// ── Section: Coaching Intelligence ──
function CoachingIntelligence({ weightLog, goalId, mealPlan }) {
  const trend = useMemo(() => analyzeWeightTrend(weightLog, { days: 21 }), [weightLog]);
  const plateau = useMemo(() => detectPlateau(weightLog), [weightLog]);

  // Estimate current calories from meal plan
  const currentCalories = useMemo(() => {
    if (!mealPlan?.length) return null;
    let kcal = 0;
    mealPlan.forEach(m => (m.foods || []).forEach(f => { kcal += f.kcal || 0; }));
    return Math.round(kcal);
  }, [mealPlan]);

  const suggestions = useMemo(() =>
    suggestCalorieAdjustment(goalId, trend, currentCalories),
    [goalId, trend, currentCalories]
  );

  if (!trend && !plateau?.detected) return null;

  return (
    <Card title="Coaching Intelligence" subtitle="AI-powered suggestions">
      {/* Weight trend */}
      {trend && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1 }}>Weight Trend</span>
            <span style={{
              fontSize: 12, fontWeight: 600, fontFamily: 'var(--fd)',
              color: trend.direction === 'losing' ? 'var(--green)' : trend.direction === 'gaining' ? 'var(--orange)' : 'var(--t2)',
            }}>
              {trend.weeklyRate > 0 ? '+' : ''}{trend.weeklyRate} kg/wk
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--t2)' }}>
            Current avg: {trend.currentAvg} kg
            {trend.prevAvg ? ` (prev week: ${trend.prevAvg} kg)` : ''}
            {' · '}{trend.entries} entries
          </div>
        </div>
      )}

      {/* Plateau warning */}
      {plateau?.detected && (
        <div style={{
          fontSize: 11, color: 'var(--orange)', background: 'rgba(255,165,0,.08)',
          padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,165,0,.15)',
          marginBottom: 12, lineHeight: 1.4,
        }}>
          📊 <strong>Plateau detected</strong> — Weight stable at ~{plateau.avgWeight} kg for {plateau.days} entries.
        </div>
      )}

      {/* Smart suggestions */}
      {suggestions && suggestions.map((s, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px',
          background: s.priority === 'high' ? 'rgba(255,59,48,.06)' : 'rgba(200,169,110,.06)',
          borderRadius: 8, marginBottom: 6,
          border: `1px solid ${s.priority === 'high' ? 'rgba(255,59,48,.12)' : 'rgba(200,169,110,.12)'}`,
        }}>
          <span style={{ fontSize: 14, marginTop: 1 }}>{s.type === 'calories' ? '🔥' : '🚶'}</span>
          <div>
            <div style={{ fontSize: 11, color: 'var(--t1)', lineHeight: 1.4 }}>{s.reason}</div>
            {s.newTarget && (
              <div style={{ fontSize: 10, color: 'var(--gold)', fontWeight: 600, marginTop: 3 }}>
                Suggested target: {s.newTarget} kcal/day
              </div>
            )}
          </div>
        </div>
      ))}

      {!suggestions && !plateau?.detected && trend && (
        <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 4 }}>
          ✓ Progress looks good. No adjustments needed.
        </div>
      )}
    </Card>
  );
}

// ── Section: Goal Selector (Coach) ──
const GOALS = [
  { id: 'cut',       label: 'Cut',           icon: '🔥' },
  { id: 'lean-bulk', label: 'Lean Bulk',      icon: '💪' },
  { id: 'recomp',    label: 'Body Recomp',    icon: '⚖️' },
  { id: 'maintenance',label: 'Maintenance',   icon: '🛡️' },
  { id: 'comp-prep', label: 'Comp Prep',      icon: '🏆' },
];

function CoachGoalSelector({ clientId, currentGoal, onGoalChange }) {
  const [saving, setSaving] = useState(false);

  const handleSelect = async (goalId) => {
    if (goalId === currentGoal || saving) return;
    setSaving(true);
    const ok = await saveClientGoal(clientId, goalId);
    setSaving(false);
    if (ok && onGoalChange) onGoalChange(goalId);
  };

  return (
    <Card title="Training Goal">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {GOALS.map(g => {
          const isActive = currentGoal === g.id;
          return (
            <button
              key={g.id}
              className={`chip ${isActive ? 'active' : ''}`}
              disabled={saving}
              onClick={() => handleSelect(g.id)}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                opacity: saving ? 0.6 : 1,
              }}
            >
              {g.icon} {g.label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// ── Section: Quick Actions ──
function QuickActions({ clientId, clientName, navigate }) {
  return (
    <Card title="Quick Actions">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/coach/workout-builder')}>
          <Icon name="dumbbell" size={12} /> Edit Workout
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/coach/nutrition-editor')}>
          <Icon name="utensils" size={12} /> Edit Nutrition
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/coach/chat')}>
          <Icon name="message" size={12} /> Message
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/coach/checkins')}>
          <Icon name="clipboard" size={12} /> Check-ins
        </button>
      </div>
    </Card>
  );
}

// ── Main Screen ──
export default function ClientProfileScreen() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { clients } = useCoachStore();
  const { user } = useAuthStore();

  const client = clients.find(c => (c.client_id || c.id) === clientId) || {};
  const [clientGoal, setClientGoal] = useState(client.goalId || client.goal || '');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    weightLog: [],
    measurements: [],
    photos: null,
    dailyCheckins: [],
    weeklyCheckins: [],
    mealPlan: null,
    nutritionHistory: [],
    trainingPlan: null,
    workoutHistory: {},
  });

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [weightLog, measurements, photos, dailyCheckins, weeklyCheckins, mealPlan, nutritionHistory, trainingPlan, workoutHistory] = await Promise.allSettled([
        fetchWeightLog(clientId),
        fetchMeasurements(clientId),
        fetchProgressPhotos(clientId),
        fetchDailyCheckins(clientId, 30),
        fetchWeeklyCheckins(clientId),
        fetchMealPlan(clientId),
        fetchNutritionLogHistory(clientId, 30),
        fetchTrainingPlan(clientId),
        fetchWorkoutHistory(clientId),
      ]);

      if (cancelled) return;
      setData({
        weightLog: weightLog.status === 'fulfilled' ? weightLog.value : [],
        measurements: measurements.status === 'fulfilled' ? measurements.value : [],
        photos: photos.status === 'fulfilled' ? photos.value : null,
        dailyCheckins: dailyCheckins.status === 'fulfilled' ? dailyCheckins.value : [],
        weeklyCheckins: weeklyCheckins.status === 'fulfilled' ? weeklyCheckins.value : [],
        mealPlan: mealPlan.status === 'fulfilled' ? mealPlan.value : null,
        nutritionHistory: nutritionHistory.status === 'fulfilled' ? nutritionHistory.value : [],
        trainingPlan: trainingPlan.status === 'fulfilled' ? trainingPlan.value : null,
        workoutHistory: workoutHistory.status === 'fulfilled' ? workoutHistory.value : {},
      });
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [clientId]);

  if (loading) {
    return (
      <div className="screen active">
        <ProfileHeader client={client} onBack={() => navigate('/coach/clients')} />
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--t3)' }}>
          <div style={{ fontSize: 14 }}>Loading client data...</div>
        </div>
      </div>
    );
  }

  const clientName = client.client_name || client.name || 'Client';

  return (
    <div className="screen active">
      <ProfileHeader client={client} onBack={() => navigate('/coach/clients')} />

      {/* Key metrics */}
      <KeyMetrics
        weightLog={data.weightLog}
        checkins={data.dailyCheckins}
        weeklyCheckins={data.weeklyCheckins}
      />

      {/* Two-column layout */}
      <div className="g7030">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <WeightTrend weightLog={data.weightLog} />
          <NutritionOverview nutritionHistory={data.nutritionHistory} mealPlan={data.mealPlan} />
          <WeeklyCheckinsSection checkins={data.weeklyCheckins} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <CoachingIntelligence weightLog={data.weightLog} goalId={clientGoal} mealPlan={data.mealPlan} />
          <QuickActions clientId={clientId} clientName={clientName} navigate={navigate} />
          <SupplementsPanel clientId={clientId} coachId={user?.id} />
          <CoachGoalSelector clientId={clientId} currentGoal={clientGoal} onGoalChange={setClientGoal} />
          <TrainingSummary trainingPlan={data.trainingPlan} workoutHistory={data.workoutHistory} />
          <MeasurementsSection measurements={data.measurements} />
          <ProgressPhotosSection photos={data.photos} />
        </div>
      </div>
    </div>
  );
}
