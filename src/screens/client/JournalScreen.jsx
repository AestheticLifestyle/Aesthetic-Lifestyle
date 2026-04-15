import { useState, useEffect, useMemo, useRef } from 'react';
import { useT } from '../../i18n';
import { Card, PageSkeleton } from '../../components/ui';
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
const MOOD_KEYS = {
  'Unstoppable': 'moodUnstoppable',
  'Good': 'moodGood',
  'Neutral': 'moodNeutral',
  'Low': 'moodLow',
  'Struggling': 'moodStruggling',
};

const WEEKLY_MOOD_KEYS = {
  'Great Week': 'weekGreat',
  'Good Week': 'weekGood',
  'Average': 'weekAverage',
  'Tough Week': 'weekTough',
  'Terrible Week': 'weekTerrible',
};

const STEPS_OPTION_KEYS = {
  'Every Day': 'stepsEveryDay',
  'Most Days': 'stepsMostDays',
  'Some Days': 'stepsSomeDays',
  'Rarely': 'stepsRarely',
};

const PAIN_OPTION_KEYS = {
  'no': 'noPain',
  'yes-minor': 'yesMinor',
  'yes-major': 'yesMajor',
};

function createMoodOptions(t) {
  return [
    { emoji: '\ud83d\udcaa', label: t('moodUnstoppable'), key: 'moodUnstoppable' },
    { emoji: '\ud83d\ude0a', label: t('moodGood'), key: 'moodGood' },
    { emoji: '\ud83d\ude10', label: t('moodNeutral'), key: 'moodNeutral' },
    { emoji: '\ud83d\ude14', label: t('moodLow'), key: 'moodLow' },
    { emoji: '\ud83d\ude29', label: t('moodStruggling'), key: 'moodStruggling' },
  ];
}

function createWeeklyMoods(t) {
  return [
    t('weekGreat'),
    t('weekGood'),
    t('weekAverage'),
    t('weekTough'),
    t('weekTerrible'),
  ];
}

function createStepsOptions(t) {
  return [
    t('stepsEveryDay'),
    t('stepsMostDays'),
    t('stepsSomeDays'),
    t('stepsRarely'),
  ];
}

function createPainOptions(t) {
  return [
    { value: 'no', label: t('noPain') },
    { value: 'yes-minor', label: t('yesMinor') },
    { value: 'yes-major', label: t('yesMajor') },
  ];
}

// ── Slider component (compact) ──
function Slider({ label, value, onChange, color, min = 1, max = 10, labelKey, t }) {
  const translatedLabel = labelKey && t ? t(labelKey) : label;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)' }}>{translatedLabel}</span>
        <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--fd)', color, lineHeight: 1 }}>
          {value}<span style={{ fontSize: 9, color: 'var(--t3)', marginLeft: 1 }}>/{max}</span>
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
  const t = useT();
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
  const MOOD_OPTIONS = createMoodOptions(t);

  // Generate last 7 days
  const days = useMemo(() => {
    const result = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
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
    fetchDailyCheckins(clientId, 7).then(data => {
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
    if (!user?.id) {
      showToast(t('pleaseSignInFirst'), 'error');
      return;
    }
    if (!clientId) {
      showToast(t('noClientId'), 'error');
      return;
    }
    if (mood === null) {
      showToast(t('selectMoodBeforeSaving'), 'error');
      return;
    }
    setSaving(true);
    const result = await saveDailyCheckin({
      client_id: clientId,
      date: selectedDate,
      mood: MOOD_OPTIONS[mood].label,
      sleep,
      energy,
      stress,
      note: notes || null,
    });
    setSaving(false);
    // Back-compat: result used to be a boolean
    const ok = result === true || (result && result.ok === true);
    if (ok) {
      setCheckinHistory(prev => ({
        ...prev,
        [selectedDate]: { mood: MOOD_OPTIONS[mood]?.label, sleep, energy, stress, note: notes, date: selectedDate },
      }));
      showToast(isToday ? t('checkinSaved').replace('{date}', formatDateShort(selectedDate)) : t('checkinSaved').replace('{date}', formatDateShort(selectedDate)), 'success');
    } else {
      const msg = (result && result.error) ? `${t('failedToSaveError').replace('{error}', result.error)}` : t('failedToSave');
      showToast(msg, 'error');
    }
  };

  const hasExisting = !!checkinHistory[selectedDate];

  return (
    <>
      {/* 7-day strip — no scrolling needed */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
        {days.map(d => {
          const done = !!checkinHistory[d.key];
          const sel = d.key === selectedDate;
          return (
            <button
              key={d.key}
              onClick={() => setSelectedDate(d.key)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '4px 0', borderRadius: 8, cursor: 'pointer',
                border: sel ? '2px solid var(--gold)' : '2px solid transparent',
                background: sel ? 'var(--gold-d)' : 'var(--b1)',
                color: 'inherit',
              }}
            >
              <span style={{ fontSize: 9, color: d.isToday ? 'var(--gold)' : 'var(--t3)', fontWeight: d.isToday ? 700 : 400, lineHeight: 1 }}>
                {d.dayLabel.slice(0, 2)}
              </span>
              <span style={{ fontSize: 14, fontFamily: 'var(--fd)', fontWeight: 600, lineHeight: 1.3 }}>
                {d.dateNum}
              </span>
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: done ? 'var(--green)' : 'var(--b3)',
              }} />
            </button>
          );
        })}
      </div>

      {/* Status banner (only for past days) */}
      {!isToday && (
        <div style={{
          padding: '5px 10px', marginBottom: 8, borderRadius: 6,
          background: hasExisting ? 'rgba(76,175,80,.08)' : 'rgba(255,165,0,.08)',
          border: `1px solid ${hasExisting ? 'rgba(76,175,80,.15)' : 'rgba(255,165,0,.15)'}`,
          fontSize: 11, color: hasExisting ? 'var(--green)' : 'var(--orange)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 11 }}>{hasExisting ? '✅' : '⚠️'}</span>
          {hasExisting ? t('checkinExists') : t('noCheckinYet')}
        </div>
      )}

      {/* Mood — 5 columns grid, always fits */}
      <div style={{
        background: 'var(--s1)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '10px 8px', marginBottom: 8,
      }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
          {t('mood')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
          {MOOD_OPTIONS.map((m, i) => {
            const sel = mood === i;
            return (
              <button
                key={i}
                onClick={() => setMood(i)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '6px 0', borderRadius: 8, cursor: 'pointer',
                  border: sel ? '1.5px solid var(--gold)' : '1.5px solid var(--border)',
                  background: sel ? 'var(--gold-d)' : 'var(--s2)',
                  color: 'inherit',
                }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>{m.emoji}</span>
                <span style={{ fontSize: 8, color: sel ? 'var(--gold)' : 'var(--t3)', marginTop: 2, lineHeight: 1 }}>{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliders — all in one compact block */}
      <div style={{
        background: 'var(--s1)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '10px 12px', marginBottom: 8,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <Slider label="Sleep" labelKey="sleep" value={sleep} onChange={setSleep} color="var(--blue)" t={t} />
        <Slider label="Energy" labelKey="energy" value={energy} onChange={setEnergy} color="var(--green)" t={t} />
        <Slider label="Stress" labelKey="stress" value={stress} onChange={setStress} color="var(--orange)" t={t} />
      </div>

      {/* Notes — minimal */}
      <div style={{
        background: 'var(--s1)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '10px 12px', marginBottom: 8,
      }}>
        <textarea
          className="t-area"
          placeholder={t('notesOptional')}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          style={{ minHeight: 44, padding: '8px 10px', fontSize: 13, marginBottom: 0 }}
        />
      </div>

      <button className="btn btn-primary" style={{ width: '100%', padding: '11px' }} onClick={handleSave} disabled={saving}>
        {saving ? t('saving') : hasExisting ? t('updateCheckin') : t('saveCheckin')}
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
  const t = useT();
  const { user } = useAuthStore();
  const { showToast } = useUIStore();
  const WEEKLY_MOODS = createWeeklyMoods(t);
  const STEPS_OPTIONS = createStepsOptions(t);
  const PAIN_OPTIONS = createPainOptions(t);

  const currentWeekNum = getWeekNumber(new Date());
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week, -1 = last week, etc.
  const weekNum = currentWeekNum + weekOffset;
  const isCurrentWeek = weekOffset === 0;

  // Compute the date range for the displayed week
  const weekRange = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay() || 7; // Mon=1
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek - 1) + (weekOffset * 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `${fmt(monday)} – ${fmt(sunday)}`;
  }, [weekOffset]);

  // Date to save for this week (the Monday of that week)
  const weekDate = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek - 1) + (weekOffset * 7));
    return monday.toISOString().slice(0, 10);
  }, [weekOffset]);

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
  const [hasExisting, setHasExisting] = useState(false);

  // Reset form and reload when week changes
  useEffect(() => {
    if (!user?.id) return;
    setLoaded(false);
    setHasExisting(false);
    setExistingFeedback(null);
    // Reset form to defaults
    setWeeklyMood(null); setSleepQuality(7); setDigestion(7); setEnergyLevel(7);
    setPain('no'); setPainDetail(''); setNutritionAdherence(7); setWorkoutsCompleted(0);
    setWaterAvg(''); setStepsGoal(null); setBiggestStruggle(''); setWhatWentWell('');
    setWhatToImprove(''); setMotivation(7); setQuestionsForCoach('');

    fetchWeeklyCheckins(getClientId()).then(data => {
      const thisWeek = (data || []).find(c => c.week_number === weekNum);
      if (thisWeek) {
        setHasExisting(true);
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
    if (!user?.id) {
      showToast(t('pleaseSignInFirst'), 'error');
      return;
    }
    const clientId = getClientId();
    if (!clientId) {
      showToast(t('noClientId'), 'error');
      return;
    }
    if (!weeklyMood) {
      showToast(t('selectWeeklyMoodBeforeSaving'), 'error');
      return;
    }
    setSaving(true);
    const result = await saveWeeklyCheckin(clientId, {
      week_number: weekNum,
      date: weekDate,
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
    const ok = result === true || (result && result.ok === true);
    if (ok) {
      setHasExisting(true);
      showToast(isCurrentWeek ? t('checkinSaved').replace('{date}', '') : t('checkinSaved').replace('{date}', ''), 'success');
    } else {
      const msg = (result && result.error) ? `${t('failedToSaveError').replace('{error}', result.error)}` : t('failedToSave');
      showToast(msg, 'error');
    }
  };

  if (!loaded) {
    return <PageSkeleton />;
  }

  return (
    <>
      {/* Week navigator with arrows */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--s1)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '10px 12px', marginBottom: 10,
      }}>
        <button
          onClick={() => setWeekOffset(o => o - 1)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)',
            padding: '4px 6px', display: 'flex', borderRadius: 6,
          }}
        >
          <Icon name="chevron-left" size={18} />
        </button>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontFamily: 'var(--fd)', fontSize: 20, color: isCurrentWeek ? 'var(--gold)' : 'var(--t1)', lineHeight: 1.2 }}>
            {isCurrentWeek ? 'This Week' : `Week ${weekNum}`}
          </div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{weekRange}</div>
        </div>
        <button
          onClick={() => setWeekOffset(o => Math.min(0, o + 1))}
          style={{
            background: 'none', border: 'none', cursor: isCurrentWeek ? 'default' : 'pointer',
            color: isCurrentWeek ? 'var(--b3)' : 'var(--t3)',
            padding: '4px 6px', display: 'flex', borderRadius: 6,
            opacity: isCurrentWeek ? 0.3 : 1,
          }}
          disabled={isCurrentWeek}
        >
          <Icon name="chevron-right" size={18} />
        </button>
      </div>

      {/* Status banner for past weeks */}
      {!isCurrentWeek && (
        <div style={{
          padding: '5px 10px', marginBottom: 8, borderRadius: 6,
          background: hasExisting ? 'rgba(76,175,80,.08)' : 'rgba(255,165,0,.08)',
          border: `1px solid ${hasExisting ? 'rgba(76,175,80,.15)' : 'rgba(255,165,0,.15)'}`,
          fontSize: 11, color: hasExisting ? 'var(--green)' : 'var(--orange)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 11 }}>{hasExisting ? '✅' : '⚠️'}</span>
          {hasExisting ? t('checkinExists') : t('noCheckinYet')}
        </div>
      )}

      {/* Coach feedback from previous submission */}
      {existingFeedback && (
        <Card style={{ marginBottom: 14, border: '1px solid var(--gold)' }}>
          <div className="kl" style={{ marginBottom: 6 }}>{t('coachFeedback')}</div>
          <div style={{ fontSize: 13, color: 'var(--t1)', lineHeight: 1.5 }}>{existingFeedback}</div>
        </Card>
      )}

      {/* Overall mood */}
      <Card title={t('howWasYourWeek')} style={{ marginBottom: 14 }}>
        <PillSelector options={WEEKLY_MOODS} value={weeklyMood} onChange={setWeeklyMood} />
      </Card>

      {/* Body & Recovery */}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 8, marginTop: 6 }}>{t('bodyAndRecovery')}</div>
      <div className="g2" style={{ marginBottom: 14 }}>
        <Slider label="Sleep Quality" labelKey="sleepQuality" value={sleepQuality} onChange={setSleepQuality} color="var(--blue)" t={t} />
        <Slider label="Digestion" labelKey="digestion" value={digestion} onChange={setDigestion} color="var(--green)" t={t} />
        <Slider label="Energy" labelKey="energy" value={energyLevel} onChange={setEnergyLevel} color="var(--orange)" t={t} />
        <Slider label="Motivation" labelKey="motivation" value={motivation} onChange={setMotivation} color="var(--gold)" t={t} />
      </div>

      {/* Pain */}
      <Card title={t('painOrDiscomfort')} style={{ marginBottom: 14 }}>
        <PillSelector options={PAIN_OPTIONS} value={pain} onChange={setPain} small />
        {pain !== 'no' && (
          <textarea
            className="t-area"
            placeholder={t('painDetails')}
            value={painDetail}
            onChange={e => setPainDetail(e.target.value)}
            rows={2}
            style={{ marginTop: 10 }}
          />
        )}
      </Card>

      {/* Adherence */}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 8, marginTop: 6 }}>{t('adherence')}</div>
      <div className="g2" style={{ marginBottom: 14 }}>
        <Slider label="Nutrition Adherence" labelKey="nutritionAdherence" value={nutritionAdherence} onChange={setNutritionAdherence} color="var(--green)" t={t} />
        <Card>
          <div className="kl">{t('workoutsCompleted')}</div>
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
          <div className="kl">{t('avgWater')}</div>
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
          <div className="kl">{t('stepsGoal')}</div>
          <div style={{ marginTop: 6 }}>
            <PillSelector options={STEPS_OPTIONS} value={stepsGoal} onChange={setStepsGoal} small />
          </div>
        </Card>
      </div>

      {/* Written responses */}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 8, marginTop: 6 }}>{t('reflection')}</div>

      <Card title={t('whatWentWell')} style={{ marginBottom: 14 }}>
        <textarea
          className="t-area"
          placeholder={t('whatWentWellPlaceholder')}
          value={whatWentWell}
          onChange={e => setWhatWentWell(e.target.value)}
          rows={3}
        />
      </Card>

      <Card title={t('biggestStruggle')} style={{ marginBottom: 14 }}>
        <textarea
          className="t-area"
          placeholder={t('biggestStrugglePlaceholder')}
          value={biggestStruggle}
          onChange={e => setBiggestStruggle(e.target.value)}
          rows={3}
        />
      </Card>

      <Card title={t('whatToImprove')} style={{ marginBottom: 14 }}>
        <textarea
          className="t-area"
          placeholder={t('whatToImprovePlaceholder')}
          value={whatToImprove}
          onChange={e => setWhatToImprove(e.target.value)}
          rows={2}
        />
      </Card>

      <Card title={t('questionsForCoach')} style={{ marginBottom: 14 }}>
        <textarea
          className="t-area"
          placeholder={t('questionsForCoachPlaceholder')}
          value={questionsForCoach}
          onChange={e => setQuestionsForCoach(e.target.value)}
          rows={2}
        />
      </Card>

      <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSave} disabled={saving}>
        {saving ? t('saving') : hasExisting ? t('updateCheckin') : t('saveWeeklyCheckin')}
      </button>
    </>
  );
}

// ══════════════════════════════════════
// Main — tabs for Daily / Weekly
// ══════════════════════════════════════
export default function JournalScreen() {
  const t = useT();
  const [tab, setTab] = useState('daily');

  return (
    <div className="screen active">
      {/* Tab switcher */}
      <div className="modal-tabs" style={{ marginBottom: 10 }}>
        <div className={`mtab ${tab === 'daily' ? 'active' : ''}`} onClick={() => setTab('daily')}>
          {t('dailyCheckinTitle')}
        </div>
        <div className={`mtab ${tab === 'weekly' ? 'active' : ''}`} onClick={() => setTab('weekly')}>
          {t('weeklyCheckinTitle')}
        </div>
      </div>

      {tab === 'daily' ? <DailyCheckin /> : <WeeklyCheckin />}
    </div>
  );
}
