import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useClientStore } from '../../stores/clientStore';
import { useUIStore } from '../../stores/uiStore';
import { Card, ProgressRing, DateNavigator } from '../../components/ui';
import { Icon } from '../../utils/icons';
import { getTodayKey, formatShortDate } from '../../utils/constants';
import { saveWeight } from '../../services/progress';
import { saveDailyCheckin } from '../../services/checkins';
import { saveDailyNutritionLog } from '../../services/nutrition';
import { supabase } from '../../services/supabase';
import { analyzeWeightTrend, detectPlateau } from '../../utils/coachingInsights';
import { useNotificationStore } from '../../stores/notificationStore';
import { generateSmartReminders, fetchReminderRules } from '../../services/reminders';
import ReminderCards from '../../components/client/ReminderCards';
import { PageSkeleton } from '../../components/ui';

// ---------- helpers ----------
/** Resolve the correct client ID — uses override when coach is in client view */
function getClientId() {
  const authState = useAuthStore.getState();
  return authState.roleOverride
    ? (sessionStorage.getItem('overrideClientId') || authState.user?.id)
    : authState.user?.id;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function getStreakDays() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = new Date();
  const dow = today.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  return days.map((d, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() + mondayOffset + i);
    const dateKey = date.toISOString().slice(0, 10);
    const isToday = dateKey === getTodayKey();
    return { label: d, dateKey, isToday, isPast: date < new Date(getTodayKey() + 'T00:00:00') };
  });
}

// ---------- Goal config ----------
const GOAL_META = {
  'cut':        { label: 'Cutting',      icon: '🔥', tip: 'Stay in your deficit. Prioritize protein and steps.' },
  'lean-bulk':  { label: 'Lean Bulk',    icon: '💪', tip: 'Hit your surplus. Focus on progressive overload.' },
  'recomp':     { label: 'Body Recomp',  icon: '⚖️', tip: 'High protein, train hard, stay consistent.' },
  'maintenance':{ label: 'Maintenance',  icon: '🛡️', tip: 'Stay disciplined. Sustain your habits.' },
  'comp-prep':  { label: 'Comp Prep',    icon: '🏆', tip: 'Every detail counts. Trust the process.' },
};

// ---------- sub-components ----------
function MissionBriefing({ name, streak, goal }) {
  const gm = GOAL_META[goal];
  return (
    <Card className="mission-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="kl">Today's Mission Briefing</div>
          <div style={{ fontFamily: 'var(--fd)', fontSize: 22, letterSpacing: 1.5, marginTop: 6 }}>
            {getGreeting().toUpperCase()} {name.split(' ')[0].toUpperCase()}
          </div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>
            {gm ? gm.tip : 'Stay focused. Stay disciplined. Let\'s make it count.'}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {gm && (
            <div className="tag t-gold" style={{ fontSize: 11, padding: '4px 10px' }}>
              {gm.icon} {gm.label}
            </div>
          )}
          {streak > 0 && (
            <div className="tag t-gr" style={{ fontSize: 11, padding: '4px 10px' }}>
              {streak} day streak
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ---------- Weight card with inline logger ----------
function WeightCard({ weightLog, selectedDate }) {
  const { user } = useAuthStore();
  const { addWeight } = useClientStore();
  const { showToast } = useUIStore();
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [saving, setSaving] = useState(false);

  const dateWeight = weightLog.find(w => w.date === selectedDate);
  const latestWeight = weightLog.length ? weightLog[weightLog.length - 1] : null;
  const displayWeight = dateWeight ? dateWeight.weight : (latestWeight ? latestWeight.weight : null);

  const handleSave = async () => {
    const w = parseFloat(inputVal);
    if (!w || w < 20 || w > 300) { showToast('Enter a valid weight', 'error'); return; }
    setSaving(true);
    addWeight(selectedDate, w);
    const ok = await saveWeight(getClientId(), selectedDate, w);
    setSaving(false);
    setEditing(false);
    setInputVal('');
    showToast(ok ? 'Weight logged!' : 'Failed to save', ok ? 'success' : 'error');
  };

  if (editing) {
    return (
      <Card>
        <div className="kl">Log Weight — {formatShortDate(selectedDate)}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
          <input
            className="form-inp"
            type="number"
            step="0.1"
            placeholder={latestWeight ? String(latestWeight.weight) : '80.0'}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            autoFocus
            style={{ flex: 1, fontSize: 18, fontFamily: 'var(--fd)', textAlign: 'center' }}
          />
          <span style={{ fontSize: 14, color: 'var(--t3)' }}>kg</span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="kl">Body Weight</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, margin: '6px 0' }}>
        <span className="kv">{displayWeight ?? '—'}</span>
        {displayWeight && <span className="ku">kg</span>}
      </div>
      {dateWeight && (
        <div style={{ fontSize: 10, color: 'var(--green)', marginBottom: 6 }}>
          Logged for {formatShortDate(selectedDate)}
        </div>
      )}
      <button className="btn btn-secondary btn-sm" style={{ marginTop: 4, width: '100%' }}
        onClick={() => { setEditing(true); setInputVal(dateWeight ? String(dateWeight.weight) : ''); }}
      >
        {dateWeight ? 'Update Weight' : 'Log Weight'}
      </button>
    </Card>
  );
}

// ---------- Steps card with manual input ----------
function StepsCard({ currentSteps, stepGoal, selectedDate }) {
  const { user } = useAuthStore();
  const { setSteps } = useClientStore();
  const { showToast } = useUIStore();
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [saving, setSaving] = useState(false);
  const pct = stepGoal ? Math.min(currentSteps / stepGoal, 1) : 0;

  const handleSave = async () => {
    const s = parseInt(inputVal);
    if (isNaN(s) || s < 0) { showToast('Enter valid steps', 'error'); return; }
    setSaving(true);
    setSteps(s);
    const result = await saveDailyCheckin({ client_id: getClientId(), date: selectedDate, steps: s }).catch(() => ({ ok: false, error: 'Network error' }));
    const ok = result === true || (result && result.ok === true);
    setSaving(false);
    setEditing(false);
    const errMsg = result && result.error ? `Failed to save: ${result.error}` : 'Failed to save';
    showToast(ok ? 'Steps saved!' : errMsg, ok ? 'success' : 'error');
  };

  if (editing) {
    return (
      <Card>
        <div className="kl">Log Steps — {formatShortDate(selectedDate)}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
          <input
            className="form-inp"
            type="number"
            placeholder={String(currentSteps || 0)}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            autoFocus
            style={{ flex: 1, fontSize: 18, fontFamily: 'var(--fd)', textAlign: 'center' }}
          />
          <span style={{ fontSize: 14, color: 'var(--t3)' }}>steps</span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="kl">Steps</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, margin: '6px 0' }}>
        <span className="kv" style={{ color: 'var(--green)' }}>{currentSteps.toLocaleString()}</span>
        <span className="ku">/ {stepGoal.toLocaleString()}</span>
      </div>
      <div className="pbar">
        <div className="pfill gr" style={{ width: `${pct * 100}%` }} />
      </div>
      <button className="btn btn-secondary btn-sm" style={{ marginTop: 10, width: '100%' }}
        onClick={() => { setEditing(true); setInputVal(currentSteps > 0 ? String(currentSteps) : ''); }}
      >
        {currentSteps > 0 ? 'Update Steps' : 'Log Steps'}
      </button>
    </Card>
  );
}

// ---------- Water card with auto-save ----------
function WaterCard({ current, goal, selectedDate }) {
  const { user } = useAuthStore();
  const { addWater } = useClientStore();
  const saveTimer = useRef(null);
  const liters = (current / 1000).toFixed(1);
  const goalL = (goal / 1000).toFixed(0);
  const pct = Math.min(current / goal, 1);

  const handleAdd = (ml) => {
    addWater(ml);
    // Debounce save
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const store = useClientStore.getState();
      const dayData = store._getDayData(selectedDate);
      await saveDailyCheckin({
        client_id: getClientId(),
        date: selectedDate,
        hydration: +(dayData.waterML / 1000).toFixed(1),
      }).catch(() => {});
    }, 800);
  };

  return (
    <Card>
      <div className="kl">Water</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, margin: '6px 0' }}>
        <span className="kv" style={{ color: 'var(--blue)' }}>{liters}</span>
        <span className="ku">/ {goalL}L</span>
      </div>
      <div className="pbar">
        <div className="pfill bl" style={{ width: `${pct * 100}%` }} />
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => handleAdd(250)}>+250ml</button>
        <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => handleAdd(500)}>+500ml</button>
      </div>
    </Card>
  );
}

function CaloriesCard({ meals, targets }) {
  const totals = useMemo(() => {
    let kcal = 0, p = 0, c = 0, f = 0;
    meals.forEach(m => {
      if (!m.foods) return;
      m.foods.forEach(fd => {
        if (fd.checked) { kcal += fd.kcal || 0; p += fd.p || 0; c += fd.c || 0; f += fd.f || 0; }
      });
    });
    return { kcal, p, c, f };
  }, [meals]);

  const pct = targets.calories ? Math.min(totals.kcal / targets.calories, 1) : 0;

  return (
    <Card>
      <div className="kl">Calories</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, margin: '6px 0' }}>
        <span className="kv" style={{ color: 'var(--gold)' }}>{totals.kcal}</span>
        <span className="ku">/ {targets.calories}</span>
      </div>
      <div className="pbar">
        <div className="pfill" style={{ width: `${pct * 100}%` }} />
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
        {[
          { label: 'Protein', val: totals.p, max: targets.protein, color: 'var(--green)' },
          { label: 'Carbs', val: totals.c, max: targets.carbs, color: 'var(--blue)' },
          { label: 'Fat', val: totals.f, max: targets.fat, color: 'var(--orange)' },
        ].map(m => (
          <div key={m.label} style={{ flex: 1 }}>
            <ProgressRing value={m.val} max={m.max} size={40} stroke={3} color={m.color}>
              <span style={{ fontSize: 9 }}>{m.max ? Math.round((m.val / m.max) * 100) : 0}%</span>
            </ProgressRing>
            <div style={{ fontSize: 9, color: 'var(--t3)', textAlign: 'center', marginTop: 4, letterSpacing: 1, textTransform: 'uppercase' }}>
              {m.label}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DailyChecklist({ items }) {
  const navigate = useNavigate();
  const done = items.filter(i => i.checked).length;
  const pct = items.length ? done / items.length : 0;

  if (items.length === 0) {
    return (
      <Card title="Daily Checklist" subtitle="0/0 completed">
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--t3)', fontSize: 12 }}>
          No checklist items yet.
        </div>
      </Card>
    );
  }

  return (
    <Card title="Daily Checklist" subtitle={`${done}/${items.length} completed`}>
      <div className="pbar" style={{ marginBottom: 14, marginTop: -4 }}>
        <div className="pfill gr" style={{ width: `${pct * 100}%` }} />
      </div>
      {items.map((item, idx) => (
        <div
          key={idx}
          className={`ci ${item.checked ? 'done' : ''}`}
          onClick={item.link ? () => navigate(item.link) : undefined}
          style={item.link ? { cursor: 'pointer' } : undefined}
        >
          <div className="cb">
            {item.checked && <Icon name="check" size={10} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className="ct">{item.label}</span>
            {item.sub && <span className="cm2" style={{ display: 'block' }}>{item.sub}</span>}
          </div>
          {item.link && !item.checked && (
            <Icon name="chevron-right" size={12} style={{ opacity: 0.3, flexShrink: 0 }} />
          )}
        </div>
      ))}
    </Card>
  );
}

function StreakCalendar({ dailyLog }) {
  const days = getStreakDays();
  return (
    <Card title="This Week">
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
        {days.map(d => {
          const log = dailyLog[d.dateKey];
          const isDone = log?.workout || log?.checklist?.length > 3;
          return (
            <div
              key={d.dateKey}
              className={`streak-day ${isDone ? 'done' : ''} ${d.isToday ? 'today' : ''}`}
            >
              {d.label.charAt(0)}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TodayWorkout({ plan, dayIdx }) {
  const navigate = useNavigate();
  if (!plan || !plan.days || !plan.days[dayIdx]) {
    return (
      <Card title="Today's Workout">
        <div style={{ fontSize: 12, color: 'var(--t3)' }}>No workout assigned yet.</div>
      </Card>
    );
  }
  const day = plan.days[dayIdx];
  return (
    <Card title="Today's Workout">
      <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 4 }}>{day.name}</div>
      <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 12 }}>
        {day.exercises?.length || 0} exercises
      </div>
      <button
        className="btn btn-primary btn-sm"
        style={{ width: '100%' }}
        onClick={() => navigate('/app/training')}
      >
        Start Workout
      </button>
    </Card>
  );
}

// ---------- build checklist from real data ----------
function buildChecklist({ meals, dayData, stepGoal, waterGoal, macroTargets, weightLog, dailyLog, selectedDate, checkinDone }) {
  const dateWeight = weightLog.find(w => w.date === selectedDate);
  const currentSteps = dayData.currentSteps || 0;
  const waterML = dayData.waterML || 0;
  const totalProtein = meals.reduce((sum, m) => {
    if (!m.foods) return sum;
    return sum + m.foods.reduce((s, f) => s + (f.checked ? (f.p || 0) : 0), 0);
  }, 0);
  const mealsLogged = meals.filter(m => m.logged).length;
  const workoutDone = dailyLog[selectedDate]?.workout;

  const items = [];
  items.push({ label: 'Morning weigh-in', checked: !!dateWeight });
  items.push({ label: `Cardio / ${stepGoal.toLocaleString()} steps`, checked: currentSteps >= stepGoal, sub: `${currentSteps.toLocaleString()}/${stepGoal.toLocaleString()}` });
  items.push({ label: 'Log all meals', checked: mealsLogged >= meals.length && meals.length > 0, link: '/app/nutrition' });
  items.push({ label: 'Hit protein target', checked: totalProtein >= (macroTargets.protein || 180), link: '/app/nutrition' });
  items.push({ label: 'Complete workout', checked: !!workoutDone, link: '/app/training' });
  const wGoal = waterGoal || 3000;
  items.push({ label: `Water intake: ${(wGoal / 1000).toFixed(1)}L`, checked: waterML >= wGoal, sub: `${(waterML / 1000).toFixed(1)}L` });
  items.push({ label: 'Daily check-in', checked: checkinDone, sub: checkinDone ? 'Submitted' : 'Mood, sleep & energy', link: '/app/journal' });
  return items;
}

// ---------- Progress Insights ----------
function ProgressInsights({ weightLog, goal }) {
  const trend = useMemo(() => analyzeWeightTrend(weightLog, { days: 14 }), [weightLog]);
  const plateau = useMemo(() => detectPlateau(weightLog), [weightLog]);

  if (!trend) return null;

  const trendArrow = trend.direction === 'losing' ? '↓' : trend.direction === 'gaining' ? '↑' : '→';
  const trendColor = (() => {
    if (goal === 'cut') return trend.direction === 'losing' ? 'var(--green)' : trend.direction === 'gaining' ? 'var(--red)' : 'var(--orange)';
    if (goal === 'lean-bulk') return trend.direction === 'gaining' ? 'var(--green)' : trend.direction === 'losing' ? 'var(--red)' : 'var(--orange)';
    return 'var(--t2)';
  })();

  return (
    <Card>
      <div className="kl" style={{ marginBottom: 8 }}>Progress Insights</div>
      {/* Weight trend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 20, color: trendColor, fontWeight: 700 }}>{trendArrow}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: trendColor }}>
            {trend.weekChange != null ? `${trend.weekChange > 0 ? '+' : ''}${trend.weekChange} kg this week` : `${trend.totalChange > 0 ? '+' : ''}${trend.totalChange} kg trend`}
          </div>
          <div style={{ fontSize: 10, color: 'var(--t3)' }}>
            Avg: {trend.currentAvg} kg · Rate: {trend.weeklyRate > 0 ? '+' : ''}{trend.weeklyRate} kg/wk
          </div>
        </div>
      </div>

      {/* Plateau warning */}
      {plateau?.detected && (
        <div style={{
          fontSize: 11, color: 'var(--orange)', background: 'rgba(255,165,0,.08)',
          padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,165,0,.15)', lineHeight: 1.4,
        }}>
          📊 {plateau.message}
        </div>
      )}
    </Card>
  );
}

// ---------- main ----------
export default function DashboardScreen() {
  const { user, roleOverride } = useAuthStore();
  const navigate = useNavigate();
  const store = useClientStore();
  const {
    selectedDate, isToday,
    macroTargets, stepGoal, waterGoal, goal,
    trainingPlan, activeWorkoutDay, dailyLog, weightLog,
    dayDataMap, getMealsForDate, _getDayData,
    dataLoaded,
  } = store;
  const { showToast } = useUIStore();

  // Redirect new clients to onboarding (skip if coach is previewing client view)
  useEffect(() => {
    if (roleOverride) return; // Coach preview — skip onboarding
    const clientId = user?.id;
    if (!clientId) return;
    const done = localStorage.getItem(`onboarding_complete_${clientId}`);
    if (!done) navigate('/app/onboarding', { replace: true });
  }, [user?.id, roleOverride, navigate]);

  // Per-date data
  const dayData = _getDayData(selectedDate);
  const meals = getMealsForDate();
  const currentSteps = dayData.currentSteps || 0;
  const waterML = dayData.waterML || 0;

  const fullName = user?.user_metadata?.full_name || 'Athlete';

  // Check if daily check-in (mood/sleep/energy) was submitted for selected date
  const [checkinDone, setCheckinDone] = useState(false);
  useEffect(() => {
    if (!user?.id) return;
    setCheckinDone(false);
    const clientId = getClientId();

    supabase
      .from('daily_checkins')
      .select('mood')
      .eq('client_id', clientId)
      .eq('date', selectedDate)
      .single()
      .then(({ data }) => {
        // Mood being set means the full check-in was submitted (not just water/steps)
        setCheckinDone(!!data?.mood);
      });
  }, [user?.id, selectedDate]);

  // Streak calculation
  const streak = useMemo(() => {
    let count = 0;
    const d = new Date();
    d.setDate(d.getDate() - 1);
    while (true) {
      const key = d.toISOString().slice(0, 10);
      if (dailyLog[key]) { count++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return count;
  }, [dailyLog]);

  // Build checklist from real per-date data
  const checklist = useMemo(() => buildChecklist({
    meals, dayData, stepGoal, waterGoal, macroTargets, weightLog, dailyLog, selectedDate, checkinDone,
  }), [meals, dayData, stepGoal, waterGoal, macroTargets, weightLog, dailyLog, selectedDate, checkinDone]);

  const { setSmartReminders } = useNotificationStore();

  // Generate smart reminders based on today's activity
  useEffect(() => {
    if (!isToday || !user?.id) return;
    const clientId = getClientId();

    // Check today's data to generate reminders
    const todayWeight = Array.isArray(weightLog) ? weightLog.find(w => w.date === selectedDate) : weightLog[selectedDate];
    const todayNutrition = meals.some(m => m.foods?.some(f => f.logged));
    const todayWorkout = false; // Could check workout history
    const waterL = (waterML || 0) / 1000;

    async function loadAndGenerate() {
      let rules = null;
      try { rules = await fetchReminderRules(clientId); } catch (e) { /* no rules set */ }

      const reminders = generateSmartReminders({
        dailyCheckin: checkinDone,
        nutritionLog: todayNutrition,
        weightLog: !!todayWeight,
        workoutDone: todayWorkout,
        waterIntake: waterL,
        steps: currentSteps,
        rules,
      });
      setSmartReminders(reminders);
    }
    loadAndGenerate();
  }, [isToday, user?.id, selectedDate, checkinDone, waterML, currentSteps]);

  // Show skeleton while initial data loads
  if (!dataLoaded) return <PageSkeleton />;

  return (
    <div className="screen active">
      {/* Mission Briefing */}
      <MissionBriefing name={fullName} streak={streak} goal={goal} />

      {/* Smart Reminders */}
      {isToday && <ReminderCards navigate={navigate} />}

      {/* Date selector */}
      <DateNavigator />

      {/* 4 metric cards */}
      <div className="g4">
        <WeightCard weightLog={weightLog} selectedDate={selectedDate} />
        <StepsCard currentSteps={currentSteps} stepGoal={stepGoal} selectedDate={selectedDate} />
        <WaterCard current={waterML} goal={waterGoal || 3000} selectedDate={selectedDate} />
        <CaloriesCard meals={meals} targets={macroTargets} />
      </div>

      {/* Bottom 70/30 */}
      <div className="g7030">
        <div>
          <DailyChecklist items={checklist} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ProgressInsights weightLog={weightLog} goal={goal} />
          <StreakCalendar dailyLog={dailyLog} />
          <TodayWorkout plan={trainingPlan} dayIdx={activeWorkoutDay} />
        </div>
      </div>
    </div>
  );
}
