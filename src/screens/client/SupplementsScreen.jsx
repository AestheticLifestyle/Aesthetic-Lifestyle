import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui';
import { Icon } from '../../utils/icons';
import { fetchClientSupplements } from '../../services/supplements';
import { supabase } from '../../services/supabase';

const TIMING_ORDER = ['morning', 'with-meal', 'pre-workout', 'intra-workout', 'post-workout', 'before-bed', 'any-time'];

const TIMING_META = {
  'morning':        { label: 'Morning',        emoji: '🌅', color: 'var(--orange)' },
  'pre-workout':    { label: 'Pre-Workout',     emoji: '💪', color: 'var(--green)' },
  'intra-workout':  { label: 'Intra-Workout',   emoji: '🏋️', color: 'var(--blue)' },
  'post-workout':   { label: 'Post-Workout',    emoji: '🔄', color: 'var(--green)' },
  'with-meal':      { label: 'With Meal',        emoji: '🍽️', color: 'var(--gold)' },
  'before-bed':     { label: 'Before Bed',       emoji: '🌙', color: 'var(--purple, #a78bfa)' },
  'any-time':       { label: 'Any Time',         emoji: '⏰', color: 'var(--t2)' },
};

export default function SupplementsScreen() {
  const { user, actualRole, role } = useAuthStore();
  const isCoachPreview = actualRole === 'coach' && role === 'client';
  const [supplements, setSupplements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      let data;
      if (isCoachPreview) {
        // Coach previewing as client — show first client's supplements
        const { data: rows, error } = await supabase
          .from('client_supplements')
          .select('*')
          .eq('coach_id', user.id)
          .eq('is_active', true)
          .order('sort_order')
          .order('created_at');
        data = rows || [];
      } else {
        data = await fetchClientSupplements(user.id);
      }
      if (!cancelled) {
        setSupplements(data);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user?.id, isCoachPreview]);

  const grouped = useMemo(() => {
    const groups = {};
    supplements.forEach(s => {
      const key = s.timing || 'any-time';
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    // Sort by timing order
    return TIMING_ORDER
      .filter(t => groups[t]?.length > 0)
      .map(t => ({ timing: t, items: groups[t], meta: TIMING_META[t] || TIMING_META['any-time'] }));
  }, [supplements]);

  if (loading) {
    return (
      <div className="screen active">
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>My Supplements</div>
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--t3)', fontSize: 13 }}>
          Loading your supplement plan...
        </div>
      </div>
    );
  }

  return (
    <div className="screen active">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>My Supplements</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>
            {supplements.length} supplement{supplements.length !== 1 ? 's' : ''} in your protocol
          </div>
        </div>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', background: 'var(--gold-d)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 20 }}>💊</span>
        </div>
      </div>

      {supplements.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: 30 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>💊</div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>No Supplements Yet</div>
            <div style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.5 }}>
              Your coach hasn't assigned any supplements yet.<br />
              Check back soon or ask your coach about it.
            </div>
          </div>
        </Card>
      ) : (
        grouped.map(({ timing, items, meta }) => (
          <Card key={timing} style={{ marginBottom: 12 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
              paddingBottom: 8, borderBottom: '1px solid var(--b2)',
            }}>
              <span style={{ fontSize: 18 }}>{meta.emoji}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{meta.label}</div>
                <div style={{ fontSize: 10, color: 'var(--t3)' }}>
                  {items.length} supplement{items.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {items.map((supp, i) => (
              <div key={supp.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                borderBottom: i < items.length - 1 ? '1px solid var(--b2)' : 'none',
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'var(--gold-d)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon name="pill" size={13} style={{ color: 'var(--gold)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{supp.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                    {supp.dosage || 'See coach for dosage'}
                  </div>
                  {supp.notes && (
                    <div style={{ fontSize: 10, color: 'var(--gold)', marginTop: 2, fontStyle: 'italic' }}>
                      {supp.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </Card>
        ))
      )}
    </div>
  );
}
