import { useState, useEffect, useMemo, useCallback } from 'react';
import { useCoachStore } from '../../stores/coachStore';
import { useUIStore } from '../../stores/uiStore';
import { Card } from '../../components/ui';
import { Icon } from '../../utils/icons';
import { fetchWeightLog, fetchProgressPhotos } from '../../services/progress';
import { fetchDailyCheckins, fetchWeeklyCheckins, saveCoachFeedback } from '../../services/checkins';
import { fetchMealPlan, fetchNutritionLogHistory } from '../../services/nutrition';
import { fetchWorkoutHistory } from '../../services/training';
import { analyzeWeightTrend, detectPlateau, suggestCalorieAdjustment, calculateAdherence, generateWeeklySummary } from '../../utils/coachingInsights';

// ── Helper: format goal ID ──
const GOAL_LABELS = { cut: 'Cut', 'lean-bulk': 'Lean Bulk', recomp: 'Recomp', maintenance: 'Maintenance', 'competition-prep': 'Comp Prep' };
function goalLabel(g) { return GOAL_LABELS[g] || g || 'Not set'; }

// ── Mini weight chart (sparkline) ──
function WeightSparkline({ data }) {
  if (!data || data.length < 2) return <div style={{ fontSize: 11, color: 'var(--t3)' }}>Not enough data</div>;

  const w = 280, h = 80, pad = 4;
  const weights = data.map(d => d.weight);
  const min = Math.min(...weights) - 0.5;
  const max = Math.max(...weights) + 0.5;
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (d.weight - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  });

  const last = data[data.length - 1];
  const first = data[0];
  const change = last.weight - first.weight;

  return (
    <div>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
        <polyline fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points.join(' ')} />
        {data.map((d, i) => {
          const x = pad + (i / (data.length - 1)) * (w - pad * 2);
          const y = pad + (1 - (d.weight - min) / range) * (h - pad * 2);
          return <circle key={i} cx={x} cy={y} r={2.5} fill="var(--gold)" opacity={0.6} />;
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>
        <span>{first.date}</span>
        <span style={{ color: change < 0 ? 'var(--green)' : change > 0 ? 'var(--red, #e74c3c)' : 'var(--t2)', fontWeight: 600 }}>
          {change > 0 ? '+' : ''}{change.toFixed(1)} kg
        </span>
        <span>{last.date}</span>
      </div>
    </div>
  );
}

// ── Adherence ring ──
function AdherenceRing({ value, label, color, size = 56 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c3)" strokeWidth="4" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fill="var(--t1)" fontSize="13" fontWeight="600" fontFamily="var(--fd)">{value}%</text>
      </svg>
      <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ── Photo pair (side by side) ──
function PhotoPair({ current, previous }) {
  if (!current && !previous) return null;
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {[previous, current].map((photo, idx) => (
        <div key={idx} style={{ flex: 1, position: 'relative' }}>
          {photo ? (
            <>
              <img src={photo.url} alt={photo.pose} style={{ width: '100%', borderRadius: 8, aspectRatio: '3/4', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', bottom: 6, left: 6, background: 'rgba(0,0,0,0.7)', padding: '2px 8px', borderRadius: 4, fontSize: 9, color: '#fff' }}>
                {idx === 0 ? 'Before' : 'Current'} · {photo.date}
              </div>
            </>
          ) : (
            <div style={{ aspectRatio: '3/4', background: 'var(--c2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--t3)' }}>
              No photo
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════
// Main: WeeklyReviewScreen
// ══════════════════════════════════════
export default function WeeklyReviewScreen() {
  const { clients } = useCoachStore();
  const { showToast } = useUIStore();

  // Queue state
  const [queue, setQueue] = useState([]); // client IDs with pending weekly check-ins
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  // Per-client data
  const [clientData, setClientData] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [macroAdjust, setMacroAdjust] = useState(null);

  // Build review queue from clients
  useEffect(() => {
    if (!clients?.length) { setLoading(false); return; }
    // All clients go in the queue — we'll load their latest weekly check-in
    const ids = clients.map(c => c.client_id || c.id).filter(Boolean);
    setQueue(ids);
    setCurrentIdx(0);
    setLoading(false);
  }, [clients]);

  const currentClientId = queue[currentIdx];
  const currentClient = clients?.find(c => (c.client_id || c.id) === currentClientId);

  // Load all data for current client
  useEffect(() => {
    if (!currentClientId) return;
    setClientData(null);
    setFeedback('');
    setMacroAdjust(null);

    (async () => {
      try {
        const results = await Promise.allSettled([
          fetchWeightLog(currentClientId),
          fetchDailyCheckins(currentClientId, 14),
          fetchWeeklyCheckins(currentClientId),
          fetchNutritionLogHistory(currentClientId, 14),
          fetchWorkoutHistory(currentClientId),
          fetchProgressPhotos(currentClientId),
          fetchMealPlan(currentClientId),
        ]);
        const val = (i, fallback) => results[i].status === 'fulfilled' ? (results[i].value ?? fallback) : fallback;
        const weightLog = val(0, []);
        const dailyCheckins = val(1, []);
        const weeklyCheckins = val(2, []);
        const nutritionLog = val(3, []);
        const workoutHistory = val(4, []);
        const photos = val(5, []);
        const mealPlan = val(6, null);
        results.forEach((r, i) => { if (r.status === 'rejected') console.warn('[WeeklyReview] fetch', i, 'failed:', r.reason); });

        // Safe wrapper — logs which step failed but never throws
        const safe = (label, fn, fallback) => {
          try { return fn(); } catch (e) { console.warn('[WeeklyReview]', label, 'failed:', e); return fallback; }
        };

        // Latest weekly check-in
        const latestWeekly = Array.isArray(weeklyCheckins) && weeklyCheckins.length ? weeklyCheckins[weeklyCheckins.length - 1] : null;

        // Weight analysis
        const weightTrend = safe('analyzeWeightTrend', () => analyzeWeightTrend(weightLog, { days: 14 }), null);
        const plateau = safe('detectPlateau', () => detectPlateau(weightLog), null);

        // Last 7 days of daily checkins
        const today = new Date();
        const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
        const weekStr = weekAgo.toISOString().slice(0, 10);
        const thisWeekDaily = (Array.isArray(dailyCheckins) ? dailyCheckins : []).filter(c => c?.date && c.date >= weekStr);

        // Adherence
        const nutritionDays = (Array.isArray(nutritionLog) ? nutritionLog : []).filter(n => n?.date && n.date >= weekStr).length;
        const now = new Date();
        const weekAgoDate = new Date(now); weekAgoDate.setDate(weekAgoDate.getDate() - 7);
        const weekAgoStr = weekAgoDate.toISOString().slice(0, 10);
        const workoutDays = (Array.isArray(workoutHistory) ? workoutHistory : []).filter(w => {
          const d = w?.date || (typeof w?.created_at === 'string' ? w.created_at.slice(0, 10) : null);
          return d && d >= weekAgoStr;
        }).length;
        const checkinDays = thisWeekDaily.length;
        const adherence = safe('calculateAdherence', () => calculateAdherence({ nutritionDays, workoutDays, checkinDays }), 0);

        // Calorie suggestion
        const currentCalories = mealPlan?.targets?.calories || null;
        const calSuggestions = safe('suggestCalorieAdjustment', () => suggestCalorieAdjustment(currentClient?.goal, weightTrend, currentCalories), null);

        // Photos — latest and 4 weeks ago
        const sortedPhotos = (Array.isArray(photos) ? photos : [])
          .filter(p => p && typeof p.date === 'string')
          .sort((a, b) => a.date.localeCompare(b.date));
        const latestPhotos = {};
        const prevPhotos = {};
        const fourWeeksAgo = new Date(); fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
        const fourWeeksStr = fourWeeksAgo.toISOString().slice(0, 10);

        for (const p of sortedPhotos) {
          const pose = p.pose || 'front';
          if (p.date >= weekStr) latestPhotos[pose] = p;
          else if (p.date >= fourWeeksStr) prevPhotos[pose] = p;
        }

        // Weekly summary
        const stepEntries = thisWeekDaily.filter(d => d?.steps > 0);
        const stepAvg = stepEntries.length ? stepEntries.reduce((s, d) => s + (d.steps || 0), 0) / stepEntries.length : 0;
        const summary = safe('generateWeeklySummary', () => generateWeeklySummary({
          weightLog, nutritionDays, workoutDays, checkinDays, stepAvg,
          stepGoal: currentClient?.step_goal || 10000,
          goal: currentClient?.goal,
        }), { highlights: [], improvements: [] });

        // Mood averages
        const moodValues = { 'Unstoppable': 5, 'Good': 4, 'Neutral': 3, 'Low': 2, 'Struggling': 1 };
        const moods = thisWeekDaily.filter(d => d?.mood).map(d => moodValues[d.mood] || 3);
        const avgMood = moods.length ? (moods.reduce((s, m) => s + m, 0) / moods.length).toFixed(1) : null;
        const sleepEntries = thisWeekDaily.filter(d => typeof d?.sleep === 'number');
        const avgSleep = sleepEntries.length ? (sleepEntries.reduce((s, d) => s + d.sleep, 0) / sleepEntries.length).toFixed(1) : null;
        const energyEntries = thisWeekDaily.filter(d => typeof d?.energy === 'number');
        const avgEnergy = energyEntries.length ? (energyEntries.reduce((s, d) => s + d.energy, 0) / energyEntries.length).toFixed(1) : null;

        setClientData({
          weightLog: Array.isArray(weightLog) ? weightLog.slice(-14) : [],
          weightTrend,
          plateau,
          latestWeekly,
          thisWeekDaily,
          adherence,
          nutritionDays,
          workoutDays,
          checkinDays,
          calSuggestions,
          mealPlan,
          latestPhotos,
          prevPhotos,
          summary,
          avgMood,
          avgSleep,
          avgEnergy,
          stepAvg: Math.round(stepAvg),
          workoutHistory: (Array.isArray(workoutHistory) ? workoutHistory : []).slice(-5),
        });

        // Pre-fill feedback if coach already responded
        if (latestWeekly?.coach_feedback) setFeedback(latestWeekly.coach_feedback);
      } catch (err) {
        console.error('[WeeklyReview] load error:', err);
        showToast('Failed to load client data', 'error');
        setClientData({
          weightLog: [], weightTrend: null, plateau: null, latestWeekly: null,
          thisWeekDaily: [], adherence: 0, nutritionDays: 0, workoutDays: 0, checkinDays: 0,
          calSuggestions: null, mealPlan: null, latestPhotos: {}, prevPhotos: {},
          summary: { highlights: [], improvements: [] },
          avgMood: null, avgSleep: null, avgEnergy: null, stepAvg: 0, workoutHistory: [],
        });
      }
    })();
  }, [currentClientId]);

  // Save feedback
  const handleSaveFeedback = async () => {
    if (!feedback.trim() || !clientData?.latestWeekly?.id) return;
    setSaving(true);
    const ok = await saveCoachFeedback(clientData.latestWeekly.id, feedback.trim(), 'weekly');
    setSaving(false);
    if (ok) {
      showToast('Feedback saved', 'success');
    } else {
      showToast('Failed to save feedback', 'error');
    }
  };

  // Navigate queue
  const goNext = () => { if (currentIdx < queue.length - 1) setCurrentIdx(currentIdx + 1); };
  const goPrev = () => { if (currentIdx > 0) setCurrentIdx(currentIdx - 1); };

  // ── Empty / loading states ──
  if (loading) return <div className="screen active" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><div style={{ opacity: 0.3 }}>Loading...</div></div>;

  if (!queue.length) {
    return (
      <div className="screen active" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 12 }}>
        <Icon name="check-circle" size={40} style={{ opacity: 0.15 }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t2)' }}>No Clients to Review</div>
        <div style={{ fontSize: 13, color: 'var(--t3)', maxWidth: 280, textAlign: 'center', lineHeight: 1.5 }}>
          Add clients first, then come back here to review their weekly progress.
        </div>
      </div>
    );
  }

  const d = clientData; // shorthand
  const wc = d?.latestWeekly; // weekly check-in

  return (
    <div className="screen active">
      {/* Header with navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="icon-btn" onClick={goPrev} disabled={currentIdx === 0} style={{ opacity: currentIdx === 0 ? 0.3 : 1 }}>
            <Icon name="chevron-left" size={14} />
          </button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{currentClient?.client_name || currentClient?.name || 'Client'}</div>
            <div style={{ fontSize: 11, color: 'var(--t3)' }}>
              {goalLabel(currentClient?.goal)} · Client {currentIdx + 1} of {queue.length}
            </div>
          </div>
          <button className="icon-btn" onClick={goNext} disabled={currentIdx === queue.length - 1} style={{ opacity: currentIdx === queue.length - 1 ? 0.3 : 1 }}>
            <Icon name="chevron-right" size={14} />
          </button>
        </div>
        {wc && (
          <div style={{
            padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600,
            background: wc.status === 'reviewed' ? 'var(--green-d, rgba(46,204,113,0.15))' : 'var(--gold-d)',
            color: wc.status === 'reviewed' ? 'var(--green)' : 'var(--gold)',
          }}>
            {wc.status === 'reviewed' ? 'Reviewed' : 'Pending'}
          </div>
        )}
      </div>

      {/* Loading data state */}
      {!d && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
          <div style={{ animation: 'pulse 1.5s infinite' }}>Loading client data...</div>
        </div>
      )}

      {d && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Row 1: Key metrics ── */}
          <div className="g4">
            <Card>
              <div className="kl">Weight Trend</div>
              <div style={{ marginTop: 8 }}>
                <WeightSparkline data={d.weightLog} />
              </div>
              {d.weightTrend && (
                <div style={{ fontSize: 11, marginTop: 6, color: 'var(--t2)' }}>
                  {d.weightTrend.direction === 'losing' ? '↓' : d.weightTrend.direction === 'gaining' ? '↑' : '→'}{' '}
                  {d.weightTrend.weeklyRate > 0 ? '+' : ''}{d.weightTrend.weeklyRate} kg/week
                  {d.plateau?.detected && <span style={{ color: 'var(--gold)', marginLeft: 6 }}>⚠ Plateau</span>}
                </div>
              )}
            </Card>
            <Card>
              <div className="kl">Adherence</div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 10 }}>
                <AdherenceRing value={d.adherence} label="Overall" color="var(--gold)" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 10, fontSize: 10, color: 'var(--t3)' }}>
                <span>Nutrition: {d.nutritionDays}/7</span>
                <span>Workouts: {d.workoutDays}</span>
                <span>Check-ins: {d.checkinDays}/7</span>
              </div>
            </Card>
          </div>

          {/* ── Row 2: Daily averages ── */}
          <div className="g4">
            {d.avgMood && <Card><div className="kl">Avg Mood</div><div style={{ fontFamily: 'var(--fd)', fontSize: 22, marginTop: 6, color: 'var(--gold)' }}>{d.avgMood}</div><div style={{ fontSize: 10, color: 'var(--t3)' }}>/5</div></Card>}
            {d.avgSleep && <Card><div className="kl">Avg Sleep</div><div style={{ fontFamily: 'var(--fd)', fontSize: 22, marginTop: 6, color: 'var(--blue, #3498db)' }}>{d.avgSleep}</div><div style={{ fontSize: 10, color: 'var(--t3)' }}>/10</div></Card>}
            {d.avgEnergy && <Card><div className="kl">Avg Energy</div><div style={{ fontFamily: 'var(--fd)', fontSize: 22, marginTop: 6, color: 'var(--green)' }}>{d.avgEnergy}</div><div style={{ fontSize: 10, color: 'var(--t3)' }}>/10</div></Card>}
            <Card><div className="kl">Steps</div><div style={{ fontFamily: 'var(--fd)', fontSize: 22, marginTop: 6, color: 'var(--orange, #e67e22)' }}>{d.stepAvg ? d.stepAvg.toLocaleString() : '—'}</div><div style={{ fontSize: 10, color: 'var(--t3)' }}>avg/day</div></Card>
          </div>

          {/* ── Weekly check-in answers ── */}
          {wc && (
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Icon name="clipboard" size={14} style={{ color: 'var(--gold)' }} />
                <div className="kl" style={{ margin: 0 }}>Weekly Check-in (Week {wc.week_number})</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {wc.what_went_well && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--green)', marginBottom: 3 }}>What went well</div>
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--t2)' }}>{wc.what_went_well}</div>
                  </div>
                )}
                {wc.biggest_struggle && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--red, #e74c3c)', marginBottom: 3 }}>Biggest struggle</div>
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--t2)' }}>{wc.biggest_struggle}</div>
                  </div>
                )}
                {wc.what_to_improve && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--blue, #3498db)', marginBottom: 3 }}>What to improve</div>
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--t2)' }}>{wc.what_to_improve}</div>
                  </div>
                )}
                {wc.questions_for_coach && (
                  <div style={{ padding: 10, background: 'var(--gold-d)', borderRadius: 8, borderLeft: '3px solid var(--gold)' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gold)', marginBottom: 3 }}>Questions for you</div>
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--t1)' }}>{wc.questions_for_coach}</div>
                  </div>
                )}
                {wc.pain && wc.pain !== 'no' && (
                  <div style={{ padding: 10, background: 'rgba(231,76,60,0.08)', borderRadius: 8, borderLeft: '3px solid var(--red, #e74c3c)' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--red, #e74c3c)', marginBottom: 3 }}>
                      Pain: {wc.pain === 'yes-major' ? 'Major' : 'Minor'}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--t2)' }}>{wc.pain_detail || 'No details provided'}</div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 10, color: 'var(--t3)', paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                  {wc.nutrition_adherence != null && <span>Nutrition: {wc.nutrition_adherence}/10</span>}
                  {wc.workouts_completed != null && <span>Workouts: {wc.workouts_completed}</span>}
                  {wc.water_avg != null && <span>Water: {wc.water_avg}L/day</span>}
                  {wc.digestion != null && <span>Digestion: {wc.digestion}/10</span>}
                  {wc.motivation != null && <span>Motivation: {wc.motivation}/10</span>}
                </div>
              </div>
            </Card>
          )}

          {!wc && (
            <Card>
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--t3)', fontSize: 13 }}>
                <Icon name="clipboard" size={24} style={{ opacity: 0.15, marginBottom: 8 }} />
                <div>No weekly check-in submitted yet</div>
              </div>
            </Card>
          )}

          {/* ── Coaching suggestions ── */}
          {(d.calSuggestions?.length > 0 || d.summary?.improvements?.length > 0) && (
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Icon name="zap" size={14} style={{ color: 'var(--gold)' }} />
                <div className="kl" style={{ margin: 0 }}>Coaching Suggestions</div>
              </div>
              {d.calSuggestions?.map((s, i) => (
                <div key={i} style={{
                  padding: 10, marginBottom: 6, borderRadius: 8,
                  background: s.priority === 'high' ? 'rgba(231,76,60,0.08)' : 'var(--c2)',
                  borderLeft: `3px solid ${s.priority === 'high' ? 'var(--red, #e74c3c)' : s.priority === 'medium' ? 'var(--gold)' : 'var(--c4, var(--t3))'}`,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
                    {s.type === 'calories' ? '🔥' : '🏃'} {s.action === 'increase' ? 'Increase' : 'Decrease'} {s.type} by {s.amount}{s.type === 'calories' ? ' kcal' : ' steps'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', lineHeight: 1.4 }}>{s.reason}</div>
                  {s.newTarget && <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, color: 'var(--gold)' }}>New target: {s.newTarget} kcal</div>}
                </div>
              ))}
              {d.summary?.improvements?.map((imp, i) => (
                <div key={`imp-${i}`} style={{ fontSize: 12, color: 'var(--t2)', padding: '6px 0', lineHeight: 1.4 }}>
                  → {imp}
                </div>
              ))}
              {d.summary?.highlights?.map((h, i) => (
                <div key={`hi-${i}`} style={{ fontSize: 12, color: 'var(--green)', padding: '4px 0', lineHeight: 1.4 }}>
                  ✓ {h}
                </div>
              ))}
            </Card>
          )}

          {/* ── Progress photos ── */}
          {Object.keys(d.latestPhotos).length > 0 && (
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Icon name="camera" size={14} style={{ color: 'var(--gold)' }} />
                <div className="kl" style={{ margin: 0 }}>Progress Photos</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.keys(d.latestPhotos).map(pose => (
                  <div key={pose}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t3)', marginBottom: 6, textTransform: 'capitalize' }}>{pose}</div>
                    <PhotoPair current={d.latestPhotos[pose]} previous={d.prevPhotos[pose]} />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── Recent workouts ── */}
          {d.workoutHistory?.length > 0 && (
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Icon name="dumbbell" size={14} style={{ color: 'var(--gold)' }} />
                <div className="kl" style={{ margin: 0 }}>Recent Workouts</div>
              </div>
              {d.workoutHistory.map((w, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < d.workoutHistory.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 12 }}>
                  <span style={{ color: 'var(--t2)' }}>{w.day_name || w.name || `Workout ${i + 1}`}</span>
                  <div style={{ display: 'flex', gap: 12, color: 'var(--t3)', fontSize: 11 }}>
                    {w.total_volume != null && <span>{Math.round(w.total_volume).toLocaleString()} kg</span>}
                    <span>{w.date || w.created_at?.slice(0, 10)}</span>
                  </div>
                </div>
              ))}
            </Card>
          )}

          {/* ── Coach feedback ── */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Icon name="message" size={14} style={{ color: 'var(--gold)' }} />
              <div className="kl" style={{ margin: 0 }}>Your Feedback</div>
            </div>
            <textarea
              className="form-inp"
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="Write your weekly coaching feedback here... Address their questions, acknowledge wins, give actionable next-week targets."
              rows={5}
              style={{ width: '100%', resize: 'vertical', fontSize: 13, lineHeight: 1.6 }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                className="btn btn-primary"
                onClick={handleSaveFeedback}
                disabled={saving || !feedback.trim() || !wc?.id}
                style={{ flex: 1 }}
              >
                {saving ? 'Saving...' : wc?.coach_feedback ? 'Update Feedback' : 'Send Feedback'}
              </button>
              {currentIdx < queue.length - 1 && (
                <button className="btn btn-secondary" onClick={goNext}>
                  Next Client <Icon name="chevron-right" size={10} />
                </button>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
