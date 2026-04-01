import { useState, useCallback, useEffect, useMemo } from 'react';
import { useClientStore } from '../../stores/clientStore';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { Card } from '../../components/ui';
import { Icon } from '../../utils/icons';
import { saveWorkoutSession } from '../../services/training';

function getClientId() {
  const authState = useAuthStore.getState();
  return authState.roleOverride
    ? (sessionStorage.getItem('overrideClientId') || authState.user?.id)
    : authState.user?.id;
}

// ---------- Set logging row ----------
function SetRow({ setIdx, set, prevSet, onChange, onComplete, active }) {
  const [weight, setWeight] = useState(set.weight ?? set.kg ?? '');
  const [reps, setReps] = useState(set.reps ?? '');

  // Sync local state when set changes externally (e.g. day switch)
  useEffect(() => {
    setWeight(set.weight ?? set.kg ?? '');
    setReps(set.reps ?? '');
  }, [set.weight, set.kg, set.reps]);

  const handleBlur = () => {
    onChange(setIdx, { weight: parseFloat(weight) || 0, reps: parseInt(reps) || 0 });
  };

  return (
    <div className="set-log-row">
      <div className="set-num">{setIdx + 1}</div>
      <div className="prev-val">{prevSet ? `${prevSet.kg || prevSet.weight || 0}×${prevSet.reps || 0}` : '—'}</div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
        <input
          className={`log-inp ${weight ? 'filled' : ''}`}
          type="number"
          placeholder="kg"
          value={weight}
          onChange={e => setWeight(e.target.value)}
          onBlur={handleBlur}
          disabled={!active}
        />
        <input
          className={`log-inp ${reps ? 'filled' : ''}`}
          type="number"
          placeholder="reps"
          value={reps}
          onChange={e => setReps(e.target.value)}
          onBlur={handleBlur}
          disabled={!active}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* Progressive overload indicator */}
        {set.done && prevSet && (() => {
          const curVol = (parseFloat(weight) || 0) * (parseInt(reps) || 0);
          const prevVol = (prevSet.kg || prevSet.weight || 0) * (prevSet.reps || 0);
          if (curVol > prevVol && prevVol > 0) return <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 700 }}>↑</span>;
          if (curVol < prevVol && curVol > 0) return <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 700 }}>↓</span>;
          return null;
        })()}
        <button
          className={`set-check ${set.done ? 'done' : ''}`}
          onClick={() => active && onComplete(setIdx)}
          style={{ opacity: active ? 1 : 0.5 }}
        >
          {set.done && <Icon name="check" size={12} />}
        </button>
      </div>
    </div>
  );
}

// ---------- Exercise card ----------
function ExerciseCard({ exercise, exerciseIdx, prevData, onUpdate, active }) {
  const [expanded, setExpanded] = useState(false);
  const sets = exercise.sets || [];
  const doneSets = sets.filter(s => s.done).length;
  const totalSets = sets.length;

  const handleSetChange = (setIdx, data) => {
    const updated = [...sets];
    updated[setIdx] = { ...updated[setIdx], ...data };
    onUpdate(exerciseIdx, { ...exercise, sets: updated });
  };

  const handleComplete = (setIdx) => {
    const updated = [...sets];
    updated[setIdx] = { ...updated[setIdx], done: !updated[setIdx].done };
    onUpdate(exerciseIdx, { ...exercise, sets: updated });
  };

  return (
    <div className="ex-row" onClick={() => setExpanded(!expanded)} style={{ display: 'block', cursor: 'pointer' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr auto', alignItems: 'center', gap: 14 }}>
        <div className="ex-num">{exerciseIdx + 1}</div>
        <div>
          <div className="ex-nm">{exercise.name}</div>
          <div className="ex-sets">
            {totalSets} sets · <span>{exercise.targetReps || '8-12'} reps</span>
            {exercise.restSec && <span style={{ color: 'var(--t3)' }}> · {exercise.restSec}s rest</span>}
          </div>
        </div>
        <div className={`ex-tag ${doneSets === totalSets && totalSets > 0 ? 'done-tag' : doneSets > 0 ? 'active-tag' : 'pend-tag'}`}>
          {doneSets === totalSets && totalSets > 0 ? 'Done' : doneSets > 0 ? `${doneSets}/${totalSets}` : 'Pending'}
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 12 }} onClick={e => e.stopPropagation()}>
          <div className="set-log-row set-log-hdr">
            <div>Set</div>
            <div style={{ textAlign: 'center' }}>Previous</div>
            <div style={{ textAlign: 'center' }}>Weight × Reps</div>
            <div />
          </div>
          {sets.map((set, i) => (
            <SetRow
              key={i}
              setIdx={i}
              set={set}
              prevSet={prevData?.[i]}
              onChange={handleSetChange}
              onComplete={handleComplete}
              active={active}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Helper: build exercises with previous data pre-filled ----------
function buildExerciseSets(dayExercises, prevHistory) {
  if (!dayExercises) return [];
  return dayExercises.map(ex => {
    const numSets = ex.numSets || ex.sets || 3;
    // Find previous data for this exercise from history
    const prevSets = prevHistory?.[ex.name] || [];

    return {
      ...ex,
      numSets,
      sets: Array.from({ length: typeof numSets === 'number' ? numSets : 3 }, (_, i) => {
        const prev = prevSets[i];
        const prevKg = prev?.kg || prev?.weight || '';
        const prevReps = prev?.reps || '';
        return {
          weight: prevKg || '',
          reps: prevReps || '',
          kg: prevKg || '',
          done: false, // never pre-mark as done
        };
      }),
    };
  });
}

// ---------- Helper: extract per-exercise set data from history ----------
function extractPrevData(workoutHistory, dayIndex, dayName) {
  // workoutHistory is keyed by day_index, each value is array of sessions
  const sessions = workoutHistory[dayIndex] || workoutHistory[dayName] || [];
  if (!sessions.length) return {};

  // Get the most recent session
  const latest = sessions[0]; // already sorted desc by date
  if (!latest?.sets?.length) return {};

  // Group by exercise name → array of sets sorted by set number
  const byExercise = {};
  latest.sets.forEach(s => {
    const key = s.exercise;
    if (!byExercise[key]) byExercise[key] = [];
    byExercise[key].push({ kg: s.kg, reps: s.reps, set: s.set });
  });
  // Sort each exercise's sets by set number
  Object.values(byExercise).forEach(arr => arr.sort((a, b) => a.set - b.set));
  return byExercise;
}

// ---------- Main ----------
export default function TrainingScreen() {
  const {
    trainingPlan, activeWorkoutDay, setWorkoutDay,
    workoutActive, setWorkoutActive, workoutHistory, setWorkoutHistory,
  } = useClientStore();
  const { user } = useAuthStore();
  const { showToast } = useUIStore();

  const plan = trainingPlan;
  const days = plan?.days || [];
  const currentDay = days[activeWorkoutDay];

  // Extract previous session data for this day
  const prevHistory = extractPrevData(workoutHistory, activeWorkoutDay, currentDay?.name);

  // Local exercise state for the active session
  const [exercises, setExercises] = useState(() => {
    return buildExerciseSets(currentDay?.exercises, prevHistory);
  });
  const [saving, setSaving] = useState(false);

  // Rebuild exercises when switching days or when workout history loads
  useEffect(() => {
    if (workoutActive) return; // Don't rebuild during active workout
    const prev = extractPrevData(workoutHistory, activeWorkoutDay, currentDay?.name);
    setExercises(buildExerciseSets(currentDay?.exercises, prev));
  }, [activeWorkoutDay, currentDay?.name, workoutHistory]);

  const handleExerciseUpdate = useCallback((idx, updated) => {
    setExercises(prev => prev.map((ex, i) => i === idx ? updated : ex));
  }, []);

  const totalSets = exercises.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0);
  const doneSets = exercises.reduce((sum, ex) => sum + (ex.sets?.filter(s => s.done).length || 0), 0);

  const handleFinish = async () => {
    if (!user?.id || !currentDay) return;
    setSaving(true);

    // Build the data for saveWorkoutSession
    // For each exercise: only save sets that have data filled in (weight or reps > 0)
    // Sets that weren't touched keep their previous values from history
    const exercisesToSave = exercises.map(ex => {
      const prevSetsForEx = prevHistory[ex.name] || [];
      return {
        name: ex.name,
        current: (ex.sets || []).map((s, si) => {
          const hasNewData = (s.weight && s.weight !== '' && parseFloat(s.weight) > 0) ||
                            (s.reps && s.reps !== '' && parseInt(s.reps) > 0);
          const wasDone = s.done;
          const prev = prevSetsForEx[si];

          if (wasDone && hasNewData) {
            // User filled in this set — use new data
            return { kg: parseFloat(s.weight) || 0, reps: parseInt(s.reps) || 0, done: true };
          } else if (hasNewData) {
            // Has data but not marked done — save it anyway as done
            return { kg: parseFloat(s.weight) || 0, reps: parseInt(s.reps) || 0, done: true };
          } else if (prev) {
            // Not touched — carry forward previous data
            return { kg: prev.kg || 0, reps: prev.reps || 0, done: true };
          }
          // Completely empty set with no previous data — skip
          return { kg: 0, reps: 0, done: false };
        }),
      };
    });

    const ok = await saveWorkoutSession(
      getClientId(),
      activeWorkoutDay,
      currentDay.name,
      exercisesToSave,
      null,
    );

    setSaving(false);
    if (ok) {
      // Update local workout history so "Previous" column reflects this session immediately
      const today = new Date().toISOString().slice(0, 10);
      const newSession = {
        date: today,
        volume: exercisesToSave.reduce((vol, ex) =>
          vol + ex.current.reduce((v, s) => v + (s.done ? (s.kg || 0) * (s.reps || 0) : 0), 0), 0),
        notes: null,
        sets: exercisesToSave.flatMap(ex =>
          ex.current.map((s, si) => s.done ? { exercise: ex.name, set: si + 1, kg: s.kg, reps: s.reps } : null).filter(Boolean)
        ),
      };
      const updatedHistory = { ...workoutHistory };
      if (!updatedHistory[activeWorkoutDay]) updatedHistory[activeWorkoutDay] = [];
      // Prepend new session (most recent first)
      updatedHistory[activeWorkoutDay] = [newSession, ...updatedHistory[activeWorkoutDay]];
      setWorkoutHistory(updatedHistory);

      showToast('Workout saved! Great work.', 'success');
      setWorkoutActive(false);
    } else {
      showToast('Failed to save workout', 'error');
    }
  };

  const handleStartWorkout = () => {
    // Rebuild with previous data pre-filled
    const prev = extractPrevData(workoutHistory, activeWorkoutDay, currentDay?.name);
    setExercises(buildExerciseSets(currentDay?.exercises, prev));
    setWorkoutActive(true);
  };

  // No plan assigned
  if (!plan || !days.length) {
    return (
      <div className="screen active">
        <Card>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Icon name="dumbbell" size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>No Training Plan</div>
            <div style={{ fontSize: 13, color: 'var(--t3)' }}>
              Your coach hasn't assigned a training plan yet. Check back soon.
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="screen active">
      {/* Day tabs */}
      <div className="modal-tabs" style={{ marginBottom: 18 }}>
        {days.map((day, i) => (
          <div
            key={i}
            className={`mtab ${i === activeWorkoutDay ? 'active' : ''}`}
            onClick={() => { if (!workoutActive) setWorkoutDay(i); }}
            style={{ opacity: workoutActive && i !== activeWorkoutDay ? 0.4 : 1 }}
          >
            {day.name}
          </div>
        ))}
      </div>

      {/* Workout header */}
      <Card
        title={currentDay?.name || 'Workout'}
        subtitle={`${exercises.length} exercises · ${doneSets}/${totalSets} sets completed`}
        actions={
          workoutActive ? (
            <button className="btn btn-green btn-sm" onClick={handleFinish} disabled={saving}>
              <Icon name="check" size={12} /> {saving ? 'Saving...' : 'Finish Workout'}
            </button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={handleStartWorkout}>
              Start Workout
            </button>
          )
        }
      >
        {/* Progress bar */}
        <div className="pbar" style={{ marginTop: 10 }}>
          <div className="pfill gr" style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }} />
        </div>
        {workoutActive && doneSets < totalSets && (
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>
            Fill in the sets you completed — unfilled sets keep their previous values.
          </div>
        )}
      </Card>

      {/* Session Volume Summary */}
      {(() => {
        // Current session volume
        const currentVol = exercises.reduce((vol, ex) =>
          vol + (ex.sets || []).reduce((v, s) => v + (s.done ? (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0) : 0), 0), 0);

        // Previous session volume
        const sessions = workoutHistory[activeWorkoutDay] || [];
        const prevSession = sessions[0];
        const prevVol = prevSession?.volume || 0;

        const volDiff = prevVol > 0 ? currentVol - prevVol : null;
        const volPct = prevVol > 0 ? Math.round(((currentVol - prevVol) / prevVol) * 100) : null;

        // Count PRs (sets where volume > previous)
        let prCount = 0;
        exercises.forEach(ex => {
          const prevSets = prevHistory[ex.name] || [];
          (ex.sets || []).forEach((s, si) => {
            if (!s.done) return;
            const curV = (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0);
            const prevV = prevSets[si] ? (prevSets[si].kg || 0) * (prevSets[si].reps || 0) : 0;
            if (curV > prevV && prevV > 0) prCount++;
          });
        });

        if (!workoutActive && !doneSets) return null;

        return (
          <div className="g3" style={{ marginTop: 14 }}>
            <Card>
              <div className="kl">Volume</div>
              <div style={{ fontSize: 18, fontFamily: 'var(--fd)', color: 'var(--gold)', margin: '4px 0' }}>
                {currentVol.toLocaleString()} <span style={{ fontSize: 11, color: 'var(--t3)' }}>kg</span>
              </div>
              {volDiff != null && (
                <div style={{ fontSize: 10, color: volDiff >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {volDiff >= 0 ? '+' : ''}{volDiff.toLocaleString()} kg ({volPct >= 0 ? '+' : ''}{volPct}%)
                </div>
              )}
            </Card>
            <Card>
              <div className="kl">Sets Done</div>
              <div style={{ fontSize: 18, fontFamily: 'var(--fd)', color: 'var(--blue)', margin: '4px 0' }}>
                {doneSets}/{totalSets}
              </div>
              <div style={{ fontSize: 10, color: 'var(--t3)' }}>
                {totalSets - doneSets > 0 ? `${totalSets - doneSets} remaining` : 'All complete!'}
              </div>
            </Card>
            <Card>
              <div className="kl">PRs</div>
              <div style={{ fontSize: 18, fontFamily: 'var(--fd)', color: prCount > 0 ? 'var(--green)' : 'var(--t3)', margin: '4px 0' }}>
                {prCount}
              </div>
              <div style={{ fontSize: 10, color: 'var(--t3)' }}>
                {prCount > 0 ? 'sets improved!' : 'vs last session'}
              </div>
            </Card>
          </div>
        );
      })()}

      {/* Exercises */}
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {exercises.map((ex, i) => {
          const prevSetsForEx = prevHistory[ex.name] || [];
          return (
            <ExerciseCard
              key={i}
              exercise={ex}
              exerciseIdx={i}
              prevData={prevSetsForEx}
              onUpdate={handleExerciseUpdate}
              active={workoutActive}
            />
          );
        })}
      </div>
    </div>
  );
}
