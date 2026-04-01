import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCoachStore } from '../../stores/coachStore';
import { useAuthStore } from '../../stores/authStore';
import { Card, StatCard } from '../../components/ui';
import { Icon } from '../../utils/icons';
import { generateClientAlerts } from '../../utils/coachingInsights';
import { getLevelFromXP } from '../../utils/gamification';

function ClientRow({ client, onClick }) {
  const statusColors = {
    'on-track': 'var(--green)',
    'attention': 'var(--orange)',
    'at-risk': 'var(--red)',
  };
  const statusLabels = {
    'on-track': 'On Track',
    'attention': 'Needs Attention',
    'at-risk': 'At Risk',
  };

  const status = client.status || 'on-track';
  const adherence = client.adherence || 0;
  const name = client.client_name || client.name || 'Unknown';
  const gam = client.gamification;
  const clientLevel = gam ? getLevelFromXP(gam.totalXP || 0) : null;
  const clientStreak = gam?.streak?.current || client.streak || 0;

  return (
    <tr onClick={onClick}>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'var(--gold-d)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--gold)', fontSize: 11, fontWeight: 600, fontFamily: 'var(--fd)',
            }}>
              {name.charAt(0)}
            </div>
            {clientLevel && clientLevel.level > 1 && (
              <div style={{
                position: 'absolute', bottom: -3, right: -3,
                width: 14, height: 14, borderRadius: '50%',
                background: clientLevel.color, color: '#fff',
                fontSize: 7, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1.5px solid var(--s1)',
              }}>
                {clientLevel.level}
              </div>
            )}
          </div>
          <div>
            <span style={{ fontWeight: 500, color: 'var(--t1)' }}>{name}</span>
            {clientStreak >= 7 && (
              <span style={{ fontSize: 10, marginLeft: 6, color: '#ff6b35' }}>
                🔥{clientStreak}
              </span>
            )}
          </div>
        </div>
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 40, height: 4, borderRadius: 100, background: 'var(--s4)', overflow: 'hidden',
          }}>
            <div style={{
              width: `${adherence}%`, height: '100%', borderRadius: 100,
              background: adherence > 80 ? 'var(--green)' : adherence > 60 ? 'var(--orange)' : 'var(--red)',
            }} />
          </div>
          <span style={{ fontFamily: 'var(--fm)', fontSize: 12 }}>{adherence}%</span>
        </div>
      </td>
      <td>
        <span className={`tag ${status === 'on-track' ? 't-gr' : status === 'attention' ? 't-or' : 't-rd'}`}>
          {statusLabels[status] || status}
        </span>
      </td>
      <td style={{ fontSize: 12, color: 'var(--t3)' }}>{client.lastActive || '—'}</td>
    </tr>
  );
}

function EmptyState() {
  return (
    <Card>
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--t3)' }}>
        <Icon name="user" size={32} style={{ opacity: 0.2, display: 'block', margin: '0 auto 14px' }} />
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6, color: 'var(--t2)' }}>No clients yet</div>
        <div style={{ fontSize: 12 }}>Your clients will appear here once they join your coaching program.</div>
      </div>
    </Card>
  );
}

export default function OverviewScreen() {
  const { user } = useAuthStore();
  const { clients, stats } = useCoachStore();
  const navigate = useNavigate();
  const coachName = user?.user_metadata?.full_name?.split(' ')[0] || 'Coach';

  const avgAdherence = useMemo(() => {
    if (!clients.length) return 0;
    const sum = clients.reduce((s, c) => s + (c.adherence || 0), 0);
    return Math.round(sum / clients.length);
  }, [clients]);

  const atRisk = clients.filter(c => c.status === 'at-risk').length;

  return (
    <div className="screen active">
      {/* Welcome */}
      <Card style={{ marginBottom: 18 }}>
        <div className="kl">Command Center</div>
        <div style={{ fontFamily: 'var(--fd)', fontSize: 22, letterSpacing: 1.5, marginTop: 6 }}>
          WELCOME BACK, {coachName.toUpperCase()}
        </div>
        <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>
          {clients.length} athletes active · {atRisk > 0 ? `${atRisk} need attention` : 'All on track'}
        </div>
      </Card>

      {/* Stats */}
      <div className="g4">
        <StatCard label="Total Clients" value={clients.length} color="var(--gold)" />
        <StatCard label="Avg Adherence" value={clients.length ? `${avgAdherence}%` : '—'} color="var(--blue)" />
        <StatCard label="Pending Check-ins" value={stats.pendingCheckins || 0} color="var(--orange)" />
        <StatCard
          label="At Risk"
          value={atRisk}
          color={atRisk > 0 ? 'var(--red)' : 'var(--green)'}
        />
      </div>

      {/* Coaching Alerts */}
      {(() => {
        const allAlerts = clients.flatMap(c => {
          const alerts = generateClientAlerts(c, []);
          return alerts.map(a => ({ ...a, clientName: c.client_name || c.name || 'Client', clientId: c.client_id || c.id }));
        });
        const highAlerts = allAlerts.filter(a => a.severity === 'high');
        const medAlerts = allAlerts.filter(a => a.severity === 'medium');
        const showAlerts = [...highAlerts, ...medAlerts].slice(0, 5);

        if (!showAlerts.length) return null;
        return (
          <Card title="Coaching Alerts" subtitle={`${showAlerts.length} action${showAlerts.length !== 1 ? 's' : ''} needed`} style={{ marginTop: 18 }}>
            {showAlerts.map((a, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                  borderBottom: i < showAlerts.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer',
                }}
                onClick={() => navigate(`/coach/clients/${a.clientId}`)}
              >
                <span style={{ fontSize: 16 }}>{a.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: a.severity === 'high' ? 'var(--red)' : 'var(--orange)' }}>
                    {a.clientName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.4 }}>{a.message}</div>
                </div>
                <Icon name="chevron-right" size={12} style={{ color: 'var(--t3)' }} />
              </div>
            ))}
          </Card>
        );
      })()}

      {/* Client table or empty state */}
      {clients.length === 0 ? (
        <EmptyState />
      ) : (
        <Card title="Client Overview" actions={
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/coach/clients')}>
            View All
          </button>
        }>
          <table className="tbl">
            <thead>
              <tr>
                <th>Client</th>
                <th>Adherence</th>
                <th>Status</th>
                <th>Last Active</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <ClientRow key={c.client_id || c.id} client={c} onClick={() => navigate(`/coach/clients/${c.client_id || c.id}`)} />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
