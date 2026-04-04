import { useState, useMemo, useRef, useCallback } from 'react';
import { useCoachStore } from '../../stores/coachStore';
import { useAuthStore } from '../../stores/authStore';
import { Card, ConfirmDialog } from '../../components/ui';
import { Icon } from '../../utils/icons';
import { useUIStore } from '../../stores/uiStore';
import { saveTrainingPlan, saveTrainingTemplate } from '../../services/training';
import { useUnsavedWarning } from '../../hooks/useUnsavedWarning';

// ══════════════════════════════════════
// Exercise Library — pre-tagged with muscle groups
// ══════════════════════════════════════
const EXERCISE_LIBRARY = [
  // Chest
  { name: 'Barbell Bench Press', muscle: 'Chest', defaultSets: 4, defaultReps: '6-8' },
  { name: 'Incline Dumbbell Press', muscle: 'Chest', defaultSets: 3, defaultReps: '8-10' },
  { name: 'Dumbbell Bench Press', muscle: 'Chest', defaultSets: 3, defaultReps: '8-10' },
  { name: 'Incline Barbell Press', muscle: 'Chest', defaultSets: 4, defaultReps: '6-8' },
  { name: 'Cable Flyes', muscle: 'Chest', defaultSets: 3, defaultReps: '12-15' },
  { name: 'Dumbbell Flyes', muscle: 'Chest', defaultSets: 3, defaultReps: '10-12' },
  { name: 'Pec Deck Machine', muscle: 'Chest', defaultSets: 3, defaultReps: '12-15' },
  { name: 'Chest Dips', muscle: 'Chest', defaultSets: 3, defaultReps: '8-12' },
  { name: 'Push-Ups', muscle: 'Chest', defaultSets: 3, defaultReps: '15-20' },
  { name: 'Machine Chest Press', muscle: 'Chest', defaultSets: 3, defaultReps: '10-12' },

  // Back
  { name: 'Barbell Row', muscle: 'Back', defaultSets: 4, defaultReps: '6-8' },
  { name: 'Lat Pulldown', muscle: 'Back', defaultSets: 3, defaultReps: '10-12' },
  { name: 'Seated Cable Row', muscle: 'Back', defaultSets: 3, defaultReps: '10-12' },
  { name: 'Pull-Ups', muscle: 'Back', defaultSets: 3, defaultReps: '6-10' },
  { name: 'Dumbbell Row', muscle: 'Back', defaultSets: 3, defaultReps: '8-10' },
  { name: 'T-Bar Row', muscle: 'Back', defaultSets: 3, defaultReps: '8-10' },
  { name: 'Face Pulls', muscle: 'Back', defaultSets: 3, defaultReps: '15-20' },
  { name: 'Deadlift', muscle: 'Back', defaultSets: 4, defaultReps: '5-6' },
  { name: 'Rack Pulls', muscle: 'Back', defaultSets: 3, defaultReps: '6-8' },
  { name: 'Chin-Ups', muscle: 'Back', defaultSets: 3, defaultReps: '6-10' },
  { name: 'Machine Row', muscle: 'Back', defaultSets: 3, defaultReps: '10-12' },

  // Shoulders
  { name: 'Overhead Press', muscle: 'Shoulders', defaultSets: 4, defaultReps: '6-8' },
  { name: 'Dumbbell Shoulder Press', muscle: 'Shoulders', defaultSets: 3, defaultReps: '8-10' },
  { name: 'Lateral Raises', muscle: 'Shoulders', defaultSets: 3, defaultReps: '12-15' },
  { name: 'Cable Lateral Raises', muscle: 'Shoulders', defaultSets: 3, defaultReps: '12-15' },
  { name: 'Rear Delt Flyes', muscle: 'Shoulders', defaultSets: 3, defaultReps: '12-15' },
  { name: 'Front Raises', muscle: 'Shoulders', defaultSets: 3, defaultReps: '12-15' },
  { name: 'Arnold Press', muscle: 'Shoulders', defaultSets: 3, defaultReps: '8-10' },
  { name: 'Machine Shoulder Press', muscle: 'Shoulders', defaultSets: 3, defaultReps: '10-12' },
  { name: 'Upright Row', muscle: 'Shoulders', defaultSets: 3, defaultReps: '10-12' },

  // Biceps
  { name: 'Barbell Curl', muscle: 'Biceps', defaultSets: 3, defaultReps: '8-10' },
  { name: 'Dumbbell Curl', muscle: 'Biceps', defaultSets: 3, defaultReps: '10-12' },
  { name: 'Hammer Curl', muscle: 'Biceps', defaultSets: 3, defaultReps: '10-12' },
  { name: 'Incline Dumbbell Curl', muscle: 'Biceps', defaultSets: 3, defaultReps: '10-12' },
  { name: 'Cable Curl', muscle: 'Biceps', defaultSets: 3, defaultReps: '12-15' },
  { name: 'Preacher Curl', muscle: 'Biceps', defaultSets: 3, defaultReps: '10-12' },
  { name: 'EZ-Bar Curl', muscle: 'Biceps', defaultSets: 3, defaultReps: '8-10' },
  { name: 'Concentration Curl', muscle: 'Biceps', defaultSets: 3, defaultReps: '10-12' },

  // Triceps
  { name: 'Tricep Pushdown', muscle: 'Triceps', defaultSets: 3, defaultReps: '10-12' },
  { name: 'Overhead Tricep Extension', muscle: 'Triceps', defaultSets: 3, defaultReps: '10-12' },
  { name: 'Skull Crushers', muscle: 'Triceps', defaultSets: 3, defaultReps: '8-10' },
  { name: 'Close-Grip Bench Press', muscle: 'Triceps', defaultSets: 3, defaultReps: '8-10' },
  { name: 'Dips', muscle: 'Triceps', defaultSets: 3, defaultReps: '8-12' },
  { name: 'Cable Overhead Extension', muscle: 'Triceps', defaultSets: 3, defaultReps: '12-15' },
  { name: 'Kickbacks', muscle: 'Triceps', defaultSets: 3, defaultReps: '12-15' },

  // Quads
  { name: 'Barbell Squat', muscle: 'Quads', defaultSets: 4, defaultReps: '6-8' },
  { name: 'Leg Press', muscle: 'Quads', defaultSets: 4, defaultReps: '10-12' },
  { name: 'Leg Extension', muscle: 'Quads', defaultSets: 3, defaultReps: '12-15' },
  { name: 'Front Squat', muscle: 'Quads', defaultSets: 3, defaultReps: '6-8' },
  { name: 'Hack Squat', muscle: 'Quads', defaultSets: 3, defaultReps: '8-10' },
  { name: 'Bulgarian Split Squat', muscle: 'Quads', defaultSets: 3, defaultReps: '8-10' },
  { name: 'Walking Lunges', muscle: 'Quads', defaultSets: 3, defaultReps: '10-12' },
  { name: 'Goblet Squat', muscle: 'Quads', defaultSets: 3, defaultReps: '10-12' },
  { name: 'Sissy Squat', muscle: 'Quads', defaultSets: 3, defaultReps: '12-15' },

  // Hamstrings
  { name: 'Romanian Deadlift', muscle: 'Hamstrings', defaultSets: 3, defaultReps: '8-10' },
  { name: 'Lying Leg Curl', muscle: 'Hamstrings', defaultSets: 3, defaultReps: '10-12' },
  { name: 'Seated Leg Curl', muscle: 'Hamstrings', defaultSets: 3, defaultReps: '10-12' },
  { name: 'Stiff-Leg Deadlift', muscle: 'Hamstrings', defaultSets: 3, defaultReps: '8-10' },
  { name: 'Good Mornings', muscle: 'Hamstrings', defaultSets: 3, defaultReps: '10-12' },
  { name: 'Nordic Curl', muscle: 'Hamstrings', defaultSets: 3, defaultReps: '6-8' },

  // Glutes
  { name: 'Hip Thrust', muscle: 'Glutes', defaultSets: 4, defaultReps: '8-10' },
  { name: 'Cable Pull-Through', muscle: 'Glutes', defaultSets: 3, defaultReps: '12-15' },
  { name: 'Glute Bridge', muscle: 'Glutes', defaultSets: 3, defaultReps: '12-15' },
  { name: 'Sumo Deadlift', muscle: 'Glutes', defaultSets: 4, defaultReps: '6-8' },
  { name: 'Step-Ups', muscle: 'Glutes', defaultSets: 3, defaultReps: '10-12' },

  // Calves
  { name: 'Standing Calf Raise', muscle: 'Calves', defaultSets: 4, defaultReps: '12-15' },
  { name: 'Seated Calf Raise', muscle: 'Calves', defaultSets: 3, defaultReps: '15-20' },
  { name: 'Leg Press Calf Raise', muscle: 'Calves', defaultSets: 3, defaultReps: '12-15' },

  // Core
  { name: 'Cable Crunch', muscle: 'Core', defaultSets: 3, defaultReps: '15-20' },
  { name: 'Hanging Leg Raise', muscle: 'Core', defaultSets: 3, defaultReps: '10-15' },
  { name: 'Ab Wheel Rollout', muscle: 'Core', defaultSets: 3, defaultReps: '10-12' },
  { name: 'Plank', muscle: 'Core', defaultSets: 3, defaultReps: '30-60s' },
  { name: 'Russian Twist', muscle: 'Core', defaultSets: 3, defaultReps: '15-20' },
  { name: 'Decline Sit-Ups', muscle: 'Core', defaultSets: 3, defaultReps: '15-20' },
  { name: 'Woodchoppers', muscle: 'Core', defaultSets: 3, defaultReps: '12-15' },
];

const MUSCLE_GROUPS = ['All', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core'];

const MUSCLE_COLORS = {
  Chest: '#e74c3c', Back: '#3498db', Shoulders: '#f39c12', Biceps: '#e67e22',
  Triceps: '#9b59b6', Quads: '#2ecc71', Hamstrings: '#1abc9c', Glutes: '#e91e63',
  Calves: '#00bcd4', Core: '#ff9800',
};

// ── Lookup map for muscle group sync ──
const EXERCISE_LOOKUP = {};
EXERCISE_LIBRARY.forEach(ex => {
  EXERCISE_LOOKUP[ex.name.toLowerCase()] = ex.muscle;
});

// Fuzzy match: tries exact, then "contains", then word overlap
function findMuscleForExercise(name) {
  if (!name) return '';
  const lower = name.toLowerCase().trim();
  // Exact match
  if (EXERCISE_LOOKUP[lower]) return EXERCISE_LOOKUP[lower];
  // Check if library name is contained in the exercise name or vice versa
  for (const ex of EXERCISE_LIBRARY) {
    const libName = ex.name.toLowerCase();
    if (lower.includes(libName) || libName.includes(lower)) return ex.muscle;
  }
  // Word overlap (at least 2 matching words)
  const words = lower.split(/\s+/);
  for (const ex of EXERCISE_LIBRARY) {
    const libWords = ex.name.toLowerCase().split(/\s+/);
    const overlap = words.filter(w => libWords.includes(w) && w.length > 2);
    if (overlap.length >= 2) return ex.muscle;
  }
  return '';
}

// Sync muscle groups on all exercises in a template
function syncTemplateMuscles(template) {
  let changed = 0;
  const updated = {
    ...template,
    days: (template.days || []).map(day => ({
      ...day,
      exercises: day.exercises.map(ex => {
        if (ex.muscle) return ex; // already tagged
        const found = findMuscleForExercise(ex.name);
        if (found) { changed++; return { ...ex, muscle: found }; }
        return ex;
      }),
    })),
  };
  return { updated, changed };
}

// ══════════════════════════════════════
// Exercise Picker — searchable with muscle filter
// ══════════════════════════════════════
function ExercisePicker({ onSelect, onCancel }) {
  const [search, setSearch] = useState('');
  const [filterMuscle, setFilterMuscle] = useState('All');
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customMuscle, setCustomMuscle] = useState('Chest');
  const [customSets, setCustomSets] = useState('3');
  const [customReps, setCustomReps] = useState('10-12');

  const filtered = useMemo(() => {
    let list = EXERCISE_LIBRARY;
    if (filterMuscle !== 'All') list = list.filter(e => e.muscle === filterMuscle);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q));
    }
    return list;
  }, [search, filterMuscle]);

  const handleCustomAdd = () => {
    if (!customName.trim()) return;
    onSelect({
      name: customName.trim(),
      muscle: customMuscle,
      sets: parseInt(customSets) || 3,
      reps: customReps || '10-12',
      targetReps: customReps || '10-12',
      rest: 90,
    });
  };

  if (customMode) {
    return (
      <Card style={{ marginTop: 10, border: '1px solid var(--gold)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="kl">Custom Exercise</div>
          <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => setCustomMode(false)}>
            <Icon name="chevron-left" size={10} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '2 1 140px' }}>
            <label style={{ fontSize: 10, color: 'var(--t3)' }}>Exercise Name</label>
            <input className="form-inp" value={customName} onChange={e => setCustomName(e.target.value)}
              placeholder="e.g. Landmine Press" style={{ width: '100%', marginTop: 2 }} autoFocus />
          </div>
          <div style={{ flex: '1 1 100px' }}>
            <label style={{ fontSize: 10, color: 'var(--t3)' }}>Muscle Group</label>
            <select className="form-inp" value={customMuscle} onChange={e => setCustomMuscle(e.target.value)}
              style={{ width: '100%', marginTop: 2, padding: '6px 8px' }}>
              {MUSCLE_GROUPS.filter(m => m !== 'All').map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ flex: '0 0 55px' }}>
            <label style={{ fontSize: 10, color: 'var(--t3)' }}>Sets</label>
            <input className="form-inp" value={customSets} onChange={e => setCustomSets(e.target.value)}
              style={{ width: '100%', marginTop: 2 }} />
          </div>
          <div style={{ flex: '0 0 70px' }}>
            <label style={{ fontSize: 10, color: 'var(--t3)' }}>Reps</label>
            <input className="form-inp" value={customReps} onChange={e => setCustomReps(e.target.value)}
              style={{ width: '100%', marginTop: 2 }} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleCustomAdd}>Add</button>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ marginTop: 10, border: '1px solid var(--gold)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="kl">Add Exercise</div>
        <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={onCancel}>
          <Icon name="x" size={10} />
        </button>
      </div>

      {/* Search */}
      <input
        className="form-inp"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search exercises..."
        style={{ width: '100%', marginBottom: 10, padding: '8px 10px', fontSize: 13 }}
        autoFocus
      />

      {/* Muscle filter tabs */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
        {MUSCLE_GROUPS.map(m => (
          <button
            key={m}
            onClick={() => setFilterMuscle(m)}
            style={{
              padding: '3px 8px', fontSize: 10, borderRadius: 6, cursor: 'pointer',
              border: filterMuscle === m ? '1px solid var(--gold)' : '1px solid var(--border)',
              background: filterMuscle === m ? 'var(--gold-d)' : 'transparent',
              color: filterMuscle === m ? 'var(--gold)' : 'var(--t3)',
              fontFamily: 'var(--fm)',
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Results list */}
      <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 8 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--t3)', fontSize: 12 }}>
            No exercises found. Try a different search or add a custom exercise.
          </div>
        ) : filtered.map((ex, i) => (
          <div
            key={i}
            onClick={() => onSelect({
              name: ex.name, muscle: ex.muscle,
              sets: ex.defaultSets, reps: ex.defaultReps, targetReps: ex.defaultReps, rest: 90,
            })}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 6px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{ex.name}</div>
              <div style={{ fontSize: 10, color: 'var(--t3)' }}>{ex.defaultSets} sets × {ex.defaultReps}</div>
            </div>
            <span style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 4, fontFamily: 'var(--fm)',
              background: (MUSCLE_COLORS[ex.muscle] || '#888') + '22',
              color: MUSCLE_COLORS[ex.muscle] || '#888',
            }}>
              {ex.muscle}
            </span>
          </div>
        ))}
      </div>

      {/* Custom exercise link */}
      <button className="btn btn-ghost btn-sm" style={{ width: '100%', fontSize: 11 }} onClick={() => setCustomMode(true)}>
        <Icon name="plus" size={10} /> Add Custom Exercise
      </button>
    </Card>
  );
}

// ── Drag handle icon (6 dots grip) ──
function DragGrip() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" style={{ opacity: 0.3 }}>
      <circle cx="3" cy="2" r="1.2" /><circle cx="7" cy="2" r="1.2" />
      <circle cx="3" cy="6" r="1.2" /><circle cx="7" cy="6" r="1.2" />
      <circle cx="3" cy="10" r="1.2" /><circle cx="7" cy="10" r="1.2" />
      <circle cx="3" cy="14" r="1.2" /><circle cx="7" cy="14" r="1.2" />
    </svg>
  );
}

// ── Exercise row (editable + draggable) ──
function ExerciseRow({ exercise, index, onUpdate, onRemove, onDragStart, onDragOver, onDrop, isDragOver, isDragging }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: exercise.name,
    sets: String(exercise.sets || 3),
    reps: exercise.reps || exercise.targetReps || '10-12',
    rest: String(exercise.rest || 90),
    muscle: exercise.muscle || '',
  });

  const handleSave = () => {
    onUpdate(index, {
      ...exercise,
      name: form.name || exercise.name,
      sets: parseInt(form.sets) || 3,
      reps: form.reps || '10-12',
      targetReps: form.reps || '10-12',
      rest: parseInt(form.rest) || 90,
      muscle: form.muscle,
    });
    setEditing(false);
  };

  const muscleColor = MUSCLE_COLORS[exercise.muscle] || '#888';

  if (editing) {
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ flex: '2 1 140px' }}>
          <label style={{ fontSize: 10, color: 'var(--t3)' }}>Exercise</label>
          <input className="form-inp" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            style={{ width: '100%', marginTop: 2 }} autoFocus onKeyDown={e => e.key === 'Enter' && handleSave()} />
        </div>
        <div style={{ flex: '0 0 55px' }}>
          <label style={{ fontSize: 10, color: 'var(--t3)' }}>Sets</label>
          <input className="form-inp" value={form.sets} onChange={e => setForm({ ...form, sets: e.target.value })}
            style={{ width: '100%', marginTop: 2 }} />
        </div>
        <div style={{ flex: '0 0 70px' }}>
          <label style={{ fontSize: 10, color: 'var(--t3)' }}>Reps</label>
          <input className="form-inp" value={form.reps} onChange={e => setForm({ ...form, reps: e.target.value })}
            style={{ width: '100%', marginTop: 2 }} />
        </div>
        <div style={{ flex: '0 0 55px' }}>
          <label style={{ fontSize: 10, color: 'var(--t3)' }}>Rest (s)</label>
          <input className="form-inp" value={form.rest} onChange={e => setForm({ ...form, rest: e.target.value })}
            style={{ width: '100%', marginTop: 2 }} />
        </div>
        <div style={{ flex: '1 1 100px' }}>
          <label style={{ fontSize: 10, color: 'var(--t3)' }}>Muscle</label>
          <select className="form-inp" value={form.muscle} onChange={e => setForm({ ...form, muscle: e.target.value })}
            style={{ width: '100%', marginTop: 2, padding: '6px 8px' }}>
            <option value="">— None —</option>
            {MUSCLE_GROUPS.filter(m => m !== 'All').map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <button className="btn btn-primary btn-sm" style={{ padding: '5px 10px' }} onClick={handleSave}>
          <Icon name="check" size={10} />
        </button>
        <button className="btn btn-ghost btn-sm" style={{ padding: '5px 10px' }} onClick={() => setEditing(false)}>
          <Icon name="x" size={10} />
        </button>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(index); }}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDragOver(index); }}
      onDrop={e => { e.preventDefault(); onDrop(index); }}
      style={{
        display: 'grid', gridTemplateColumns: '18px 28px 1fr auto auto auto 28px',
        alignItems: 'center', gap: 6, padding: '7px 0',
        borderTop: isDragOver ? '2px solid var(--gold)' : 'none',
        borderBottom: '1px solid var(--border)',
        opacity: isDragging ? 0.4 : 1,
        cursor: 'grab',
        transition: 'opacity 0.15s',
      }}
    >
      {/* Drag handle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', cursor: 'grab' }}>
        <DragGrip />
      </div>
      <div style={{ fontSize: 12, color: 'var(--t3)', fontFamily: 'var(--fd)', textAlign: 'center' }}>{index + 1}</div>
      <div
        style={{ cursor: 'pointer' }}
        onClick={() => { setForm({ name: exercise.name, sets: String(exercise.sets || 3), reps: exercise.reps || exercise.targetReps || '10-12', rest: String(exercise.rest || 90), muscle: exercise.muscle || '' }); setEditing(true); }}
      >
        <div style={{ fontSize: 13, fontWeight: 500 }}>{exercise.name}</div>
        {exercise.muscle && <div style={{ fontSize: 10, color: muscleColor }}>{exercise.muscle}</div>}
      </div>
      <div style={{ fontSize: 12, color: 'var(--t2)', fontFamily: 'var(--fm)' }}>{exercise.sets}×{exercise.reps || exercise.targetReps || '—'}</div>
      <div style={{ fontSize: 11, color: 'var(--t3)' }}>{exercise.rest ? `${exercise.rest}s` : ''}</div>
      {exercise.muscle ? (
        <span style={{
          fontSize: 10, padding: '2px 7px', borderRadius: 4, fontFamily: 'var(--fm)',
          background: muscleColor + '22', color: muscleColor,
        }}>
          {exercise.muscle}
        </span>
      ) : <span />}
      <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={e => { e.stopPropagation(); onRemove(index); }}>
        <Icon name="x" size={10} />
      </button>
    </div>
  );
}

// ── Day editor card (with drag-to-reorder) ──
function DayEditor({ day, dayIdx, onUpdate, onRemoveDay }) {
  const [adding, setAdding] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [dayName, setDayName] = useState(day.name);
  const dragIdx = useRef(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const handleSelectExercise = (exerciseData) => {
    const updated = { ...day, exercises: [...day.exercises, exerciseData] };
    onUpdate(dayIdx, updated);
    setAdding(false);
  };

  const handleRemove = (exIdx) => {
    const updated = { ...day, exercises: day.exercises.filter((_, i) => i !== exIdx) };
    onUpdate(dayIdx, updated);
  };

  const handleExUpdate = (exIdx, updatedEx) => {
    const updated = { ...day, exercises: day.exercises.map((ex, i) => i === exIdx ? updatedEx : ex) };
    onUpdate(dayIdx, updated);
  };

  const handleSaveName = () => {
    if (dayName.trim()) {
      onUpdate(dayIdx, { ...day, name: dayName.trim() });
    }
    setEditingName(false);
  };

  // Drag handlers
  const handleDragStart = useCallback((idx) => { dragIdx.current = idx; }, []);
  const handleDragOver = useCallback((idx) => { setDragOverIdx(idx); }, []);
  const handleDrop = useCallback((dropIdx) => {
    const from = dragIdx.current;
    if (from === null || from === dropIdx) { dragIdx.current = null; setDragOverIdx(null); return; }
    const exercises = [...day.exercises];
    const [moved] = exercises.splice(from, 1);
    exercises.splice(dropIdx, 0, moved);
    onUpdate(dayIdx, { ...day, exercises });
    dragIdx.current = null;
    setDragOverIdx(null);
  }, [day, dayIdx, onUpdate]);

  // Unique muscle groups in this day
  const dayMuscles = [...new Set(day.exercises.map(ex => ex.muscle).filter(Boolean))];

  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        {editingName ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
            <input className="form-inp" value={dayName} onChange={e => setDayName(e.target.value)}
              placeholder="Day name" style={{ flex: 1, fontSize: 14, fontWeight: 600 }} autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSaveName()} />
            <button className="btn btn-primary btn-sm" style={{ padding: '4px 10px' }} onClick={handleSaveName}>
              <Icon name="check" size={10} />
            </button>
          </div>
        ) : (
          <div style={{ cursor: 'pointer' }} onClick={() => { setDayName(day.name); setEditingName(true); }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{day.name} <Icon name="edit" size={10} style={{ opacity: 0.3 }} /></div>
            <div style={{ fontSize: 11, color: 'var(--t3)', display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}>
              <span>{day.exercises.length} exercises</span>
              {dayMuscles.length > 0 && <span>·</span>}
              {dayMuscles.map(m => (
                <span key={m} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: (MUSCLE_COLORS[m] || '#888') + '22', color: MUSCLE_COLORS[m] || '#888' }}>{m}</span>
              ))}
            </div>
          </div>
        )}
        <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => onRemoveDay(dayIdx)}>
          <Icon name="trash" size={11} />
        </button>
      </div>

      <div onDragEnd={() => { dragIdx.current = null; setDragOverIdx(null); }}>
        {day.exercises.map((ex, i) => (
          <ExerciseRow
            key={i}
            exercise={ex}
            index={i}
            onUpdate={handleExUpdate}
            onRemove={handleRemove}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            isDragOver={dragOverIdx === i}
            isDragging={dragIdx.current === i}
          />
        ))}
      </div>

      {adding ? (
        <ExercisePicker onSelect={handleSelectExercise} onCancel={() => setAdding(false)} />
      ) : (
        <button className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={() => setAdding(true)}>
          <Icon name="plus" size={12} /> Add Exercise
        </button>
      )}
    </Card>
  );
}

// ── Assign to client panel ──
function AssignPanel({ template, onClose }) {
  const { clients } = useCoachStore();
  const { user } = useAuthStore();
  const { showToast } = useUIStore();
  const [selectedClientId, setSelectedClientId] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAssign = async () => {
    if (!selectedClientId) { showToast('Select a client', 'error'); return; }
    setSaving(true);
    const ok = await saveTrainingPlan(selectedClientId, user.id, template.name, template.days || []);
    setSaving(false);
    if (ok) {
      showToast('Training plan assigned!', 'success');
      onClose();
    } else {
      showToast('Failed to assign', 'error');
    }
  };

  return (
    <Card style={{ marginTop: 14, marginBottom: 14, border: '1px solid var(--gold)', borderColor: 'var(--gold)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="kl">Assign to Client</div>
        <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={onClose}>
          <Icon name="x" size={10} />
        </button>
      </div>
      {clients.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--t3)', padding: 10 }}>No clients found. Add clients first.</div>
      ) : (
        <>
          <select
            className="form-inp"
            value={selectedClientId}
            onChange={e => setSelectedClientId(e.target.value)}
            style={{ width: '100%', marginBottom: 10, padding: '8px 10px', fontSize: 13 }}
          >
            <option value="">Select a client...</option>
            {clients.map(c => (
              <option key={c.client_id || c.id} value={c.client_id || c.id}>
                {c.client_name || c.name || 'Unknown'}
              </option>
            ))}
          </select>
          <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={handleAssign} disabled={saving}>
            {saving ? 'Assigning...' : 'Assign Plan'}
          </button>
        </>
      )}
    </Card>
  );
}

// ── Summary stats ──
function TemplateSummary({ template }) {
  const totalExercises = (template.days || []).reduce((s, d) => s + (d.exercises?.length || 0), 0);
  const totalSets = (template.days || []).reduce((s, d) => s + (d.exercises || []).reduce((ss, ex) => ss + (ex.sets || 0), 0), 0);
  const muscleGroups = [...new Set((template.days || []).flatMap(d => (d.exercises || []).map(ex => ex.muscle).filter(Boolean)))];

  const stats = [
    { label: 'Days', value: (template.days || []).length, color: 'var(--gold)' },
    { label: 'Exercises', value: totalExercises, color: 'var(--green)' },
    { label: 'Total Sets', value: totalSets, color: 'var(--blue)' },
    { label: 'Muscle Groups', value: muscleGroups.length, color: 'var(--orange)' },
  ];

  return (
    <div className="g4" style={{ marginBottom: 18 }}>
      {stats.map(s => (
        <Card key={s.label}>
          <div className="kl">{s.label}</div>
          <div style={{ fontFamily: 'var(--fd)', fontSize: 22, color: s.color, marginTop: 4 }}>{s.value}</div>
        </Card>
      ))}
    </div>
  );
}

// ── Empty state ──
function EmptyState() {
  return (
    <Card>
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--t3)' }}>
        <Icon name="dumbbell" size={32} style={{ opacity: 0.2, display: 'block', margin: '0 auto 14px' }} />
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6, color: 'var(--t2)' }}>No training templates yet</div>
        <div style={{ fontSize: 12 }}>Create your first workout template to assign to clients.</div>
      </div>
    </Card>
  );
}

// ══════════════════════════════════════
// Main
// ══════════════════════════════════════
export default function WorkoutBuilderScreen() {
  const { trainingTemplates, setTrainingTemplates } = useCoachStore();
  const { showToast } = useUIStore();
  const { markDirty, markClean } = useUnsavedWarning();
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showAssign, setShowAssign] = useState(false);
  const [confirmRemoveDay, setConfirmRemoveDay] = useState(null); // dayIdx or null

  const tmpl = activeTemplate;

  // ── Open a template + auto-sync muscle groups ──
  const openTemplate = useCallback((t) => {
    const { updated, changed } = syncTemplateMuscles(t);
    if (changed > 0) {
      // Persist synced version back to store
      setTrainingTemplates(trainingTemplates.map(tt => tt.id === updated.id ? updated : tt));
      showToast(`Synced ${changed} exercise${changed > 1 ? 's' : ''} with muscle groups`, 'success');
    }
    setActiveTemplate(updated);
  }, [trainingTemplates, setTrainingTemplates, showToast]);

  // ── Handlers ──
  const handleDayUpdate = (dayIdx, updatedDay) => {
    if (!tmpl) return;
    const updated = { ...tmpl, days: tmpl.days.map((d, i) => i === dayIdx ? updatedDay : d) };
    setActiveTemplate(updated);
    setTrainingTemplates(trainingTemplates.map(t => t.id === updated.id ? updated : t));
    markDirty();
  };

  const handleRemoveDay = (dayIdx) => {
    setConfirmRemoveDay(dayIdx);
  };

  const executeRemoveDay = () => {
    if (!tmpl || confirmRemoveDay === null) return;
    const updated = { ...tmpl, days: tmpl.days.filter((_, i) => i !== confirmRemoveDay) };
    setActiveTemplate(updated);
    setTrainingTemplates(trainingTemplates.map(t => t.id === updated.id ? updated : t));
    markDirty();
    setConfirmRemoveDay(null);
  };

  const handleAddDay = () => {
    if (!tmpl) return;
    const dayNum = (tmpl.days || []).length + 1;
    const updated = {
      ...tmpl,
      days: [...(tmpl.days || []), { name: `Day ${dayNum}`, exercises: [] }],
    };
    setActiveTemplate(updated);
    setTrainingTemplates(trainingTemplates.map(t => t.id === updated.id ? updated : t));
    markDirty();
  };

  const handleNewTemplate = () => {
    const newTmpl = {
      id: `new-${Date.now()}`,
      name: 'New Training Template',
      days: [
        { name: 'Day 1 — Push', exercises: [] },
        { name: 'Day 2 — Pull', exercises: [] },
        { name: 'Day 3 — Legs', exercises: [] },
      ],
    };
    setTrainingTemplates([...trainingTemplates, newTmpl]);
    setActiveTemplate(newTmpl);
  };

  const handleSaveName = () => {
    if (!tmpl || !templateName.trim()) return;
    const updated = { ...tmpl, name: templateName.trim() };
    setActiveTemplate(updated);
    setTrainingTemplates(trainingTemplates.map(t => t.id === updated.id ? updated : t));
    setEditingName(false);
  };

  const handleSaveTemplate = async () => {
    const savedId = await saveTrainingTemplate(user.id, tmpl);
    if (savedId) {
      const updated = { ...tmpl, id: savedId };
      setActiveTemplate(updated);
      setTrainingTemplates(trainingTemplates.map(t => t.id === tmpl.id ? updated : t));
      markClean();
      showToast('Template saved!', 'success');
    } else {
      showToast('Failed to save template', 'error');
    }
  };

  const handleSyncMuscles = () => {
    if (!tmpl) return;
    const { updated, changed } = syncTemplateMuscles(tmpl);
    if (changed > 0) {
      setActiveTemplate(updated);
      setTrainingTemplates(trainingTemplates.map(t => t.id === updated.id ? updated : t));
      showToast(`Synced ${changed} exercise${changed > 1 ? 's' : ''}`, 'success');
    } else {
      showToast('All exercises already tagged', 'success');
    }
  };

  // ══════════════════════════════════════
  // Template editor view
  // ══════════════════════════════════════
  if (tmpl) {
    return (
      <div className="screen active">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
            <button className="icon-btn" onClick={() => { setActiveTemplate(null); setShowAssign(false); }}>
              <Icon name="chevron-left" size={14} />
            </button>
            {editingName ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
                <input
                  className="form-inp"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  placeholder="Template name"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                  style={{ flex: 1, fontSize: 15, fontWeight: 600 }}
                />
                <button className="btn btn-primary btn-sm" style={{ padding: '4px 10px' }} onClick={handleSaveName}>
                  <Icon name="check" size={10} />
                </button>
                <button className="btn btn-secondary btn-sm" style={{ padding: '4px 10px' }} onClick={() => setEditingName(false)}>
                  <Icon name="x" size={10} />
                </button>
              </div>
            ) : (
              <div style={{ cursor: 'pointer' }} onClick={() => { setTemplateName(tmpl.name); setEditingName(true); }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>
                  {tmpl.name} <Icon name="edit" size={10} style={{ opacity: 0.3 }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>{(tmpl.days || []).length} days · {(tmpl.days || []).reduce((s, d) => s + (d.exercises?.length || 0), 0)} exercises</div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={handleSyncMuscles} title="Auto-tag muscle groups from library">
              Sync
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAssign(!showAssign)}>
              <Icon name="user" size={12} /> Assign
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSaveTemplate}>
              <Icon name="check" size={12} /> Save
            </button>
          </div>
        </div>

        {/* Assign panel */}
        {showAssign && (
          <AssignPanel template={tmpl} onClose={() => setShowAssign(false)} />
        )}

        {/* Summary stats */}
        <TemplateSummary template={tmpl} />

        {/* Day editors */}
        {(tmpl.days || []).map((day, i) => (
          <DayEditor key={i} day={day} dayIdx={i} onUpdate={handleDayUpdate} onRemoveDay={handleRemoveDay} />
        ))}

        <button className="btn btn-secondary" style={{ width: '100%', marginTop: 8 }} onClick={handleAddDay}>
          <Icon name="plus" size={13} /> Add Training Day
        </button>

        <ConfirmDialog
          open={confirmRemoveDay !== null}
          title="Remove this day?"
          message="All exercises in this day will be removed."
          confirmLabel="Remove"
          danger
          onConfirm={executeRemoveDay}
          onCancel={() => setConfirmRemoveDay(null)}
        />
      </div>
    );
  }

  // ══════════════════════════════════════
  // Template list view
  // ══════════════════════════════════════
  return (
    <div className="screen active">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ fontSize: 12, color: 'var(--t3)' }}>{trainingTemplates.length} templates</div>
        <button className="btn btn-primary btn-sm" onClick={handleNewTemplate}>
          <Icon name="plus" size={12} /> New Template
        </button>
      </div>

      {trainingTemplates.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="g2">
          {trainingTemplates.map(t => (
            <Card key={t.id} style={{ cursor: 'pointer' }} onClick={() => openTemplate(t)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, background: 'var(--gold-d)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)',
                }}>
                  <Icon name="dumbbell" size={16} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                    {t.days?.length || 0} days · {(t.days || []).reduce((s, d) => s + (d.exercises?.length || 0), 0)} exercises
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(t.days || []).map((d, i) => (
                  <span key={i} className="tag t-gy">{d.name}</span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
