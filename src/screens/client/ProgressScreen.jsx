import { useState, useMemo, useRef, useCallback } from 'react';
import { useClientStore } from '../../stores/clientStore';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { Card } from '../../components/ui';
import { Icon } from '../../utils/icons';
import { getTodayKey, formatShortDate } from '../../utils/constants';
import { saveWeight } from '../../services/progress';
import { saveMeasurement, uploadProgressPhoto } from '../../services/progress';

// ── Helpers ──
/** Resolve the correct client ID — uses override when coach is in client view */
function getClientId() {
  const authState = useAuthStore.getState();
  return authState.roleOverride
    ? (sessionStorage.getItem('overrideClientId') || authState.user?.id)
    : authState.user?.id;
}

function getWeekKey(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  return monday.toISOString().slice(0, 10);
}

function getWeekLabel(mondayStr) {
  const monday = new Date(mondayStr + 'T12:00:00');
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const today = new Date();
  const todayMonday = getWeekKey(today.toISOString().slice(0, 10));
  if (mondayStr === todayMonday) return 'This Week';
  const lastMonday = new Date(todayMonday + 'T12:00:00');
  lastMonday.setDate(lastMonday.getDate() - 7);
  if (mondayStr === lastMonday.toISOString().slice(0, 10)) return 'Last Week';
  return `${fmt(monday)} — ${fmt(sunday)}`;
}

function getWeekDates(mondayStr) {
  const dates = [];
  const monday = new Date(mondayStr + 'T12:00:00');
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// ── Week Navigator ──
function WeekNavigator({ weekMonday, onPrev, onNext, canNext }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 0', marginBottom: 14,
    }}>
      <button className="btn btn-secondary btn-sm" onClick={onPrev} style={{ padding: '6px 10px', minWidth: 0 }}>
        <Icon name="chevron-left" size={14} />
      </button>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: 0.5 }}>
          {getWeekLabel(weekMonday)}
        </div>
        <div style={{ fontSize: 10, color: 'var(--t3)' }}>
          {new Date(weekMonday + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          {' — '}
          {(() => {
            const sun = new Date(weekMonday + 'T12:00:00');
            sun.setDate(sun.getDate() + 6);
            return sun.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
          })()}
        </div>
      </div>
      <button
        className="btn btn-secondary btn-sm"
        onClick={onNext}
        disabled={!canNext}
        style={{ padding: '6px 10px', minWidth: 0, opacity: canNext ? 1 : 0.3 }}
      >
        <Icon name="chevron-right" size={14} />
      </button>
    </div>
  );
}

// ── Weight Chart ──
function WeightChart({ data, height = 120 }) {
  if (data.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: 12 }}>
        Log at least 2 weights to see your chart
      </div>
    );
  }

  const weights = data.map(d => d.weight);
  const min = Math.min(...weights) - 1;
  const max = Math.max(...weights) + 1;
  const range = max - min || 1;
  const w = 100;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = height - ((d.weight - min) / range) * (height - 20) - 10;
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <defs>
        <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${points.join(' ')} ${w},${height}`} fill="url(#wg)" />
      <polyline points={points.join(' ')} fill="none" stroke="var(--gold)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {data.length <= 30 && data.map((d, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = height - ((d.weight - min) / range) * (height - 20) - 10;
        return <circle key={i} cx={x} cy={y} r="2" fill="var(--gold)" vectorEffect="non-scaling-stroke" />;
      })}
    </svg>
  );
}

// ── Weight Section (this week's daily weights) ──
function WeightSection({ weightLog, weekDates }) {
  const { user } = useAuthStore();
  const { addWeight } = useClientStore();
  const { showToast } = useUIStore();
  const [editingDate, setEditingDate] = useState(null);
  const [inputVal, setInputVal] = useState('');
  const [saving, setSaving] = useState(false);

  const weekWeights = weekDates.map(d => {
    const entry = weightLog.find(w => w.date === d);
    return { date: d, weight: entry?.weight || null };
  });

  // Week-specific data for the chart and stats
  const weekEntries = weightLog.filter(w => weekDates.includes(w.date));
  const weekLatest = weekEntries.length ? weekEntries[weekEntries.length - 1] : null;
  const weekStart = weekEntries.length ? weekEntries[0] : null;
  const weekChange = weekLatest && weekStart && weekEntries.length >= 2
    ? (weekLatest.weight - weekStart.weight).toFixed(1)
    : null;

  // Overall stats for context
  const allTimeStart = weightLog.length ? weightLog[0] : null;
  const allTimeLatest = weightLog.length ? weightLog[weightLog.length - 1] : null;
  const totalChange = allTimeLatest && allTimeStart ? (allTimeLatest.weight - allTimeStart.weight).toFixed(1) : null;

  const handleSave = async (date) => {
    const w = parseFloat(inputVal);
    if (!w || w < 20 || w > 300) { showToast('Enter a valid weight', 'error'); return; }
    setSaving(true);
    addWeight(date, w);
    const ok = await saveWeight(getClientId(), date, w);
    setSaving(false);
    setEditingDate(null);
    setInputVal('');
    showToast(ok ? 'Weight logged!' : 'Failed to save', ok ? 'success' : 'error');
  };

  const today = getTodayKey();

  return (
    <Card title="Body Weight" subtitle={weekLatest ? `Latest: ${weekLatest.weight} kg` : 'No weigh-ins this week'}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 12 }}>
        <span className="kv">{weekLatest?.weight ?? '—'}</span>
        <span className="ku">kg</span>
        {weekChange && (
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 4,
            background: parseFloat(weekChange) <= 0 ? 'rgba(76,175,80,.15)' : 'rgba(255,152,0,.15)',
            color: parseFloat(weekChange) <= 0 ? 'var(--green)' : 'var(--orange)',
          }}>
            {parseFloat(weekChange) > 0 ? '+' : ''}{weekChange} kg this week
          </span>
        )}
        {!weekChange && totalChange && (
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 4,
            background: parseFloat(totalChange) <= 0 ? 'rgba(76,175,80,.15)' : 'rgba(255,152,0,.15)',
            color: parseFloat(totalChange) <= 0 ? 'var(--green)' : 'var(--orange)',
          }}>
            {parseFloat(totalChange) > 0 ? '+' : ''}{totalChange} kg total
          </span>
        )}
      </div>

      <WeightChart data={weekEntries} />

      {/* Daily weight entries for this week */}
      <div style={{ marginTop: 14 }}>
        <div className="kl" style={{ marginBottom: 8 }}>Daily Weigh-ins</div>
        {weekWeights.map(({ date, weight }) => {
          const isFuture = date > today;
          const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
          const isEditing = editingDate === date;

          if (isFuture) return (
            <div key={date} style={{ display: 'flex', alignItems: 'center', padding: '6px 0', opacity: 0.3, borderBottom: '1px solid var(--b2)' }}>
              <span style={{ flex: 1, fontSize: 12 }}>{dayLabel}</span>
              <span style={{ fontSize: 12, color: 'var(--t3)' }}>—</span>
            </div>
          );

          if (isEditing) return (
            <div key={date} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', borderBottom: '1px solid var(--b2)' }}>
              <span style={{ flex: 1, fontSize: 12 }}>{dayLabel}</span>
              <input
                className="form-inp"
                type="number"
                step="0.1"
                placeholder={weight ? String(weight) : '80.0'}
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(date); if (e.key === 'Escape') setEditingDate(null); }}
                autoFocus
                style={{ width: 80, fontSize: 13, fontFamily: 'var(--fd)', textAlign: 'center', padding: '4px 6px' }}
              />
              <span style={{ fontSize: 11, color: 'var(--t3)' }}>kg</span>
              <button className="btn btn-primary btn-sm" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => handleSave(date)} disabled={saving}>
                {saving ? '...' : 'Save'}
              </button>
              <button className="btn btn-secondary btn-sm" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => setEditingDate(null)}>
                <Icon name="x" size={10} />
              </button>
            </div>
          );

          return (
            <div
              key={date}
              style={{ display: 'flex', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--b2)', cursor: 'pointer' }}
              onClick={() => { setEditingDate(date); setInputVal(weight ? String(weight) : ''); }}
            >
              <span style={{ flex: 1, fontSize: 12 }}>{dayLabel}</span>
              {weight ? (
                <span style={{ fontSize: 13, fontFamily: 'var(--fd)' }}>{weight} kg</span>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--gold)' }}>+ Log</span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Photo Upload Section ──
function PhotoSection({ allPhotos, weekDates, weekMonday }) {
  const { user } = useAuthStore();
  const { addPhoto } = useClientStore();
  const { showToast } = useUIStore();
  const [uploading, setUploading] = useState(null);
  const fileRefs = { front: useRef(), side: useRef(), back: useRef() };

  const positions = ['front', 'side', 'back'];

  // Use the Monday of the selected week as the date for uploads
  const uploadDate = weekMonday;

  // Filter photos for this week
  const weekPhotos = useMemo(() => {
    const map = {};
    allPhotos
      .filter(p => weekDates.includes(p.date))
      .forEach(p => { map[p.pose] = p; });
    return map;
  }, [allPhotos, weekDates]);

  // Count total weeks that have photos
  const weeksWithPhotos = useMemo(() => {
    const weeks = new Set();
    allPhotos.forEach(p => { if (p.date) weeks.add(getWeekKey(p.date)); });
    return weeks.size;
  }, [allPhotos]);

  const handleUpload = async (pose, file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Please select an image', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('Max 5MB per photo', 'error'); return; }

    setUploading(pose);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Upload with the selected week's monday as the date
      const result = await uploadProgressPhoto(getClientId(), pose, dataUrl, uploadDate);
      if (result) {
        addPhoto(result);
        showToast(`${pose} photo uploaded!`, 'success');
      } else {
        showToast('Upload failed', 'error');
      }
    } catch (err) {
      console.error('Upload error:', err);
      showToast('Upload failed', 'error');
    }
    setUploading(null);
  };

  const hasAnyThisWeek = Object.keys(weekPhotos).length > 0;

  return (
    <Card
      title="Progress Photos"
      subtitle={hasAnyThisWeek
        ? `${Object.keys(weekPhotos).length}/3 poses · ${weeksWithPhotos} week${weeksWithPhotos !== 1 ? 's' : ''} total`
        : 'No photos this week'
      }
    >
      <div className="photo-grid">
        {positions.map(pos => {
          const photo = weekPhotos[pos];
          return (
            <div
              key={pos}
              className="photo-card"
              style={{ position: 'relative', cursor: 'pointer' }}
              onClick={() => fileRefs[pos].current?.click()}
            >
              {photo ? (
                <>
                  <img src={photo.url} alt={pos} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: 'linear-gradient(transparent, rgba(0,0,0,.7))',
                    padding: '16px 6px 6px', textAlign: 'center',
                    fontSize: 10, color: '#fff', textTransform: 'capitalize',
                  }}>
                    {pos} — tap to replace
                  </div>
                </>
              ) : (
                <>
                  {uploading === pos ? (
                    <div style={{ fontSize: 11, color: 'var(--gold)' }}>Uploading...</div>
                  ) : (
                    <>
                      <Icon name="camera" size={24} style={{ color: 'var(--t3)', opacity: 0.4 }} />
                      <span className="photo-label" style={{ textTransform: 'capitalize' }}>{pos}</span>
                      <span style={{ fontSize: 10, color: 'var(--gold)', marginTop: 4 }}>Tap to upload</span>
                    </>
                  )}
                </>
              )}
              <input
                ref={fileRefs[pos]}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={e => { handleUpload(pos, e.target.files?.[0]); e.target.value = ''; }}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Measurements Form Section ──
function MeasurementsSection({ measurements, weekDates, weekMonday }) {
  const { user } = useAuthStore();
  const { addMeasurement } = useClientStore();
  const { showToast } = useUIStore();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Find measurement for current week only
  const weekMeasurement = useMemo(() => {
    return measurements.find(m => weekDates.includes(m.date));
  }, [measurements, weekDates]);

  // Previous week's measurement for comparison (delta display)
  const prevMeasurement = useMemo(() => {
    if (!weekMeasurement) return null;
    const sorted = [...measurements].sort((a, b) => b.date.localeCompare(a.date));
    const idx = sorted.indexOf(weekMeasurement);
    return idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
  }, [measurements, weekMeasurement]);

  const displayMeasurement = weekMeasurement || null;

  const fields = [
    { key: 'waist', label: 'Waist', unit: 'cm' },
    { key: 'chest', label: 'Chest', unit: 'cm' },
    { key: 'arms', label: 'Arms', unit: 'cm' },
    { key: 'thighs', label: 'Thighs', unit: 'cm' },
  ];

  const [form, setForm] = useState({ waist: '', chest: '', arms: '', thighs: '' });

  const startEditing = () => {
    const current = displayMeasurement || {};
    setForm({
      waist: current.waist ? String(current.waist) : '',
      chest: current.chest ? String(current.chest) : '',
      arms: current.arms ? String(current.arms) : '',
      thighs: current.thighs ? String(current.thighs) : '',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    const data = {};
    fields.forEach(f => {
      const val = parseFloat(form[f.key]);
      if (!isNaN(val) && val > 0) data[f.key] = val;
    });
    if (Object.keys(data).length === 0) { showToast('Enter at least one measurement', 'error'); return; }

    setSaving(true);
    // Save to the selected week's monday date so it groups with that week
    const date = weekMonday;
    addMeasurement(date, data);
    const ok = await saveMeasurement(getClientId(), date, data);
    setSaving(false);
    setEditing(false);
    showToast(ok ? 'Measurements saved!' : 'Failed to save', ok ? 'success' : 'error');
  };

  if (editing) {
    return (
      <Card title="Update Measurements">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {fields.map(f => (
            <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ width: 60, fontSize: 12, color: 'var(--t2)' }}>{f.label}</label>
              <input
                className="form-inp"
                type="number"
                step="0.1"
                placeholder={f.label}
                value={form[f.key]}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                style={{ flex: 1, padding: '6px 10px' }}
              />
              <span style={{ fontSize: 11, color: 'var(--t3)', width: 24 }}>{f.unit}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Measurements'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Measurements"
      subtitle={null}
    >
      {displayMeasurement ? (
        <div className="meas-grid">
          {fields.map(f => {
            const val = displayMeasurement[f.key];
            const prevVal = prevMeasurement?.[f.key];
            const diff = val && prevVal ? (val - prevVal).toFixed(1) : null;
            return (
              <div key={f.key} className="meas-item">
                <div className="meas-lbl">{f.label}</div>
                <div className="meas-val">
                  {val ?? '—'}
                  {val && <span className="meas-unit">{f.unit}</span>}
                </div>
                {diff && (
                  <div style={{ fontSize: 9, color: parseFloat(diff) <= 0 ? 'var(--green)' : 'var(--orange)', marginTop: 2 }}>
                    {parseFloat(diff) > 0 ? '+' : ''}{diff}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--t3)', fontSize: 12 }}>
          No measurements this week.
        </div>
      )}

      <button className="btn btn-secondary btn-sm" style={{ marginTop: 14, width: '100%' }} onClick={startEditing}>
        <Icon name="edit" size={12} /> {displayMeasurement ? 'Update Measurements' : 'Add Measurements'}
      </button>
    </Card>
  );
}

// ══════════════════════════════════════
// Main Progress Screen
// ══════════════════════════════════════
// ── Training Volume Section ──
function TrainingVolumeSection({ workoutHistory }) {
  // Flatten all sessions from all days into a single sorted list
  const sessions = useMemo(() => {
    const all = [];
    Object.entries(workoutHistory || {}).forEach(([dayIdx, daySessionList]) => {
      (daySessionList || []).forEach(s => {
        all.push({ ...s, dayIdx: parseInt(dayIdx) });
      });
    });
    return all.sort((a, b) => a.date.localeCompare(b.date)).slice(-12);
  }, [workoutHistory]);

  if (sessions.length < 2) return null;

  const volumes = sessions.map(s => s.volume || 0);
  const max = Math.max(...volumes, 1);
  const barWidth = Math.max(20, Math.floor(260 / sessions.length));

  // Trend: compare last 3 sessions avg vs previous 3
  const recent3 = volumes.slice(-3);
  const prev3 = volumes.slice(-6, -3);
  const recentAvg = recent3.reduce((s, v) => s + v, 0) / recent3.length;
  const prevAvg = prev3.length ? prev3.reduce((s, v) => s + v, 0) / prev3.length : null;
  const trendPct = prevAvg ? Math.round(((recentAvg - prevAvg) / prevAvg) * 100) : null;

  return (
    <Card title="Training Volume" subtitle={`Last ${sessions.length} sessions`}>
      {trendPct != null && (
        <div style={{ fontSize: 11, marginBottom: 10, color: trendPct >= 0 ? 'var(--green)' : 'var(--orange)' }}>
          {trendPct >= 0 ? '↑' : '↓'} {Math.abs(trendPct)}% {trendPct >= 0 ? 'increase' : 'decrease'} in recent sessions
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
        {sessions.map((s, i) => {
          const h = Math.max(4, (s.volume / max) * 72);
          const isLast = i === sessions.length - 1;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{
                width: '100%', maxWidth: barWidth, height: h, borderRadius: '4px 4px 0 0',
                background: isLast ? 'var(--gold)' : 'var(--gold-d)',
                transition: 'height .3s',
              }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 9, color: 'var(--t3)' }}>{sessions[0]?.date?.slice(5) || ''}</span>
        <span style={{ fontSize: 9, color: 'var(--t3)' }}>{sessions[sessions.length - 1]?.date?.slice(5) || ''}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <div>
          <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1 }}>Avg Volume</div>
          <div style={{ fontSize: 14, fontFamily: 'var(--fd)', color: 'var(--gold)' }}>
            {Math.round(volumes.reduce((s, v) => s + v, 0) / volumes.length).toLocaleString()} kg
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1 }}>Best Session</div>
          <div style={{ fontSize: 14, fontFamily: 'var(--fd)', color: 'var(--green)' }}>
            {max.toLocaleString()} kg
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function ProgressScreen() {
  const { weightLog, measurements, photos, goals, workoutHistory } = useClientStore();
  const today = getTodayKey();
  const currentWeekMonday = getWeekKey(today);

  const [weekMonday, setWeekMonday] = useState(currentWeekMonday);

  const weekDates = useMemo(() => getWeekDates(weekMonday), [weekMonday]);
  const canGoNext = weekMonday < currentWeekMonday;

  const goToPrevWeek = () => {
    const d = new Date(weekMonday + 'T12:00:00');
    d.setDate(d.getDate() - 7);
    setWeekMonday(d.toISOString().slice(0, 10));
  };

  const goToNextWeek = () => {
    const d = new Date(weekMonday + 'T12:00:00');
    d.setDate(d.getDate() + 7);
    const next = d.toISOString().slice(0, 10);
    if (next <= currentWeekMonday) setWeekMonday(next);
  };

  return (
    <div className="screen active">
      {/* Week navigation */}
      <WeekNavigator
        weekMonday={weekMonday}
        onPrev={goToPrevWeek}
        onNext={goToNextWeek}
        canNext={canGoNext}
      />

      {/* Weight + stats in 70/30 */}
      <div className="g7030">
        <WeightSection weightLog={weightLog} weekDates={weekDates} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <div className="kl">Starting Weight</div>
            <div className="kv" style={{ marginTop: 4 }}>{weightLog.length ? weightLog[0].weight : '—'}</div>
            <div className="ku">kg</div>
          </Card>
          {goals.targetWeight && (
            <Card>
              <div className="kl">Target Weight</div>
              <div className="kv" style={{ marginTop: 4, color: 'var(--gold)' }}>{goals.targetWeight}</div>
              <div className="ku">kg</div>
            </Card>
          )}
          {weightLog.length >= 2 && (
            <Card>
              <div className="kl">Overall Change</div>
              <div className="kv" style={{ marginTop: 4, color: (() => {
                const diff = weightLog[weightLog.length - 1].weight - weightLog[0].weight;
                return diff <= 0 ? 'var(--green)' : 'var(--orange)';
              })() }}>
                {(() => {
                  const diff = (weightLog[weightLog.length - 1].weight - weightLog[0].weight).toFixed(1);
                  return `${parseFloat(diff) > 0 ? '+' : ''}${diff}`;
                })()}
              </div>
              <div className="ku">kg</div>
            </Card>
          )}
        </div>
      </div>

      {/* Photos */}
      <div style={{ marginTop: 14 }}>
        <PhotoSection allPhotos={photos} weekDates={weekDates} weekMonday={weekMonday} />
      </div>

      {/* Measurements */}
      <div style={{ marginTop: 14 }}>
        <MeasurementsSection measurements={measurements} weekDates={weekDates} weekMonday={weekMonday} />
      </div>

      {/* Training Volume */}
      <div style={{ marginTop: 14 }}>
        <TrainingVolumeSection workoutHistory={workoutHistory} />
      </div>

    </div>
  );
}
