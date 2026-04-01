import { useState, useEffect } from 'react';
import { Card } from '../../components/ui';
import { Icon } from '../../utils/icons';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { saveDailyCheckin, saveWeeklyCheckin, fetchWeeklyCheckins } from '../../services/checkins';

// ── Helpers ──
function getTodayKey() { return new Date().toISOString().slice(0, 10); }
function getWeekNumber(d) {
  const date = new Date(d);
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = (date - start + ((start.getTimezoneOffset() - date.getTimezoneOffset()) * 60000)) / 86400000;
  return Math.ceil((diff + start.getDay() + 1) / 7);
}

// ── Constants ──
const MOOD_OPTIONS = [
  { emoji: '\ud83d\udcaa', label: 'Unstoppable' },
  { emoji: '\ud83d\ude0a', label: 'Good' },
  { emoji: '\ud83d\ude10', label: 'Neutral' },
  { emoji: '\ud83d\ude14', label: 'Low' },
  { emoji: '\ud83d\ude29', label: 'Struggling' },
];

const WEEKLY_MOODS = ['Great Week', 'Good Week', 'Average', 'Tough Week', 'Terrible Week'];
const STEPS_OPTIONS = ['Every Day', 'Most Days', 'Some Days', 'Rarely'];
const PAIN_OPTIONS = [
  { value: 'no', label: 'No Pain' },
  { value: 'yes-minor', label: 'Yes — Minor' },
  { value: 'yes-major', label: 'Yes — Major' },
];

// ── Slider component ──
function Slider({ label, value, onChange, color, min = 1, max = 10 }) {
  return (
    <Card>
      <div className="kl">{label}</div>
      <div className="kv" style={{ margin: '4px 0 8px', color }}>{value}<span className="ku">/{max}</span></div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ '--p': `${(value / max) * 100}%` }}
      />
    </Card>
  );
}

// ── Pill selector ──
function PillSelector({ options, value, onChange, small }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map((opt, i) => {
        const val = typeof opt === 'object' ? opt.value : opt;
        const label = typeof opt === 'object' ? opt.label : opt;
        const sel = value === val;
        return (
          <button
            key={i}
            onClick={() => onChange(val)}
            style={{
              padding: small ? '4px 10px' : '6px 14px',
              fontSize: small ? 11 : 12,
              borderRadius: 8, cursor: 'pointer',
              border: sel ? '1px solid var(--gold)' : '1px solid var(--border)',
              background: sel ? 'var(--gold-d)' : 'transparent',
              color: sel ? 'var(--gold)' : 'var(--t2)',
              fontFamily: 'var(--fm)', fontWeight: sel ? 600 : 400,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════
// Daily Check-in Tab
// ══════════════════════════════════════
/** Resolve the correct client ID — uses override when coach is in client view */
function getClientId() {
  const authState = useAuthStore.getState();
  return authState.roleOverride
    ? (sessionStorage.getItem('overrideClientId') || authState.user?.id)
    : authState.user?.id;
}

function DailyCheckin() {
  const { user } = useAuthStore();
  const { showToast } = useUIStore();
  const [mood, setMood] = useState(null);
  const [sleep, setSleep] = useState(7);
  const [energy, setEnergy] = useState(7);
  const [stress, setStress] = useState(3);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    const ok = await saveDailyCheckin({
      client_id: getClientId(),
      date: getTodayKey(),
      mood: mood !== null ? MOOD_OPTIONS[mood].label : null,
      sleep: sleep,
      energy: energy,
      stress: stress,
      note: notes || null,
    });
    setSaving(false);
    if (ok) {
      showToast('Daily check-in saved!', 'success');
    } else {
      showToast('Failed to save', 'error');
    }
  };

  return (
    <>
      {/* Mood */}
      <Card title="How are you feeling today?" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {MOOD_OPTIONS.map((m, i) => (
            <div
              key={i}
              className={`mood-btn ${mood === i ? 'sel' : ''}`}
              onClick={() => setMood(i)}
            >
              <span className="mood-emoji">{m.emoji}</span>
              <span className="mood-label">{m.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Sliders */}
      <div className="g3" style={{ marginBottom: 14 }}>
        <Slider label="Sleep Quality" value={sleep} onChange={setSleep} color="var(--blue)" />
        <Slider label="Energy Level" value={energy} onChange={setEnergy} color="var(--green)" />
        <Slider label="Stress Level" value={stress} onChange={setStress} color="var(--orange)" />
      </div>

      {/* Notes */}
      <Card title="Notes" style={{ marginBottom: 14 }}>
        <textarea
          className="t-area"
          placeholder="How was your day? Any wins, struggles, or thoughts?"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
        />
      </Card>

      <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Daily Check-in'}
      </button>
    </>
  );
}

// ══════════════════════════════════════
// Weekly Check-in Tab
// ══════════════════════════════════════
function WeeklyCheckin() {
  const { user } = useAuthStore();
  const { showToast } = useUIStore();

  const weekNum = getWeekNumber(new Date());

  // Form state
  const [weeklyMood, setWeeklyMood] = useState(null);
  const [sleepQuality, setSleepQuality] = useState(7);
  const [digestion, setDigestion] = useState(7);
  const [energyLevel, setEnergyLevel] = useState(7);
  const [pain, setPain] = useState('no');
  const [painDetail, setPainDetail] = useState('');
  const [nutritionAdherence, setNutritionAdherence] = useState(7);
  const [workoutsCompleted, setWorkoutsCompleted] = useState(0);
  const [waterAvg, setWaterAvg] = useState('');
  const [stepsGoal, setStepsGoal] = useState(null);
  const [biggestStruggle, setBiggestStruggle] = useState('');
  const [whatWentWell, setWhatWentWell] = useState('');
  const [whatToImprove, setWhatToImprove] = useState('');
  const [motivation, setMotivation] = useState(7);
  const [questionsForCoach, setQuestionsForCoach] = useState('');
  const [saving, setSaving] = useState(false);

  // Load existing check-in for this week
  const [loaded, setLoaded] = useState(false);
  const [existingFeedback, setExistingFeedback] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    fetchWeeklyCheckins(getClientId()).then(data => {
      const thisWeek = (data || []).find(c => c.week_number === weekNum);
      if (thisWeek) {
        if (thisWeek.mood) setWeeklyMood(thisWeek.mood);
        if (thisWeek.sleep_quality) setSleepQuality(thisWeek.sleep_quality);
        if (thisWeek.digestion) setDigestion(thisWeek.digestion);
        if (thisWeek.energy) setEnergyLevel(thisWeek.energy);
        if (thisWeek.pain) setPain(thisWeek.pain);
        if (thisWeek.pain_detail) setPainDetail(thisWeek.pain_detail);
        if (thisWeek.nutrition_adherence) setNutritionAdherence(thisWeek.nutrition_adherence);
        if (thisWeek.workouts_completed != null) setWorkoutsCompleted(thisWeek.workouts_completed);
        if (thisWeek.water_avg) setWaterAvg(String(thisWeek.water_avg));
        if (thisWeek.steps_goal) setStepsGoal(thisWeek.steps_goal);
        if (thisWeek.biggest_struggle) setBiggestStruggle(thisWeek.biggest_struggle);
        if (thisWeek.what_went_well) setWhatWentWell(thisWeek.what_went_well);
        if (thisWeek.what_to_improve) setWhatToImprove(thisWeek.what_to_improve);
        if (thisWeek.motivation) setMotivation(thisWeek.motivation);
        if (thisWeek.questions_for_coach) setQuestionsForCoach(thisWeek.questions_for_coach);
        if (thisWeek.coach_feedback) setExistingFeedback(thisWeek.coach_feedback);
      }
      setLoaded(true);
    }).catch(() => {
      setLoaded(true);
    });
  }, [user?.id, weekNum]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    const ok = await saveWeeklyCheckin(getClientId(), {
      week_number: weekNum,
      date: getTodayKey(),
      mood: weeklyMood,
      sleep_quality: sleepQuality,
      digestion,
      energy: energyLevel,
      pain,
      pain_detail: pain !== 'no' ? painDetail : null,
      nutrition_adherence: nutritionAdherence,
      workouts_completed: workoutsCompleted,
      water_avg: parseFloat(waterAvg) || null,
      steps_goal: stepsGoal,
      biggest_struggle: biggestStruggle || null,
      what_went_well: whatWentWell || null,
      what_to_improve: whatToImprove || null,
      motivation,
      questions_for_coach: questionsForCoach || null,
    });
    setSaving(false);
    if (ok) {
      showToast('Weekly check-in saved!', 'success');
    } else {
      showToast('Failed to save', 'error');
    }
  };

  if (!loaded) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: 30, color: 'var(--t3)', fontSize: 13 }}>Loading...</div>
      </Card>
    );
  }

  return (
    <>
      {/* Week indicator */}
      <Card style={{ marginBottom: 14, textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1 }}>Weekly Check-in</div>
        <div style={{ fontFamily: 'var(--fd)', fontSize: 24, color: 'var(--gold)', margin: '4px 0' }}>Week {weekNum}</div>
        <div style={{ fontSize: 11, color: 'var(--t3)' }}>Fill this in at the end of each week for your coach</div>
      </Card>

      {/* Coach feedback from previous submission */}
      {existingFeedback && (
        <Card style={{ marginBottom: 14, border: '1px solid var(--gold)' }}>
          <div className="kl" style={{ marginBottom: 6 }}>Coach Feedback</div>
          <div style={{ fontSize: 13, color: 'var(--t1)', lineHeight: 1.5 }}>{existingFeedback}</div>
        </Card>
      )}

      {/* Overall mood */}
      <Card title="How was your week overall?" style={{ marginBottom: 14 }}>
        <PillSelector options={WEEKLY_MOODS} value={weeklyMood} onChange={setWeeklyMood} />
      </Card>

      {/* Body & Recovery */}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 8, marginTop: 6 }}>Body & Recovery</div>
      <div className="g2" style={{ marginBottom: 14 }}>
        <Slider label="Sleep Quality" value={sleepQuality} onChange={setSleepQuality} color="var(--blue)" />
        <Slider label="Digestion" value={digestion} onChange={setDigestion} color="var(--green)" />
        <Slider label="Energy" value={energyLevel} onChange={setEnergyLevel} color="var(--orange)" />
        <Slider label="Motivation" value={motivation} onChange={setMotivation} color="var(--gold)" />
      </div>

      {/* Pain */}
      <Card title="Any pain or discomfort?" style={{ marginBottom: 14 }}>
        <PillSelector options={PAIN_OPTIONS} value={pain} onChange={setPain} small />
        {pain !== 'no' && (
          <textarea
            className="t-area"
            placeholder="Where and what kind of pain?"
            value={painDetail}
            onChange={e => setPainDetail(e.target.value)}
            rows={2}
            style={{ marginTop: 10 }}
          />
        )}
      </Card>

      {/* Adherence */}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 8, marginTop: 6 }}>Adherence</div>
      <div className="g2" style={{ marginBottom: 14 }}>
        <Slider label="Nutrition Adherence" value={nutritionAdherence} onChange={setNutritionAdherence} color="var(--green)" />
        <Card>
          <div className="kl">Workouts Completed</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setWorkoutsCompleted(Math.max(0, workoutsCompleted - 1))}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>−</span>
            </button>
            <div style={{ fontFamily: 'var(--fd)', fontSize: 22, color: 'var(--blue)', minWidth: 30, textAlign: 'center' }}>{workoutsCompleted}</div>
            <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setWorkoutsCompleted(workoutsCompleted + 1)}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
            </button>
          </div>
        </Card>
      </div>

      <div className="g2" style={{ marginBottom: 14 }}>
        <Card>
          <div className="kl">Avg. Water (L/day)</div>
          <input
            className="form-inp"
            type="number"
            step="0.1"
            placeholder="e.g. 2.5"
            value={waterAvg}
            onChange={e => setWaterAvg(e.target.value)}
            style={{ marginTop: 6, width: '100%' }}
          />
        </Card>
        <Card>
          <div className="kl">Steps Goal</div>
          <div style={{ marginTop: 6 }}>
            <PillSelector options={STEPS_OPTIONS} value={stepsGoal} onChange={setStepsGoal} small />
          </div>
        </Card>
      </div>

      {/* Written responses */}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 8, marginTop: 6 }}>Reflection</div>

      <Card title="What went well this week?" style={{ marginBottom: 14 }}>
        <textarea
          className="t-area"
          placeholder="Your wins, progress, things you're proud of..."
          value={whatWentWell}
          onChange={e => setWhatWentWell(e.target.value)}
          rows={3}
        />
      </Card>

      <Card title="Biggest struggle this week?" style={{ marginBottom: 14 }}>
        <textarea
          className="t-area"
          placeholder="What was hard? Where did you slip?"
          value={biggestStruggle}
          onChange={e => setBiggestStruggle(e.target.value)}
          rows={3}
        />
      </Card>

      <Card title="What do you want to improve next week?" style={{ marginBottom: 14 }}>
        <textarea
          className="t-area"
          placeholder="One or two things to focus on..."
          value={whatToImprove}
          onChange={e => setWhatToImprove(e.target.value)}
          rows={2}
        />
      </Card>

      <Card title="Questions for your coach?" style={{ marginBottom: 14 }}>
        <textarea
          className="t-area"
          placeholder="Anything you want to ask or discuss..."
          value={questionsForCoach}
          onChange={e => setQuestionsForCoach(e.target.value)}
          rows={2}
        />
      </Card>

      <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Weekly Check-in'}
      </button>
    </>
  );
}

// ══════════════════════════════════════
// Main — tabs for Daily / Weekly
// ══════════════════════════════════════
export default function JournalScreen() {
  const [tab, setTab] = useState('daily');

  return (
    <div className="screen active">
      {/* Tab switcher */}
      <div className="modal-tabs" style={{ marginBottom: 18 }}>
        <div className={`mtab ${tab === 'daily' ? 'active' : ''}`} onClick={() => setTab('daily')}>
          Daily Check-in
        </div>
        <div className={`mtab ${tab === 'weekly' ? 'active' : ''}`} onClick={() => setTab('weekly')}>
          Weekly Check-in
        </div>
      </div>

      {tab === 'daily' ? <DailyCheckin /> : <WeeklyCheckin />}
    </div>
  );
}
