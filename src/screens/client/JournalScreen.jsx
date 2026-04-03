import { useState, useEffect, useMemo, useRef } from 'react';
import { Card } from '../../components/ui';
import { Icon } from '../../utils/icons';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { saveDailyCheckin, saveWeeklyCheckin, fetchWeeklyCheckins, fetchDailyCheckins } from '../../services/checkins';

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

// ── Slider component (compact on mobile) ──
function Slider({ label, value, onChange, color, min = 1, max = 10 }) {
  return (
    <div className="checkin-slider">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)' }}>{label}</span>
        <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--fd)', color, lineHeight: 1 }}>
          {value}<span style={{ fontSize: 10, color: 'var(--t3)', marginLeft: 2 }}>/{max}</span>
        </span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ '--p': `${(value / max) * 100}%` }}
      />
    </div>
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
  const [selectedDate, setSelectedDate] = useState(getTodayKey());
  const [mood, setMood] = useState(null);
  const [sleep, setSleep] = useState(7);
  const [energy, setEnergy] = useState(7);
  const [stress, setStress] = useState(3);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
  const [checkinHistory, setCheckinHistory] = useState({}); // { 'YYYY-MM-DD': checkinData }

  const isToday = selectedDate === getTodayKey();
  const clientId = getClientId();

  // Generate last 14 days
  const days = useMemo(() => {
    const result = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dateNum = d.getDate();
      const monthLabel = d.toLocaleDateString('en-US', { month: 'short' });
      result.push({ key, dayLabel, dateNum, monthLabel, isToday: i === 0 });
    }
    return result;
  }, []);

  // Load last 14 days of check-in history on mount
  useEffect(() => {
    if (!clientId) return;
    fetchDailyCheckins(clientId, 14).then(data => {
      const map = {};
      (data || []).forEach(c => {
        if (c.mood) map[c.date] = c; // Only count as "done" if mood was set
      });
      setCheckinHistory(map);
    });
  }, [clientId]);

  // Load existing data when date changes
  useEffect(() => {
    if (!clientId) return;
    const existing = checkinHistory[selectedDate];
    if (existing) {
      const moodIdx = MOOD_OPTIONS.findIndex(m => m.label === existing.mood);
      setMood(moodIdx >= 0 ? moodIdx : null);
      setSleep(existing.sleep || existing.sleep_quality || 7);
      setEnergy(existing.energy || existing.energy_level || 7);
      setStress(existing.stress || existing.stress_level || 3);
      setNotes(existing.note || existing.notes || '');
    } else {
      // Reset form for empty day
      setMood(null);
      setSleep(7);
      setEnergy(7);
      setStress(3);
      setNotes('');
    }
  }, [selectedDate, checkinHistory]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    const ok = await saveDailyCheckin({
      client_id: clientId,
      date: selectedDate,
      mood: mood !== null ? MOOD_OPTIONS[mood].label : null,
      sleep: sleep,
      energy: energy,
      stress: stress,
      note: notes || null,
    });
    setSaving(false);
    if (ok) {
      // Update history so the dot turns green
      setCheckinHistory(prev => ({
        ...prev,
        [selectedDate]: { mood: MOOD_OPTIONS[mood]?.label, sleep, energy, stress, note: notes, date: selectedDate },
      }));
      showToast(isToday ? 'Daily check-in saved!' : `Check-in saved for ${formatDateShort(selectedDate)}!`, 'success');
    } else {
      showToast('Failed to save', 'error');
    }
  };

  const hasExisting = !!checkinHistory[selectedDate];
  const scrollRef = useRef(null);

  return (
    <>
      {/* Date Navigator — 14 days, scrollable on mobile */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)' }}>
            {isToday ? 'Today' : formatDateShort(selectedDate)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--t3)' }}>
            {Object.keys(checkinHistory).length}/14 days
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            onClick={() => scrollRef.current?.scrollBy({ left: -120, behavior: 'smooth' })}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)',
              padding: '2px 1px', flexShrink: 0, display: 'flex',
            }}
          >
            <Icon name="chevron-left" size={12} />
          </button>

          <div
            ref={scrollRef}
            className="date-nav-scroll hide-scrollbar"
            style={{
              display: 'flex', gap: 3, overflowX: 'auto', flex: 1,
              scrollbarWidth: 'none', msOverflowStyle: 'none',
              scrollSnapType: 'x mandatory',
            }}
          >
            {days.map(d => {
              const done = !!checkinHistory[d.key];
              const isSelected = d.key === selectedDate;
              return (
                <button
                  key={d.key}
                  onClick={() => setSelectedDate(d.key)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    minWidth: 36, flex: '0 0 auto', padding: '4px 2px', borderRadius: 8, cursor: 'pointer',
                    border: isSelected ? '2px solid var(--gold)' : '2px solid transparent',
                    background: isSelected ? 'var(--gold-d)' : 'var(--b1)',
                    color: 'inherit', scrollSnapAlign: 'start',
                  }}
                >
                  <span style={{ fontSize: 8, color: d.isToday ? 'var(--gold)' : 'var(--t3)', fontWeight: d.isToday ? 700 : 400, lineHeight: 1 }}>
                    {d.dayLabel.slice(0, 2)}
                  </span>
                  <span style={{ fontSize: 13, fontFamily: 'var(--fd)', fontWeight: 600, margin: '1px 0', lineHeight: 1.1 }}>
                    {d.dateNum}
                  </span>
                  <div style={{
                    width: 5, height: 5, borderRadius: '50%', marginTop: 1,
                    background: done ? 'var(--green)' : 'var(--b3)',
                  }} />
                </button>
              );
            })}
          </div>

          <button
            onClick={() => scrollRef.current?.scrollBy({ left: 120, behavior: 'smooth' })}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)',
              padding: '2px 1px', flexShrink: 0, display: 'flex',
            }}
          >
            <Icon name="chevron-right" size={12} />
          </button>
        </div>
      </div>

      {/* Status banner */}
      {!isToday && (
        <div style={{
          padding: '6px 10px', marginBottom: 10, borderRadius: 8,
          background: hasExisting ? 'rgba(76,175,80,.08)' : 'rgba(255,165,0,.08)',
          border: `1px solid ${hasExisting ? 'rgba(76,175,80,.15)' : 'rgba(255,165,0,.15)'}`,
          fontSize: 11, color: hasExisting ? 'var(--green)' : 'var(--orange)',
          display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.3,
        }}>
          <span style={{ fontSize: 12, flexShrink: 0 }}>{hasExisting ? '✅' : '⚠️'}</span>
          {hasExisting
            ? `${formatDateShort(selectedDate)} — update below`
            : `${formatDateShort(selectedDate)} — fill in to catch up`
          }
        </div>
      )}

      {/* Mood — always 5 in a row */}
      <Card style={{ marginBottom: 10, padding: '12px 10px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', marginBottom: 8 }}>
          {isToday ? 'How are you feeling?' : formatDateShort(selectedDate)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
          {MOOD_OPTIONS.map((m, i) => (
            <div
              key={i}
              className={`mood-btn ${mood === i ? 'sel' : ''}`}
              onClick={() => setMood(i)}
              style={{ padding: '6px 2px', textAlign: 'center' }}
            >
              <span style={{ fontSize: 20, display: 'block', marginBottom: 2 }}>{m.emoji}</span>
              <span style={{ fontSize: 8, color: mood === i ? 'var(--gold)' : 'var(--t3)', lineHeight: 1 }}>{m.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Sliders — compact in one card */}
      <Card style={{ marginBottom: 10, padding: '12px 14px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Slider label="Sleep Quality" value={sleep} onChange={setSleep} color="var(--blue)" />
          <Slider label="Energy Level" value={energy} onChange={setEnergy} color="var(--green)" />
          <Slider label="Stress Level" value={stress} onChange={setStress} color="var(--orange)" />
        </div>
      </Card>

      {/* Notes — compact */}
      <Card style={{ marginBottom: 10, padding: '12px 14px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', marginBottom: 6 }}>Notes</div>
        <textarea
          className="t-area"
          placeholder="Any wins, struggles, or thoughts?"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          style={{ minHeight: 50, padding: '8px 10px', fontSize: 13 }}
        />
      </Card>

      <button className="btn btn-primary" style={{ width: '100%', padding: '12px' }} onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : hasExisting ? 'Update Check-in' : 'Save Check-in'}
      </button>
    </>
  );
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
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
