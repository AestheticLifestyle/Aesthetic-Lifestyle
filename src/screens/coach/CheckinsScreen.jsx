import { useState, useCallback } from 'react';
import { useCoachStore } from '../../stores/coachStore';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui';
import { Icon } from '../../utils/icons';
import { useUIStore } from '../../stores/uiStore';
import { formatShortDate } from '../../utils/constants';
import { saveCoachFeedback } from '../../services/checkins';
import { fetchPendingCheckins } from '../../services/chat';

// ── Check-in card ──
function CheckinCard({ checkin, onReview }) {
  const name = checkin.client_name || 'Client';
  const isWeekly = checkin.type === 'weekly';
  const isDaily = checkin.type === 'daily';

  // Daily check-ins: show "Logged" or "Commented" instead of Pending/Reviewed
  const getStatusTag = () => {
    if (isDaily) {
      if (checkin.coach_feedback) return { cls: 't-gr', label: 'Commented' };
      return { cls: '', label: 'Logged', style: { background: 'var(--s3)', color: 'var(--t2)' } };
    }
    if (checkin.status === 'pending') return { cls: 't-or', label: 'Needs Review' };
    return { cls: 't-gr', label: 'Reviewed' };
  };
  const tag = getStatusTag();

  return (
    <Card style={{ cursor: 'pointer' }} onClick={() => onReview(checkin)}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', background: 'var(--gold-d)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--gold)', fontFamily: 'var(--fd)', fontSize: 14,
          }}>
            {name.charAt(0)}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{name}</div>
            <div style={{ fontSize: 11, color: 'var(--t3)' }}>
              {checkin.date ? formatShortDate(checkin.date) : '—'} · {isWeekly ? `Week ${checkin.week_number} — Weekly` : 'Daily'}
            </div>
          </div>
        </div>
        <span className={`tag ${tag.cls}`} style={tag.style || {}}>
          {tag.label}
        </span>
      </div>

      {/* Quick stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
        {checkin.weight != null && (
          <div>
            <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--t3)' }}>Weight</div>
            <div style={{ fontSize: 14, fontFamily: 'var(--fd)' }}>{checkin.weight} kg</div>
          </div>
        )}
        {checkin.mood && (
          <div>
            <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--t3)' }}>Mood</div>
            <div style={{ fontSize: 14 }}>{checkin.mood}</div>
          </div>
        )}
        {checkin.sleep != null && (
          <div>
            <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--t3)' }}>Sleep</div>
            <div style={{ fontSize: 14, fontFamily: 'var(--fd)', color: checkin.sleep >= 7 ? 'var(--green)' : 'var(--orange)' }}>
              {checkin.sleep}/10
            </div>
          </div>
        )}
        {checkin.energy != null && (
          <div>
            <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--t3)' }}>Energy</div>
            <div style={{ fontSize: 14, fontFamily: 'var(--fd)', color: checkin.energy >= 7 ? 'var(--green)' : 'var(--orange)' }}>
              {checkin.energy}/10
            </div>
          </div>
        )}
        {checkin.stress != null && (
          <div>
            <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--t3)' }}>Stress</div>
            <div style={{ fontSize: 14, fontFamily: 'var(--fd)', color: checkin.stress <= 4 ? 'var(--green)' : 'var(--orange)' }}>
              {checkin.stress}/10
            </div>
          </div>
        )}
        {isWeekly && checkin.nutrition_adherence != null && (
          <div>
            <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--t3)' }}>Nutrition</div>
            <div style={{ fontSize: 14, fontFamily: 'var(--fd)', color: checkin.nutrition_adherence >= 7 ? 'var(--green)' : 'var(--orange)' }}>
              {checkin.nutrition_adherence}/10
            </div>
          </div>
        )}
        {isWeekly && checkin.workouts_completed != null && (
          <div>
            <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--t3)' }}>Workouts</div>
            <div style={{ fontSize: 14, fontFamily: 'var(--fd)', color: 'var(--blue)' }}>{checkin.workouts_completed}</div>
          </div>
        )}
      </div>

      {/* Notes preview */}
      {checkin.notes && (
        <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5 }}>
          {checkin.notes.length > 120 ? checkin.notes.slice(0, 120) + '...' : checkin.notes}
        </div>
      )}
    </Card>
  );
}

// ── Stat row helper ──
function StatRow({ label, value, color, suffix }) {
  if (value == null) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--t3)' }}>{label}</span>
      <span style={{ fontSize: 13, fontFamily: 'var(--fd)', color: color || 'var(--t1)' }}>{value}{suffix || ''}</span>
    </div>
  );
}

// ── Review panel (slide-in) ──
function ReviewPanel({ checkin, onClose, onFeedbackSaved }) {
  const [feedback, setFeedback] = useState(checkin?.coach_feedback || '');
  const [saving, setSaving] = useState(false);
  const { showToast } = useUIStore();
  const name = checkin?.client_name || 'Client';
  const isWeekly = checkin?.type === 'weekly';

  if (!checkin) return null;

  const handleSubmit = async () => {
    if (!feedback.trim() || !checkin.id) return;
    setSaving(true);
    const ok = await saveCoachFeedback(checkin.id, feedback.trim(), checkin.type || 'weekly');
    setSaving(false);
    if (ok) {
      showToast('Feedback submitted!', 'success');
      onFeedbackSaved(checkin.id, feedback.trim());
      onClose();
    } else {
      showToast('Failed to save feedback', 'error');
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(520px, 92vw)', background: 'var(--s0)', borderLeft: '1px solid var(--border)', zIndex: 300, display: 'flex', flexDirection: 'column', animation: 'slideIn .25s ease' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <h3 style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>
          {name} — {isWeekly ? `Week ${checkin.week_number}` : 'Daily'}
        </h3>
        {isWeekly ? (
          <span className={`tag ${checkin.status === 'pending' ? 't-or' : 't-gr'}`} style={{ fontSize: 10 }}>
            {checkin.status === 'pending' ? 'Needs Review' : 'Reviewed'}
          </span>
        ) : (
          <span className="tag" style={{ fontSize: 10, background: checkin.coach_feedback ? 'var(--green)' : 'var(--s3)', color: checkin.coach_feedback ? '#fff' : 'var(--t2)' }}>
            {checkin.coach_feedback ? 'Commented' : 'Daily Log'}
          </span>
        )}
        <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {/* Date */}
        <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 14 }}>
          {checkin.date ? formatShortDate(checkin.date) : '—'}
        </div>

        {/* Mood */}
        {checkin.mood && (
          <div style={{ marginBottom: 14 }}>
            <div className="kl" style={{ marginBottom: 4 }}>Overall Mood</div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>{checkin.mood}</div>
          </div>
        )}

        {/* Stats grid */}
        <Card style={{ marginBottom: 14 }}>
          <StatRow label="Sleep Quality" value={checkin.sleep} suffix="/10" color={checkin.sleep >= 7 ? 'var(--green)' : 'var(--orange)'} />
          <StatRow label="Energy" value={checkin.energy} suffix="/10" color={checkin.energy >= 7 ? 'var(--green)' : 'var(--orange)'} />
          {checkin.stress != null && <StatRow label="Stress" value={checkin.stress} suffix="/10" color={checkin.stress <= 4 ? 'var(--green)' : 'var(--orange)'} />}
          {checkin.weight != null && <StatRow label="Weight" value={checkin.weight} suffix=" kg" />}
          {isWeekly && <>
            <StatRow label="Digestion" value={checkin.digestion} suffix="/10" />
            <StatRow label="Motivation" value={checkin.motivation} suffix="/10" color={checkin.motivation >= 7 ? 'var(--green)' : 'var(--orange)'} />
            <StatRow label="Nutrition Adherence" value={checkin.nutrition_adherence} suffix="/10" color={checkin.nutrition_adherence >= 7 ? 'var(--green)' : 'var(--orange)'} />
            <StatRow label="Workouts Completed" value={checkin.workouts_completed} color="var(--blue)" />
            <StatRow label="Avg Water" value={checkin.water_avg} suffix=" L/day" />
            <StatRow label="Steps Goal" value={checkin.steps_goal} />
            <StatRow label="Pain" value={checkin.pain === 'no' ? 'None' : checkin.pain === 'yes-minor' ? 'Minor' : checkin.pain === 'yes-major' ? 'Major' : checkin.pain} />
          </>}
        </Card>

        {/* Pain detail */}
        {isWeekly && checkin.pain !== 'no' && checkin.pain_detail && (
          <div style={{ marginBottom: 14 }}>
            <div className="kl" style={{ marginBottom: 6 }}>Pain Details</div>
            <div style={{ fontSize: 13, color: 'var(--t2)', background: 'var(--s2)', padding: 12, borderRadius: 9, border: '1px solid var(--border)', lineHeight: 1.5 }}>
              {checkin.pain_detail}
            </div>
          </div>
        )}

        {/* Weekly written responses */}
        {isWeekly && (
          <>
            {checkin.what_went_well && (
              <div style={{ marginBottom: 14 }}>
                <div className="kl" style={{ marginBottom: 6 }}>What Went Well</div>
                <div style={{ fontSize: 13, color: 'var(--t2)', background: 'var(--s2)', padding: 12, borderRadius: 9, border: '1px solid var(--border)', lineHeight: 1.5 }}>
                  {checkin.what_went_well}
                </div>
              </div>
            )}
            {checkin.biggest_struggle && (
              <div style={{ marginBottom: 14 }}>
                <div className="kl" style={{ marginBottom: 6 }}>Biggest Struggle</div>
                <div style={{ fontSize: 13, color: 'var(--t2)', background: 'var(--s2)', padding: 12, borderRadius: 9, border: '1px solid var(--border)', lineHeight: 1.5 }}>
                  {checkin.biggest_struggle}
                </div>
              </div>
            )}
            {checkin.what_to_improve && (
              <div style={{ marginBottom: 14 }}>
                <div className="kl" style={{ marginBottom: 6 }}>What to Improve</div>
                <div style={{ fontSize: 13, color: 'var(--t2)', background: 'var(--s2)', padding: 12, borderRadius: 9, border: '1px solid var(--border)', lineHeight: 1.5 }}>
                  {checkin.what_to_improve}
                </div>
              </div>
            )}
            {checkin.questions_for_coach && (
              <div style={{ marginBottom: 14 }}>
                <div className="kl" style={{ marginBottom: 6 }}>Questions for Coach</div>
                <div style={{ fontSize: 13, color: 'var(--gold)', background: 'var(--gold-d)', padding: 12, borderRadius: 9, border: '1px solid var(--gold)', lineHeight: 1.5 }}>
                  {checkin.questions_for_coach}
                </div>
              </div>
            )}
          </>
        )}

        {/* Daily notes */}
        {!isWeekly && checkin.notes && (
          <div style={{ marginBottom: 14 }}>
            <div className="kl" style={{ marginBottom: 6 }}>Client Notes</div>
            <div style={{ fontSize: 13, color: 'var(--t2)', background: 'var(--s2)', padding: 12, borderRadius: 9, border: '1px solid var(--border)', lineHeight: 1.5 }}>
              {checkin.notes}
            </div>
          </div>
        )}

        {/* Existing coach feedback */}
        {checkin.coach_feedback && (
          <div style={{ marginBottom: 14 }}>
            <div className="kl" style={{ marginBottom: 6 }}>Your Previous Feedback</div>
            <div style={{ fontSize: 13, color: 'var(--t1)', background: 'var(--gold-d)', padding: 12, borderRadius: 9, border: '1px solid var(--gold)', lineHeight: 1.5 }}>
              {checkin.coach_feedback}
            </div>
          </div>
        )}

        {/* Coach feedback input */}
        <div className="kl" style={{ marginBottom: 6 }}>
          {isWeekly
            ? (checkin.coach_feedback ? 'Update Feedback' : 'Your Feedback')
            : (checkin.coach_feedback ? 'Update Comment' : 'Leave a Comment (optional)')
          }
        </div>
        <textarea
          className="t-area"
          placeholder={isWeekly ? 'Write your feedback, adjustments, or encouragement...' : 'Leave a quick note for your client...'}
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
          rows={isWeekly ? 5 : 3}
        />
      </div>

      {/* Footer actions */}
      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
        <button
          className="btn btn-primary"
          style={{ flex: 1 }}
          disabled={!feedback.trim() || saving}
          onClick={handleSubmit}
        >
          <Icon name="send" size={12} /> {saving ? 'Saving...' : isWeekly ? 'Submit Review' : 'Send Comment'}
        </button>
      </div>
    </div>
  );
}

// ── Empty state ──
function EmptyState({ filter }) {
  return (
    <Card>
      <div style={{ textAlign: 'center', padding: 50, color: 'var(--t3)' }}>
        <Icon name="clipboard" size={28} style={{ opacity: 0.2, display: 'block', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 13 }}>
          {filter === 'pending'
            ? 'All caught up! No weekly check-ins to review.'
            : filter === 'daily'
            ? 'No daily check-ins yet.'
            : 'No check-ins found.'
          }
        </div>
      </div>
    </Card>
  );
}

// ══════════════════════════════════════
// Main
// ══════════════════════════════════════
export default function CheckinsScreen() {
  const { pendingCheckins, setPendingCheckins } = useCoachStore();
  const { user } = useAuthStore();
  const { showToast } = useUIStore();
  const [filter, setFilter] = useState('pending');
  const [reviewCheckin, setReviewCheckin] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const filtered = pendingCheckins.filter(c => {
    if (filter === 'all') return true;
    if (filter === 'pending') return c.type === 'weekly' && c.status === 'pending';
    if (filter === 'reviewed') return c.type === 'weekly' && c.status === 'reviewed';
    if (filter === 'weekly') return c.type === 'weekly';
    if (filter === 'daily') return c.type === 'daily';
    return true;
  });

  // Only weekly check-ins count as "pending review"
  const pendingCount = pendingCheckins.filter(c => c.type === 'weekly' && c.status === 'pending').length;

  const handleRefresh = useCallback(async () => {
    if (!user?.id) return;
    setRefreshing(true);
    const data = await fetchPendingCheckins(user.id);
    setPendingCheckins(data || []);
    setRefreshing(false);
    showToast('Check-ins refreshed', 'success');
  }, [user?.id, setPendingCheckins, showToast]);

  const handleFeedbackSaved = useCallback((checkinId, feedback) => {
    // Update local state to mark as reviewed
    const updated = pendingCheckins.map(c =>
      c.id === checkinId ? { ...c, status: 'reviewed', coach_feedback: feedback } : c
    );
    setPendingCheckins(updated);
  }, [pendingCheckins, setPendingCheckins]);

  return (
    <div className="screen active">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 4 }}>
            {pendingCount > 0 ? `${pendingCount} weekly check-in${pendingCount > 1 ? 's' : ''} need${pendingCount === 1 ? 's' : ''} your review` : 'All weekly check-ins reviewed'}
          </div>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleRefresh}
          disabled={refreshing}
          style={{ fontSize: 11 }}
        >
          <Icon name="refresh" size={11} /> {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {['pending', 'weekly', 'daily', 'reviewed', 'all'].map(f => (
          <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'pending' && pendingCount > 0 && (
              <span style={{ marginLeft: 4, background: 'var(--orange)', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Check-in list */}
      {filtered.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(ci => (
            <CheckinCard key={ci.id} checkin={ci} onReview={setReviewCheckin} />
          ))}
        </div>
      )}

      {/* Review slide-in panel */}
      {reviewCheckin && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 299 }} onClick={() => setReviewCheckin(null)} />
          <ReviewPanel
            checkin={reviewCheckin}
            onClose={() => setReviewCheckin(null)}
            onFeedbackSaved={handleFeedbackSaved}
          />
        </>
      )}
    </div>
  );
}
