import { useState, useMemo, useEffect } from 'react';
import { useCoachStore } from '../../stores/coachStore';
import { useAuthStore } from '../../stores/authStore';
import { Card, StatCard } from '../../components/ui';
import { Icon } from '../../utils/icons';
import { supabase } from '../../services/supabase';

// ── Mini SVG sparkline ──
function Sparkline({ data, width = 120, height = 32, color = 'var(--gold)' }) {
  if (!data || data.length < 2) return <div style={{ width, height, opacity: 0.2, fontSize: 10, color: 'var(--t3)', display: 'flex', alignItems: 'center' }}>No data</div>;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ── Donut chart for distribution ──
function DonutChart({ segments, size = 80 }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const r = 32;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const dashLen = pct * circumference;
        const dashOff = -offset;
        offset += dashLen;
        return (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="8"
            strokeDasharray={`${dashLen} ${circumference - dashLen}`}
            strokeDashoffset={dashOff}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ opacity: 0.85 }}
          />
        );
      })}
      <text x={cx} y={cy + 4} textAnchor="middle" fill="var(--t1)" fontSize="14" fontFamily="var(--fd)" fontWeight="600">
        {total}
      </text>
    </svg>
  );
}

// ── Bar chart row ──
function BarRow({ label, value, max, color = 'var(--gold)' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <div style={{ width: 80, fontSize: 11, color: 'var(--t2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--s4)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: color, transition: 'width .3s' }} />
      </div>
      <div style={{ width: 36, fontSize: 11, fontFamily: 'var(--fm)', color: 'var(--t1)', textAlign: 'right' }}>{value}%</div>
    </div>
  );
}

// ── Time range selector ──
function RangeSelector({ value, onChange }) {
  const ranges = [
    { id: '7d', label: '7 days' },
    { id: '30d', label: '30 days' },
    { id: '90d', label: '90 days' },
  ];
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {ranges.map(r => (
        <button
          key={r.id}
          className={`chip ${value === r.id ? 'active' : ''}`}
          onClick={() => onChange(r.id)}
          style={{ fontSize: 10, padding: '4px 10px' }}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

export default function AnalyticsScreen() {
  const { user } = useAuthStore();
  const { clients } = useCoachStore();
  const [range, setRange] = useState('30d');
  const [weightData, setWeightData] = useState({});
  const [checkinData, setCheckinData] = useState({});
  const [loading, setLoading] = useState(true);

  const coachId = user?.id;
  const clientIds = useMemo(() => clients.map(c => c.client_id || c.id), [clients]);

  // Fetch aggregate data for all clients
  useEffect(() => {
    if (!coachId || !clientIds.length) { setLoading(false); return; }

    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().slice(0, 10);

    const fetchAll = async () => {
      setLoading(true);
      try {
        // Weight logs
        const { data: weights } = await supabase
          .from('weight_log')
          .select('client_id, date, weight')
          .in('client_id', clientIds)
          .gte('date', sinceStr)
          .order('date');

        // Daily checkins
        const { data: checkins } = await supabase
          .from('daily_checkins')
          .select('client_id, date')
          .in('client_id', clientIds)
          .gte('date', sinceStr);

        // Group by client
        const wByClient = {};
        (weights || []).forEach(w => {
          if (!wByClient[w.client_id]) wByClient[w.client_id] = [];
          wByClient[w.client_id].push(w);
        });

        const cByClient = {};
        (checkins || []).forEach(c => {
          if (!cByClient[c.client_id]) cByClient[c.client_id] = [];
          cByClient[c.client_id].push(c);
        });

        setWeightData(wByClient);
        setCheckinData(cByClient);
      } catch (err) {
        console.warn('[Analytics] fetch error:', err);
      }
      setLoading(false);
    };

    fetchAll();
  }, [coachId, clientIds.join(','), range]);

  // ── Computed metrics ──
  const metrics = useMemo(() => {
    const totalClients = clients.length;
    if (!totalClients) return null;

    // Status distribution
    const onTrack = clients.filter(c => (c.status || 'on-track') === 'on-track').length;
    const attention = clients.filter(c => c.status === 'attention').length;
    const atRisk = clients.filter(c => c.status === 'at-risk').length;

    // Adherence distribution buckets
    const adherences = clients.map(c => c.adherence || 0);
    const high = adherences.filter(a => a >= 80).length;
    const mid = adherences.filter(a => a >= 50 && a < 80).length;
    const low = adherences.filter(a => a < 50).length;
    const avgAdherence = Math.round(adherences.reduce((s, a) => s + a, 0) / totalClients);

    // Goal distribution
    const goalCounts = {};
    clients.forEach(c => {
      const g = c.goal || 'unknown';
      goalCounts[g] = (goalCounts[g] || 0) + 1;
    });

    // Weight progress per client
    const progressList = [];
    clients.forEach(c => {
      const id = c.client_id || c.id;
      const wl = weightData[id];
      if (wl && wl.length >= 2) {
        const sorted = [...wl].sort((a, b) => a.date.localeCompare(b.date));
        const change = sorted[sorted.length - 1].weight - sorted[0].weight;
        progressList.push({
          name: c.client_name || c.name || 'Client',
          change: parseFloat(change.toFixed(1)),
          sparkData: sorted.map(w => w.weight),
          adherence: c.adherence || 0,
          status: c.status || 'on-track',
        });
      }
    });

    // Check-in consistency per client
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const checkinRates = clients.map(c => {
      const id = c.client_id || c.id;
      const cl = checkinData[id] || [];
      const uniqueDays = new Set(cl.map(x => x.date)).size;
      return { name: c.client_name || c.name || 'Client', rate: Math.round((uniqueDays / days) * 100) };
    }).sort((a, b) => b.rate - a.rate);

    return {
      totalClients,
      avgAdherence,
      onTrack, attention, atRisk,
      adherenceHigh: high, adherenceMid: mid, adherenceLow: low,
      goalCounts,
      progressList: progressList.sort((a, b) => a.change - b.change),
      checkinRates,
    };
  }, [clients, weightData, checkinData, range]);

  // ── Goal label map ──
  const goalLabels = {
    cut: 'Cut', 'lean-bulk': 'Lean Bulk', recomp: 'Recomp',
    maintenance: 'Maintenance', 'comp-prep': 'Comp Prep', unknown: 'Not Set',
  };
  const goalColors = {
    cut: 'var(--red)', 'lean-bulk': 'var(--green)', recomp: 'var(--blue)',
    maintenance: 'var(--t3)', 'comp-prep': 'var(--gold)', unknown: 'var(--t3)',
  };

  if (loading && !metrics) {
    return (
      <div className="screen active" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ fontSize: 13, color: 'var(--t3)' }}>Loading analytics...</div>
      </div>
    );
  }

  if (!clients.length) {
    return (
      <div className="screen active">
        <Card>
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--t3)' }}>
            <Icon name="bar-chart" size={32} style={{ opacity: 0.2, display: 'block', margin: '0 auto 14px' }} />
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6, color: 'var(--t2)' }}>No data yet</div>
            <div style={{ fontSize: 12 }}>Analytics will appear once you have active clients.</div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="screen active">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div className="kl">Analytics</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>
            Performance trends across {metrics?.totalClients || 0} client{metrics?.totalClients !== 1 ? 's' : ''}
          </div>
        </div>
        <RangeSelector value={range} onChange={setRange} />
      </div>

      {/* Top-level stats */}
      <div className="g4" style={{ marginBottom: 18 }}>
        <StatCard label="Total Clients" value={metrics?.totalClients || 0} color="var(--gold)" />
        <StatCard label="Avg Adherence" value={`${metrics?.avgAdherence || 0}%`} color={metrics?.avgAdherence >= 70 ? 'var(--green)' : 'var(--orange)'} />
        <StatCard label="On Track" value={metrics?.onTrack || 0} color="var(--green)" />
        <StatCard label="At Risk" value={metrics?.atRisk || 0} color={metrics?.atRisk > 0 ? 'var(--red)' : 'var(--green)'} />
      </div>

      <div className="g5050" style={{ gap: 14, marginBottom: 14 }}>
        {/* Status Distribution */}
        <Card title="Client Status" subtitle="Current distribution">
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '8px 0' }}>
            <DonutChart
              segments={[
                { value: metrics?.onTrack || 0, color: 'var(--green)' },
                { value: metrics?.attention || 0, color: 'var(--orange)' },
                { value: metrics?.atRisk || 0, color: 'var(--red)' },
              ]}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'On Track', value: metrics?.onTrack || 0, color: 'var(--green)' },
                { label: 'Needs Attention', value: metrics?.attention || 0, color: 'var(--orange)' },
                { label: 'At Risk', value: metrics?.atRisk || 0, color: 'var(--red)' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                  <span style={{ fontSize: 11, color: 'var(--t2)' }}>{s.label}</span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--fm)', color: 'var(--t1)', marginLeft: 'auto' }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Goal Distribution */}
        <Card title="Goal Breakdown" subtitle="What clients are working on">
          <div style={{ padding: '8px 0' }}>
            {Object.entries(metrics?.goalCounts || {}).sort((a, b) => b[1] - a[1]).map(([goal, count]) => {
              const pct = Math.round((count / (metrics?.totalClients || 1)) * 100);
              return (
                <div key={goal} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 75, fontSize: 11, color: goalColors[goal] || 'var(--t2)', fontWeight: 500 }}>
                    {goalLabels[goal] || goal}
                  </div>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--s4)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: goalColors[goal] || 'var(--t3)', transition: 'width .3s' }} />
                  </div>
                  <div style={{ width: 40, fontSize: 11, fontFamily: 'var(--fm)', color: 'var(--t1)', textAlign: 'right' }}>
                    {count} ({pct}%)
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="g5050" style={{ gap: 14, marginBottom: 14 }}>
        {/* Adherence Distribution */}
        <Card title="Adherence Levels" subtitle="Client consistency breakdown">
          <div style={{ padding: '8px 0' }}>
            <BarRow label="High (80%+)" value={metrics ? Math.round((metrics.adherenceHigh / metrics.totalClients) * 100) : 0} max={100} color="var(--green)" />
            <BarRow label="Medium (50-79%)" value={metrics ? Math.round((metrics.adherenceMid / metrics.totalClients) * 100) : 0} max={100} color="var(--orange)" />
            <BarRow label="Low (<50%)" value={metrics ? Math.round((metrics.adherenceLow / metrics.totalClients) * 100) : 0} max={100} color="var(--red)" />
          </div>
          <div style={{ fontSize: 11, color: 'var(--t3)', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
            {metrics?.adherenceHigh || 0} of {metrics?.totalClients || 0} clients above 80% adherence
          </div>
        </Card>

        {/* Check-in Consistency */}
        <Card title="Check-in Consistency" subtitle="Daily check-in completion rate">
          <div style={{ padding: '8px 0', maxHeight: 180, overflowY: 'auto' }}>
            {(metrics?.checkinRates || []).map((c, i) => (
              <BarRow key={i} label={c.name} value={c.rate} max={100} color={c.rate >= 70 ? 'var(--green)' : c.rate >= 40 ? 'var(--orange)' : 'var(--red)'} />
            ))}
            {!metrics?.checkinRates?.length && (
              <div style={{ fontSize: 11, color: 'var(--t3)', padding: 16, textAlign: 'center' }}>No check-in data yet</div>
            )}
          </div>
        </Card>
      </div>

      {/* Weight Progress Table */}
      <Card title="Weight Progress" subtitle={`Change over last ${range === '7d' ? '7 days' : range === '90d' ? '90 days' : '30 days'}`}>
        {(metrics?.progressList || []).length > 0 ? (
          <table className="tbl" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Client</th>
                <th>Trend</th>
                <th>Change</th>
                <th>Adherence</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {metrics.progressList.map((c, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td><Sparkline data={c.sparkData} width={80} height={24} color={c.change < 0 ? 'var(--green)' : c.change > 0 ? 'var(--orange)' : 'var(--t3)'} /></td>
                  <td>
                    <span style={{
                      fontFamily: 'var(--fm)',
                      color: c.change < 0 ? 'var(--green)' : c.change > 0 ? 'var(--orange)' : 'var(--t2)',
                    }}>
                      {c.change > 0 ? '+' : ''}{c.change} kg
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--fm)', color: c.adherence >= 80 ? 'var(--green)' : c.adherence >= 50 ? 'var(--orange)' : 'var(--red)' }}>
                      {c.adherence}%
                    </span>
                  </td>
                  <td>
                    <span className={`tag ${c.status === 'on-track' ? 't-gr' : c.status === 'attention' ? 't-or' : 't-rd'}`} style={{ fontSize: 9 }}>
                      {c.status === 'on-track' ? 'On Track' : c.status === 'attention' ? 'Attention' : 'At Risk'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--t3)', padding: 24, textAlign: 'center' }}>
            Weight data will appear here once clients start logging.
          </div>
        )}
      </Card>
    </div>
  );
}
