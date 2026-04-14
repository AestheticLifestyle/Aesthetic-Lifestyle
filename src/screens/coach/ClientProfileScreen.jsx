import { useState, useEffect, useMemo, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCoachStore } from '../../stores/coachStore';
import { useAuthStore } from '../../stores/authStore';
import { Card, ProgressRing } from '../../components/ui';
import { Icon } from '../../utils/icons';
import { useUIStore } from '../../stores/uiStore';
import { detectPlateau, analyzeWeightTrend, suggestCalorieAdjustment } from '../../utils/coachingInsights';
import { updateClientSettings, archiveClient, GOAL_LABELS } from '../../services/chat';

// Services — fetch all client data
import { fetchWeightLog, fetchMeasurements, fetchProgressPhotos } from '../../services/progress';
import { fetchDailyCheckins, fetchWeeklyCheckins, saveClientGoal } from '../../services/checkins';
import { fetchMealPlan, fetchNutritionLogHistory, updateClientMacroTargets } from '../../services/nutrition';
import { fetchTrainingPlan, fetchWorkoutHistory } from '../../services/training';
import { supabase } from '../../services/supabase';
import SupplementsPanel from '../../components/coach/SupplementsPanel';
import ReminderSettings from '../../components/coach/ReminderSettings';

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
function ProfileHeader({ client, onBack, onManage }) {
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
      {onManage && (
        <button className="icon-btn" onClick={onManage} title="Client Settings" style={{ marginLeft: 4 }}>
          <Icon name="settings" size={16} />
        </button>
      )}
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

// ── Section: Nutrition Overview with Macro Adjust ──
function NutritionOverview({ nutritionHistory, mealPlan, clientId, coachId }) {
  const [adjusting, setAdjusting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ calories: '', protein: '', carbs: '', fat: '' });
  const { showToast } = useUIStore();

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

  const handleOpenAdjust = () => {
    setForm({
      calories: String(macroTargets.calories || 2400),
      protein: String(macroTargets.protein || 180),
      carbs: String(macroTargets.carbs || 260),
      fat: String(macroTargets.fat || 70),
    });
    setAdjusting(true);
  };

  const handleSaveMacros = async () => {
    const targets = {
      calories: parseInt(form.calories) || 0,
      protein: parseInt(form.protein) || 0,
      carbs: parseInt(form.carbs) || 0,
      fat: parseInt(form.fat) || 0,
    };
    if (targets.calories < 800 || targets.protein < 20) {
      showToast('Please enter realistic targets', 'error');
      return;
    }
    setSaving(true);
    const ok = await updateClientMacroTargets(clientId, coachId, targets);
    setSaving(false);
    if (ok) {
      showToast('Macro targets updated — client will see new targets', 'success');
      setAdjusting(false);
    } else {
      showToast('Failed to update targets', 'error');
    }
  };

  if (!mealPlan?.length && !nutritionHistory.length) {
    return (
      <Card title="Nutrition">
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--t3)', fontSize: 12 }}>
          No meal plan or nutrition data yet.
        </div>
        {clientId && (
          <button className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={handleOpenAdjust}>
            <Icon name="edit" size={10} /> Set Macro Targets
          </button>
        )}
        {adjusting && (
          <MacroAdjustForm form={form} setForm={setForm} saving={saving} onSave={handleSaveMacros} onCancel={() => setAdjusting(false)} />
        )}
      </Card>
    );
  }

  return (
    <Card title="Nutrition" subtitle="7-day average">
      {macroTargets.calories > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--t3)' }}>
            Targets: {macroTargets.calories} kcal · {macroTargets.protein}P · {macroTargets.carbs}C · {macroTargets.fat}F
          </div>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '2px 8px' }} onClick={handleOpenAdjust}>
            <Icon name="edit" size={9} /> Adjust
          </button>
        </div>
      )}
      {!macroTargets.calories && clientId && (
        <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, marginBottom: 8 }} onClick={handleOpenAdjust}>
          <Icon name="edit" size={9} /> Set Targets
        </button>
      )}
      {adjusting && (
        <MacroAdjustForm form={form} setForm={setForm} saving={saving} onSave={handleSaveMacros} onCancel={() => setAdjusting(false)} />
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

// ── Inline Macro Adjust Form ──
function MacroAdjustForm({ form, setForm, saving, onSave, onCancel }) {
  const fields = [
    { key: 'calories', label: 'Calories', unit: 'kcal', color: 'var(--gold)' },
    { key: 'protein', label: 'Protein', unit: 'g', color: 'var(--green)' },
    { key: 'carbs', label: 'Carbs', unit: 'g', color: 'var(--blue)' },
    { key: 'fat', label: 'Fat', unit: 'g', color: 'var(--orange)' },
  ];

  return (
    <div style={{ padding: 12, background: 'var(--c2)', borderRadius: 10, marginBottom: 12, border: '1px solid var(--gold-d, var(--border))' }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: 'var(--gold)' }}>
        <Icon name="edit" size={11} /> Adjust Macro Targets
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {fields.map(f => (
          <div key={f.key}>
            <label style={{ fontSize: 10, color: f.color, fontWeight: 500, display: 'block', marginBottom: 3 }}>{f.label} ({f.unit})</label>
            <input
              className="form-inp"
              type="number"
              value={form[f.key]}
              onChange={e => setForm({ ...form, [f.key]: e.target.value })}
              style={{ width: '100%' }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button className="btn btn-primary btn-sm" onClick={onSave} disabled={saving} style={{ flex: 1 }}>
          {saving ? 'Saving...' : 'Push to Client'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
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

// ── Section: Weekly Snapshot Card (This Week vs Last Week) ──
function WeeklySnapshotCard({ dailyCheckins, nutritionHistory, workoutHistory, weightLog }) {
  const snapshot = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay() || 7; // Mon=1..Sun=7
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - dayOfWeek + 1);
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);

    const thisWeekKey = thisMonday.toISOString().slice(0, 10);
    const lastWeekKey = lastMonday.toISOString().slice(0, 10);
    const lastWeekEnd = new Date(thisMonday);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
    const lastWeekEndKey = lastWeekEnd.toISOString().slice(0, 10);

    function weekData(checkins, nutri, startKey, endKey) {
      const dc = checkins.filter(c => c.date >= startKey && c.date <= endKey);
      const nh = nutri.filter(n => n.date >= startKey && n.date <= endKey);
      const stepsArr = dc.filter(c => c.steps > 0).map(c => c.steps);
      const sleepArr = dc.filter(c => c.sleep_hours > 0).map(c => c.sleep_hours);
      const sleepQArr = dc.filter(c => c.sleep_quality > 0).map(c => c.sleep_quality);
      const kcalArr = nh.filter(n => n.total_kcal > 0).map(n => n.total_kcal);
      const proteinArr = nh.filter(n => n.total_protein > 0).map(n => n.total_protein);

      return {
        avgCalories: kcalArr.length ? Math.round(kcalArr.reduce((s, v) => s + v, 0) / kcalArr.length) : 0,
        avgProtein: proteinArr.length ? Math.round(proteinArr.reduce((s, v) => s + v, 0) / proteinArr.length) : 0,
        avgSteps: stepsArr.length ? Math.round(stepsArr.reduce((s, v) => s + v, 0) / stepsArr.length) : 0,
        avgSleep: sleepQArr.length ? (sleepQArr.reduce((s, v) => s + v, 0) / sleepQArr.length).toFixed(1) : '—',
        checkinsCount: dc.length,
      };
    }

    // Count workouts this/last week
    function countWorkouts(startKey, endKey) {
      let count = 0;
      if (workoutHistory) {
        Object.values(workoutHistory).forEach(sessions => {
          sessions.forEach(s => {
            if (s.date >= startKey && s.date <= endKey) count++;
          });
        });
      }
      return count;
    }

    // Weight change
    function weightChange(startKey, endKey) {
      const wl = weightLog.filter(w => w.date >= startKey && w.date <= endKey);
      if (wl.length < 2) return null;
      return (wl[wl.length - 1].weight - wl[0].weight).toFixed(1);
    }

    const todayKey = today.toISOString().slice(0, 10);
    const tw = weekData(dailyCheckins, nutritionHistory, thisWeekKey, todayKey);
    const lw = weekData(dailyCheckins, nutritionHistory, lastWeekKey, lastWeekEndKey);
    tw.workouts = countWorkouts(thisWeekKey, todayKey);
    lw.workouts = countWorkouts(lastWeekKey, lastWeekEndKey);
    tw.weightDelta = weightChange(thisWeekKey, todayKey);
    lw.weightDelta = weightChange(lastWeekKey, lastWeekEndKey);

    return { thisWeek: tw, lastWeek: lw };
  }, [dailyCheckins, nutritionHistory, workoutHistory, weightLog]);

  function CompareRow({ label, thisVal, lastVal, unit, lowerIsBetter }) {
    const diff = thisVal && lastVal ? thisVal - lastVal : null;
    const diffColor = diff === null ? 'var(--t3)'
      : (lowerIsBetter ? diff <= 0 : diff >= 0) ? 'var(--green)' : 'var(--orange)';
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--b2)' }}>
        <span style={{ fontSize: 11, color: 'var(--t3)', width: 90 }}>{label}</span>
        <span style={{ fontSize: 12, fontFamily: 'var(--fd)', color: 'var(--t2)', width: 70, textAlign: 'center' }}>
          {lastVal || '—'}{unit && lastVal ? unit : ''}
        </span>
        <span style={{ fontSize: 12, fontFamily: 'var(--fd)', fontWeight: 600, width: 70, textAlign: 'center' }}>
          {thisVal || '—'}{unit && thisVal ? unit : ''}
        </span>
        <span style={{ fontSize: 10, fontFamily: 'var(--fd)', color: diffColor, width: 50, textAlign: 'right' }}>
          {diff !== null ? `${diff > 0 ? '+' : ''}${typeof diff === 'number' ? diff.toLocaleString() : diff}` : '—'}
        </span>
      </div>
    );
  }

  return (
    <Card title="Weekly Snapshot" subtitle="This week vs last week">
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 0 6px', borderBottom: '2px solid var(--b3)', marginBottom: 2 }}>
        <span style={{ fontSize: 10, color: 'var(--t3)', width: 90 }}></span>
        <span style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1, width: 70, textAlign: 'center' }}>Last Wk</span>
        <span style={{ fontSize: 9, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 1, width: 70, textAlign: 'center' }}>This Wk</span>
        <span style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1, width: 50, textAlign: 'right' }}>Δ</span>
      </div>
      <CompareRow label="Avg Calories" thisVal={snapshot.thisWeek.avgCalories} lastVal={snapshot.lastWeek.avgCalories} unit="" />
      <CompareRow label="Avg Protein" thisVal={snapshot.thisWeek.avgProtein} lastVal={snapshot.lastWeek.avgProtein} unit="g" />
      <CompareRow label="Avg Steps" thisVal={snapshot.thisWeek.avgSteps} lastVal={snapshot.lastWeek.avgSteps} unit="" />
      <CompareRow label="Sleep Quality" thisVal={snapshot.thisWeek.avgSleep} lastVal={snapshot.lastWeek.avgSleep} unit="/10" />
      <CompareRow label="Workouts" thisVal={snapshot.thisWeek.workouts} lastVal={snapshot.lastWeek.workouts} unit="" />
      {(snapshot.thisWeek.weightDelta || snapshot.lastWeek.weightDelta) && (
        <CompareRow label="Weight Δ" thisVal={snapshot.thisWeek.weightDelta} lastVal={snapshot.lastWeek.weightDelta} unit=" kg" lowerIsBetter />
      )}
    </Card>
  );
}

// ── Section: Daily Check-in Heatmap (14 days) ──
function DailyCheckinHeatmap({ checkins }) {
  const days = useMemo(() => {
    const result = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const checkin = checkins.find(c => c.date === key);
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0);
      const dateLabel = d.getDate();
      result.push({ key, checkin, dayLabel, dateLabel, isToday: i === 0 });
    }
    return result;
  }, [checkins]);

  function statusColor(c) {
    if (!c) return 'var(--b2)';
    // Score completeness: steps + meals + any daily field
    let score = 0;
    if (c.steps > 0) score++;
    if (c.hydration > 0) score++;
    if (c.sleep_quality > 0) score++;
    if (c.energy_level > 0) score++;
    if (c.meals_logged > 0) score++;
    if (score >= 4) return 'var(--green)';
    if (score >= 2) return 'var(--gold)';
    return 'var(--orange)';
  }

  const completed = days.filter(d => d.checkin).length;

  return (
    <Card title="Daily Check-ins" subtitle={`${completed}/14 days logged`}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14, 1fr)', gap: 4, marginBottom: 8 }}>
        {days.map(d => (
          <div key={d.key} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: 'var(--t3)', marginBottom: 2 }}>{d.dayLabel}</div>
            <div style={{
              width: '100%', aspectRatio: '1', borderRadius: 6,
              background: statusColor(d.checkin),
              opacity: d.checkin ? 1 : 0.3,
              border: d.isToday ? '2px solid var(--gold)' : '1px solid transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, color: d.checkin ? '#fff' : 'var(--t3)', fontWeight: 600,
            }}>
              {d.dateLabel}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', fontSize: 9, color: 'var(--t3)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--green)', display: 'inline-block' }} /> Complete
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--gold)', display: 'inline-block' }} /> Partial
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--orange)', display: 'inline-block' }} /> Minimal
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--b2)', opacity: 0.3, display: 'inline-block' }} /> Missed
        </span>
      </div>
    </Card>
  );
}

// ── Section: Adherence Timeline (14 days) ──
function AdherenceTimeline({ dailyCheckins, nutritionHistory, workoutHistory }) {
  const timeline = useMemo(() => {
    const result = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });

      // Food logged?
      const nutri = nutritionHistory.find(n => n.date === key);
      const foodLogged = nutri && nutri.meals_logged > 0;

      // Trained?
      let trained = false;
      if (workoutHistory) {
        Object.values(workoutHistory).forEach(sessions => {
          if (sessions.some(s => s.date === key)) trained = true;
        });
      }

      // Steps on target? (>= 8000 as default target)
      const checkin = dailyCheckins.find(c => c.date === key);
      const stepsHit = checkin && checkin.steps >= 8000;

      result.push({ key, dayLabel, foodLogged, trained, stepsHit, isToday: i === 0 });
    }
    return result;
  }, [dailyCheckins, nutritionHistory, workoutHistory]);

  const indicators = [
    { key: 'foodLogged', label: 'Food', emoji: '🍽️', color: 'var(--green)' },
    { key: 'trained', label: 'Training', emoji: '💪', color: 'var(--blue)' },
    { key: 'stepsHit', label: 'Steps', emoji: '🚶', color: 'var(--gold)' },
  ];

  return (
    <Card title="Adherence Timeline" subtitle="14-day overview">
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(14, 1fr)`, gap: 2, minWidth: 400 }}>
          {/* Header row: dates */}
          <div />
          {timeline.map(d => (
            <div key={d.key} style={{
              textAlign: 'center', fontSize: 8, color: d.isToday ? 'var(--gold)' : 'var(--t3)',
              fontWeight: d.isToday ? 700 : 400, paddingBottom: 4,
            }}>
              {d.dayLabel.slice(0, 2)}
            </div>
          ))}

          {/* Rows per indicator */}
          {indicators.map(ind => (
            <Fragment key={ind.key}>
              <div style={{ fontSize: 10, color: 'var(--t3)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 11 }}>{ind.emoji}</span>{ind.label}
              </div>
              {timeline.map(d => (
                <div key={d.key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: 20, borderRadius: 4,
                  background: d[ind.key] ? ind.color : 'var(--b2)',
                  opacity: d[ind.key] ? 0.85 : 0.2,
                }} />
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ── Section: Full Weekly Check-ins (Last 2 Weeks — ALL fields) ──
function FullWeeklyCheckins({ checkins }) {
  const [expandedId, setExpandedId] = useState(null);
  const recent = (checkins || []).slice(-2).reverse();

  if (!recent.length) {
    return (
      <Card title="Weekly Check-ins">
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--t3)', fontSize: 12 }}>
          No weekly check-ins submitted yet.
        </div>
      </Card>
    );
  }

  const moodColors = {
    'Great Week': 'var(--green)', 'Good Week': '#66bb6a', 'Average': 'var(--gold)',
    'Tough Week': 'var(--orange)', 'Terrible Week': 'var(--red)',
  };
  const moodEmojis = {
    'Great Week': '🔥', 'Good Week': '😊', 'Average': '😐',
    'Tough Week': '😓', 'Terrible Week': '😞',
  };
  const stepsLabels = { 'Every Day': { color: 'var(--green)', icon: '✅' }, 'Most Days': { color: 'var(--gold)', icon: '👍' }, 'Some Days': { color: 'var(--orange)', icon: '⚠️' }, 'Rarely': { color: 'var(--red)', icon: '❌' } };
  const painLabels = { 'no': { text: 'No Pain', color: 'var(--green)' }, 'yes-minor': { text: 'Minor Pain', color: 'var(--orange)' }, 'yes-major': { text: 'Major Pain', color: 'var(--red)' } };

  function MetricBar({ label, value, max = 10, color, invertColor }) {
    const pct = Math.min(100, (value / max) * 100);
    const barColor = color || (invertColor
      ? (value <= 3 ? 'var(--green)' : value <= 6 ? 'var(--gold)' : 'var(--red)')
      : (value >= 7 ? 'var(--green)' : value >= 4 ? 'var(--gold)' : 'var(--red)'));
    return (
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 11, color: 'var(--t3)' }}>{label}</span>
          <span style={{ fontSize: 11, fontFamily: 'var(--fd)', fontWeight: 600, color: barColor }}>{value}/{max}</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'var(--b2)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: barColor, transition: 'width .3s' }} />
        </div>
      </div>
    );
  }

  function SectionLabel({ children }) {
    return (
      <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, marginTop: 14, borderBottom: '1px solid var(--b2)', paddingBottom: 4 }}>
        {children}
      </div>
    );
  }

  return (
    <Card title="Weekly Check-ins" subtitle="Last 2 weeks — full detail">
      {recent.map((ci, i) => {
        const isExpanded = expandedId === (ci.id || i);
        return (
          <div key={ci.id || i} style={{
            marginBottom: i < recent.length - 1 ? 12 : 0,
            border: '1px solid var(--b2)', borderRadius: 10,
            overflow: 'hidden',
          }}>
            {/* Header — always visible */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : (ci.id || i))}
              style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 12px', background: 'var(--b1)', border: 'none', cursor: 'pointer', color: 'inherit',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Week {ci.week_number}</span>
                {ci.mood && <span style={{ fontSize: 12 }}>{moodEmojis[ci.mood] || ''}</span>}
                <span style={{ fontSize: 10, color: ci.coach_feedback ? 'var(--green)' : 'var(--orange)' }}>
                  {ci.coach_feedback ? '✓ Reviewed' : '⏳ Pending'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {ci.date && <span style={{ fontSize: 10, color: 'var(--t3)' }}>{formatDate(ci.date)}</span>}
                <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} style={{ color: 'var(--t3)' }} />
              </div>
            </button>

            {/* Expanded content — ALL check-in fields */}
            {isExpanded && (
              <div style={{ padding: '12px' }}>

                {/* ── Mood ── */}
                {ci.mood && (
                  <div style={{
                    textAlign: 'center', padding: '10px', marginBottom: 10, borderRadius: 8,
                    background: 'var(--b1)', border: `1px solid ${moodColors[ci.mood] || 'var(--b2)'}`,
                  }}>
                    <span style={{ fontSize: 20 }}>{moodEmojis[ci.mood] || ''}</span>
                    <div style={{ fontSize: 14, fontWeight: 600, color: moodColors[ci.mood] || 'var(--t1)', marginTop: 2 }}>
                      {ci.mood}
                    </div>
                  </div>
                )}

                {/* ── Body & Recovery ── */}
                <SectionLabel>Body & Recovery</SectionLabel>
                <div style={{ marginBottom: 4 }}>
                  {ci.sleep_quality != null && <MetricBar label="Sleep Quality" value={ci.sleep_quality} />}
                  {ci.digestion != null && <MetricBar label="Digestion" value={ci.digestion} />}
                  {ci.energy != null && <MetricBar label="Energy" value={ci.energy} />}
                  {ci.energy_level != null && !ci.energy && <MetricBar label="Energy" value={ci.energy_level} />}
                  {ci.motivation != null && <MetricBar label="Motivation" value={ci.motivation} />}
                </div>

                {/* ── Pain ── */}
                {ci.pain && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--b1)', borderRadius: 8 }}>
                      <span style={{ fontSize: 14 }}>{ci.pain === 'no' ? '✅' : ci.pain === 'yes-minor' ? '⚠️' : '🚨'}</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: painLabels[ci.pain]?.color || 'var(--t2)' }}>
                          {painLabels[ci.pain]?.text || ci.pain}
                        </div>
                        {ci.pain_detail && (
                          <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2, lineHeight: 1.4 }}>{ci.pain_detail}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Adherence & Activity ── */}
                <SectionLabel>Adherence & Activity</SectionLabel>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  {ci.nutrition_adherence != null && (
                    <div style={{ flex: '1 1 70px', textAlign: 'center', padding: '10px 6px', background: 'var(--b1)', borderRadius: 8 }}>
                      <div style={{ fontSize: 20, fontFamily: 'var(--fd)', fontWeight: 700, color: ci.nutrition_adherence >= 7 ? 'var(--green)' : ci.nutrition_adherence >= 4 ? 'var(--gold)' : 'var(--red)' }}>
                        {ci.nutrition_adherence}/10
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase' }}>Nutrition</div>
                    </div>
                  )}
                  {ci.workouts_completed != null && (
                    <div style={{ flex: '1 1 70px', textAlign: 'center', padding: '10px 6px', background: 'var(--b1)', borderRadius: 8 }}>
                      <div style={{ fontSize: 20, fontFamily: 'var(--fd)', fontWeight: 700, color: 'var(--blue)' }}>
                        {ci.workouts_completed}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase' }}>Workouts</div>
                    </div>
                  )}
                  {ci.water_avg != null && (
                    <div style={{ flex: '1 1 70px', textAlign: 'center', padding: '10px 6px', background: 'var(--b1)', borderRadius: 8 }}>
                      <div style={{ fontSize: 20, fontFamily: 'var(--fd)', fontWeight: 700, color: ci.water_avg >= 2.5 ? 'var(--green)' : 'var(--gold)' }}>
                        {ci.water_avg}L
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase' }}>Water/Day</div>
                    </div>
                  )}
                </div>

                {/* Steps goal */}
                {ci.steps_goal && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--b1)', borderRadius: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 14 }}>{stepsLabels[ci.steps_goal]?.icon || '🚶'}</span>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase' }}>Steps Goal</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: stepsLabels[ci.steps_goal]?.color || 'var(--t2)' }}>{ci.steps_goal}</div>
                    </div>
                  </div>
                )}

                {/* ── Weight ── */}
                {ci.weight && (
                  <>
                    <SectionLabel>Body Composition</SectionLabel>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 10, padding: '8px 10px', background: 'var(--b1)', borderRadius: 8 }}>
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1 }}>Weight</div>
                        <div style={{ fontSize: 18, fontFamily: 'var(--fd)', fontWeight: 600 }}>{ci.weight} <span style={{ fontSize: 10, color: 'var(--t3)' }}>kg</span></div>
                      </div>
                      {ci.body_fat && (
                        <div>
                          <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1 }}>Body Fat</div>
                          <div style={{ fontSize: 18, fontFamily: 'var(--fd)', fontWeight: 600 }}>{ci.body_fat}<span style={{ fontSize: 10, color: 'var(--t3)' }}>%</span></div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ── Reflections ── */}
                {(ci.what_went_well || ci.biggest_struggle || ci.what_to_improve || ci.questions_for_coach || ci.notes || ci.wins || ci.struggles) && (
                  <SectionLabel>Reflections</SectionLabel>
                )}

                {ci.what_went_well && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--green)', fontWeight: 600, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>✅</span> What Went Well
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5, padding: '8px 10px', background: 'var(--b1)', borderRadius: 8, borderLeft: '3px solid var(--green)' }}>
                      {ci.what_went_well}
                    </div>
                  </div>
                )}
                {/* Fallback for old field name */}
                {!ci.what_went_well && ci.wins && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--green)', fontWeight: 600, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>✅</span> Wins
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5, padding: '8px 10px', background: 'var(--b1)', borderRadius: 8, borderLeft: '3px solid var(--green)' }}>
                      {ci.wins}
                    </div>
                  </div>
                )}

                {ci.biggest_struggle && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--orange)', fontWeight: 600, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>⚡</span> Biggest Struggle
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5, padding: '8px 10px', background: 'var(--b1)', borderRadius: 8, borderLeft: '3px solid var(--orange)' }}>
                      {ci.biggest_struggle}
                    </div>
                  </div>
                )}
                {!ci.biggest_struggle && ci.struggles && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--orange)', fontWeight: 600, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>⚡</span> Struggles
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5, padding: '8px 10px', background: 'var(--b1)', borderRadius: 8, borderLeft: '3px solid var(--orange)' }}>
                      {ci.struggles}
                    </div>
                  </div>
                )}

                {ci.what_to_improve && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--blue)', fontWeight: 600, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>🎯</span> Focus Next Week
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5, padding: '8px 10px', background: 'var(--b1)', borderRadius: 8, borderLeft: '3px solid var(--blue)' }}>
                      {ci.what_to_improve}
                    </div>
                  </div>
                )}

                {ci.questions_for_coach && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--gold)', fontWeight: 600, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>💬</span> Questions for Coach
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5, padding: '8px 10px', background: 'var(--b1)', borderRadius: 8, borderLeft: '3px solid var(--gold)' }}>
                      {ci.questions_for_coach}
                    </div>
                  </div>
                )}

                {/* General notes fallback */}
                {ci.notes && !ci.what_went_well && !ci.biggest_struggle && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, marginBottom: 3 }}>Client Notes</div>
                    <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5, padding: '8px 10px', background: 'var(--b1)', borderRadius: 8 }}>
                      {ci.notes}
                    </div>
                  </div>
                )}

                {/* ── Coach Feedback ── */}
                {ci.coach_feedback && (
                  <div style={{
                    marginTop: 14, padding: '12px 14px', background: 'var(--gold-d)',
                    borderRadius: 10, borderLeft: '4px solid var(--gold)',
                  }}>
                    <div style={{ fontSize: 10, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, fontWeight: 700 }}>Coach Feedback</div>
                    <div style={{ fontSize: 12, color: 'var(--t1)', lineHeight: 1.6 }}>{ci.coach_feedback}</div>
                    {ci.coach_responded_at && (
                      <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 6 }}>
                        {formatDate(ci.coach_responded_at.slice(0, 10))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}

// ── Section: Measurements (with selectable comparison) ──
function MeasurementsSection({ measurements }) {
  const [compareIdx, setCompareIdx] = useState(null);

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
  // All previous entries (excluding latest), newest first for the selector
  const prevEntries = measurements.slice(0, -1).reverse();
  // Default to the most recent previous entry
  const selectedPrev = compareIdx !== null && prevEntries[compareIdx] ? prevEntries[compareIdx]
    : prevEntries.length > 0 ? prevEntries[0] : null;

  const fields = [
    { label: 'Waist', key: 'waist', unit: 'cm' },
    { label: 'Chest', key: 'chest', unit: 'cm' },
    { label: 'Arms', key: 'arms', unit: 'cm' },
    { label: 'Thighs', key: 'thighs', unit: 'cm' },
  ];

  return (
    <Card title="Measurements" subtitle={`Latest: ${formatDate(latest.date)}`}>
      {/* Compare selector — only show if there are 2+ previous entries */}
      {prevEntries.length > 1 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Compare against</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {prevEntries.map((entry, idx) => {
              const isActive = compareIdx === idx || (compareIdx === null && idx === 0);
              return (
                <button
                  key={entry.date || idx}
                  className={`chip ${isActive ? 'active' : ''}`}
                  onClick={() => setCompareIdx(idx)}
                  style={{ fontSize: 10, padding: '3px 8px' }}
                >
                  {formatDate(entry.date)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Comparison table */}
      <div style={{ borderBottom: '2px solid var(--b3)', marginBottom: 4 }}>
        <div style={{ display: 'flex', padding: '0 0 6px' }}>
          <span style={{ width: 60, fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1 }}></span>
          {selectedPrev && (
            <span style={{ flex: 1, textAlign: 'center', fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1 }}>
              {formatDate(selectedPrev.date)}
            </span>
          )}
          <span style={{ flex: 1, textAlign: 'center', fontSize: 9, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
            Current
          </span>
          <span style={{ width: 55, textAlign: 'right', fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Change
          </span>
        </div>
      </div>

      {fields.map(f => {
        const val = latest[f.key];
        const prevVal = selectedPrev?.[f.key];
        const diff = val && prevVal ? (val - prevVal).toFixed(1) : null;
        const diffNum = diff ? parseFloat(diff) : null;
        return (
          <div key={f.key} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--b2)' }}>
            <span style={{ width: 60, fontSize: 11, color: 'var(--t3)' }}>{f.label}</span>
            {selectedPrev && (
              <span style={{ flex: 1, textAlign: 'center', fontSize: 13, fontFamily: 'var(--fd)', color: 'var(--t2)' }}>
                {prevVal || '—'}<span style={{ fontSize: 9, color: 'var(--t3)' }}>{prevVal ? f.unit : ''}</span>
              </span>
            )}
            <span style={{ flex: 1, textAlign: 'center', fontSize: 14, fontFamily: 'var(--fd)', fontWeight: 600 }}>
              {val || '—'}<span style={{ fontSize: 9, color: 'var(--t3)' }}>{val ? f.unit : ''}</span>
            </span>
            <span style={{
              width: 55, textAlign: 'right', fontSize: 11, fontFamily: 'var(--fd)', fontWeight: 600,
              color: diffNum === null ? 'var(--t3)' : diffNum <= 0 ? 'var(--green)' : 'var(--orange)',
            }}>
              {diffNum !== null ? `${diffNum > 0 ? '+' : ''}${diff}` : '—'}
            </span>
          </div>
        );
      })}
    </Card>
  );
}

// ── Section: Progress Photo Comparison ──
function ProgressPhotoComparison({ photos }) {
  const photoArr = Array.isArray(photos) ? photos : [];
  const [compareMode, setCompareMode] = useState('4w');

  // Group photos by week (Monday key), sorted newest first
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
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [photoArr]);

  const poses = ['front', 'side', 'back'];

  if (photoArr.length === 0) {
    return (
      <Card title="Progress Photos">
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--t3)', fontSize: 12 }}>
          No progress photos uploaded yet.
        </div>
      </Card>
    );
  }

  // Latest photos = first week group
  const latestWeek = weekGroups[0] || null;
  const latestPhotos = latestWeek ? latestWeek[1] : {};
  const latestLabel = latestWeek ? (() => {
    const m = new Date(latestWeek[0] + 'T12:00:00');
    return m.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  })() : '';

  // Find compare week based on mode
  const compareOptions = [
    { id: '4w', label: '4 Weeks Ago', weeks: 4 },
    { id: '8w', label: '8 Weeks Ago', weeks: 8 },
    { id: '12w', label: '12 Weeks Ago', weeks: 12 },
    { id: 'first', label: 'First Photos', weeks: null },
  ];

  const comparePhotos = useMemo(() => {
    if (!weekGroups.length) return null;
    if (compareMode === 'first') {
      // Last entry = oldest
      return weekGroups[weekGroups.length - 1];
    }
    const opt = compareOptions.find(o => o.id === compareMode);
    if (!opt || !opt.weeks) return null;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - opt.weeks * 7);
    const targetKey = targetDate.toISOString().slice(0, 10);
    // Find closest week group to target
    let closest = null;
    let closestDiff = Infinity;
    weekGroups.forEach(([wk, map]) => {
      // Skip the latest week
      if (wk === weekGroups[0][0]) return;
      const diff = Math.abs(new Date(wk + 'T12:00:00').getTime() - new Date(targetKey + 'T12:00:00').getTime());
      if (diff < closestDiff) { closestDiff = diff; closest = [wk, map]; }
    });
    return closest;
  }, [weekGroups, compareMode]);

  const compareLabel = comparePhotos ? (() => {
    const m = new Date(comparePhotos[0] + 'T12:00:00');
    return m.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  })() : '';
  const compareMap = comparePhotos ? comparePhotos[1] : {};
  const hasCompare = comparePhotos && Object.keys(compareMap).length > 0;

  function PhotoCell({ photo, placeholder }) {
    if (!photo) return (
      <div style={{
        flex: 1, aspectRatio: '3/4', background: 'var(--b2)', borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, color: 'var(--t3)',
      }}>
        {placeholder || 'No photo'}
      </div>
    );
    return (
      <div style={{ flex: 1 }}>
        <img
          src={photo.url} alt={photo.pose}
          style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 10, border: '1px solid var(--b2)', display: 'block' }}
        />
      </div>
    );
  }

  return (
    <Card title="Progress Comparison" subtitle="Before & After">
      {/* Compare mode selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
        {compareOptions.map(opt => (
          <button
            key={opt.id}
            className={`chip ${compareMode === opt.id ? 'active' : ''}`}
            onClick={() => setCompareMode(opt.id)}
            style={{ fontSize: 10, padding: '4px 10px' }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Column headers */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--t3)' }}>
          {hasCompare ? `Before · ${compareLabel}` : 'Before'}
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--gold)', fontWeight: 600 }}>
          Current · {latestLabel}
        </div>
      </div>

      {/* Per-pose rows: same angle side by side */}
      {poses.map(pose => (
        <div key={pose} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--t3)', marginBottom: 4, textAlign: 'center' }}>
            {pose}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <PhotoCell photo={hasCompare ? compareMap[pose] : null} placeholder={hasCompare ? pose : 'No photos yet'} />
            <PhotoCell photo={latestPhotos[pose]} placeholder={pose} />
          </div>
        </div>
      ))}
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
function QuickActions({ clientId, clientName, navigate, data, goalId, coachName }) {
  const [generating, setGenerating] = useState(false);
  const { showToast } = useUIStore();

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const { generateProgressReport } = await import('../../utils/progressReport');
      const weightLog = data?.weightLog || [];
      const weightTrend = weightLog.length >= 2 ? analyzeWeightTrend(weightLog) : null;

      // Count workouts and checkins
      const wh = data?.workoutHistory || {};
      const totalWorkouts = Object.values(wh).reduce((sum, sessions) => sum + sessions.length, 0);
      const totalCheckins = (data?.weeklyCheckins || []).length;

      // Build measurement comparison
      const measurements = data?.measurements || [];
      const measStart = measurements.length ? measurements[0] : null;
      const measCurrent = measurements.length > 1 ? measurements[measurements.length - 1] : null;

      const url = await generateProgressReport({
        clientName,
        goal: goalId,
        weightLog,
        weightTrend,
        adherence: null, // Would need to calculate
        totalWorkouts,
        totalCheckins,
        startDate: weightLog[0]?.date,
        endDate: weightLog[weightLog.length - 1]?.date,
        coachName,
        measurements: measStart && measCurrent ? { start: measStart, current: measCurrent } : null,
      });

      // Download
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(clientName || 'client').replace(/\s+/g, '_')}_progress_report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Report downloaded!', 'success');
    } catch (err) {
      console.error('[Report] error:', err);
      showToast('Failed to generate report', 'error');
    }
    setGenerating(false);
  };

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
        <button className="btn btn-secondary btn-sm" onClick={handleGenerateReport} disabled={generating}>
          <Icon name="download" size={12} /> {generating ? 'Generating...' : 'PDF Report'}
        </button>
      </div>
    </Card>
  );
}

// ── Section: Client Onboarding Info ──
function OnboardingInfo({ clientId }) {
  const [info, setInfo] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    supabase.from('client_onboarding').select('*').eq('client_id', clientId).maybeSingle()
      .then(({ data }) => { if (data) setInfo(data); });
  }, [clientId]);

  if (!info) return null;

  const fields = [
    { label: 'Age', value: info.age },
    { label: 'Height', value: info.height_cm ? `${info.height_cm} cm` : null },
    { label: 'Occupation', value: info.occupation },
    { label: 'Starting Weight', value: info.current_weight ? `${info.current_weight} kg` : null },
    { label: 'Goal Weight', value: info.goal_weight ? `${info.goal_weight} kg` : null },
    { label: 'Goal', value: info.goal },
    { label: 'Body Fat Est.', value: info.body_fat_estimate },
    { label: 'Experience', value: info.training_experience },
    { label: 'Training Days', value: info.training_days },
    { label: 'Preferred Split', value: info.preferred_split },
    { label: 'Injuries', value: info.injuries, highlight: true },
    { label: 'Diet', value: info.diet_type },
    { label: 'Allergies', value: info.allergies?.length ? info.allergies.filter(a => a !== 'None').join(', ') : null },
    { label: 'Meals/Day', value: info.meals_per_day },
    { label: 'Sleep', value: info.sleep_hours },
    { label: 'Stress', value: info.stress_level },
    { label: 'Daily Steps', value: info.daily_steps },
    { label: 'Motivation', value: info.motivation },
    { label: 'Biggest Challenge', value: info.biggest_challenge },
  ].filter(f => f.value);

  const visible = expanded ? fields : fields.slice(0, 6);

  return (
    <Card title="Intake Questionnaire" subtitle={`Completed ${info.completed_at ? new Date(info.completed_at).toLocaleDateString() : ''}`}>
      {visible.map(f => (
        <div key={f.label} style={{
          display: 'flex', justifyContent: 'space-between', padding: '5px 0',
          borderBottom: '1px solid var(--border)', fontSize: 12,
        }}>
          <span style={{ color: 'var(--t3)', minWidth: 110 }}>{f.label}</span>
          <span style={{
            color: f.highlight ? 'var(--red, #e74c3c)' : 'var(--t1)', fontWeight: f.highlight ? 600 : 400,
            textAlign: 'right', flex: 1, marginLeft: 8,
          }}>{f.value}</span>
        </div>
      ))}
      {fields.length > 6 && (
        <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 8, fontSize: 11 }} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show less' : `Show all (${fields.length})`}
        </button>
      )}
    </Card>
  );
}

// ── Main Screen ──
export default function ClientProfileScreen() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { clients } = useCoachStore();
  const { user } = useAuthStore();

  const { showToast } = useUIStore();
  const { setClients } = useCoachStore();

  const client = clients.find(c => (c.client_id || c.id) === clientId) || {};
  const [clientGoal, setClientGoal] = useState(client.goalId || client.goal || '');
  const [showManage, setShowManage] = useState(false);

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
        <ProfileHeader client={client} onBack={() => navigate('/coach/clients')} onManage={() => setShowManage(true)} />
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--t3)' }}>
          <div style={{ fontSize: 14 }}>Loading client data...</div>
        </div>
      </div>
    );
  }

  const clientName = client.client_name || client.name || 'Client';

  return (
    <div className="screen active">
      <ProfileHeader client={client} onBack={() => navigate('/coach/clients')} onManage={() => setShowManage(true)} />

      {/* Key metrics */}
      <KeyMetrics
        weightLog={data.weightLog}
        checkins={data.dailyCheckins}
        weeklyCheckins={data.weeklyCheckins}
      />

      {/* Two-column layout */}
      <div className="g7030">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <WeeklySnapshotCard
            dailyCheckins={data.dailyCheckins}
            nutritionHistory={data.nutritionHistory}
            workoutHistory={data.workoutHistory}
            weightLog={data.weightLog}
          />
          <DailyCheckinHeatmap checkins={data.dailyCheckins} />
          <AdherenceTimeline
            dailyCheckins={data.dailyCheckins}
            nutritionHistory={data.nutritionHistory}
            workoutHistory={data.workoutHistory}
          />
          <WeightTrend weightLog={data.weightLog} />
          <NutritionOverview nutritionHistory={data.nutritionHistory} mealPlan={data.mealPlan} clientId={clientId} coachId={user?.id} />
          <FullWeeklyCheckins checkins={data.weeklyCheckins} />
          <ProgressPhotoComparison photos={data.photos} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <CoachingIntelligence weightLog={data.weightLog} goalId={clientGoal} mealPlan={data.mealPlan} />
          <QuickActions clientId={clientId} clientName={clientName} navigate={navigate} data={data} goalId={clientGoal} coachName={user?.user_metadata?.full_name} />
          <SupplementsPanel clientId={clientId} coachId={user?.id} />
          <ReminderSettings clientId={clientId} coachId={user?.id} />
          <CoachGoalSelector clientId={clientId} currentGoal={clientGoal} onGoalChange={setClientGoal} />
          <TrainingSummary trainingPlan={data.trainingPlan} workoutHistory={data.workoutHistory} />
          <MeasurementsSection measurements={data.measurements} />
          <OnboardingInfo clientId={clientId} />
        </div>
      </div>
    </div>
  );
}
