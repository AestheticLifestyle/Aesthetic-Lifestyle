import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui';
import { Icon } from '../../utils/icons';
import { useT } from '../../i18n';
import { fetchClientSupplements } from '../../services/supplements';
import { supabase } from '../../services/supabase';

const TIMING_ORDER = ['morning', 'with-meal', 'pre-workout', 'intra-workout', 'post-workout', 'before-bed', 'any-time'];

const createTimingMeta = (t) => ({
  'morning':        { label: t('timingMorning'),        emoji: '🌅', color: 'var(--orange)' },
  'pre-workout':    { label: t('timingPreWorkout'),     emoji: '💪', color: 'var(--green)' },
  'intra-workout':  { label: t('timingIntraWorkout'),   emoji: '🏋️', color: 'var(--blue)' },
  'post-workout':   { label: t('timingPostWorkout'),    emoji: '🔄', color: 'var(--green)' },
  'with-meal':      { label: t('timingWithMeal'),       emoji: '🍽️', color: 'var(--gold)' },
  'before-bed':     { label: t('timingBeforeBed'),      emoji: '🌙', color: 'var(--purple, #a78bfa)' },
  'any-time':       { label: t('timingAnyTime'),        emoji: '⏰', color: 'var(--t2)' },
});

export default function SupplementsScreen() {
  const t = useT();
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
    const timingMeta = createTimingMeta(t);
    const groups = {};
    supplements.forEach(s => {
      const key = s.timing || 'any-time';
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    // Sort by timing order
    return TIMING_ORDER
      .filter(timing => groups[timing]?.length > 0)
      .map(timing => ({ timing, items: groups[timing], meta: timingMeta[timing] || timingMeta['any-time'] }));
  }, [supplements, t]);

  if (loading) {
    return (
      <div className="screen active">
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>{t('mySupplements')}</div>
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--t3)', fontSize: 13 }}>
          {t('loading')}
        </div>
      </div>
    );
  }

  return (
    <div className="screen active">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{t('mySupplements')}</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>
            {(supplements || []).length} {(supplements || []).length === 1 ? t('supplementInProtocol') : t('supplementsInProtocol')}
          </div>
        </div>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', background: 'var(--gold-d)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 20 }}>💊</span>
        </div>
      </div>

      {(supplements || []).length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: 30 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>💊</div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>{t('noSupplementsYet')}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.5 }}>
              {t('noSupplementsDesc')}
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
                    {supp.dosage || t('seeCoachForDosage')}
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
