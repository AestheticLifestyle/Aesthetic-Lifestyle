import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCoachStore } from '../../stores/coachStore';
import { Card } from '../../components/ui';
import { Icon } from '../../utils/icons';

function ClientCard({ client, onClick }) {
  const statusMap = {
    'on-track': { label: 'On Track', cls: 't-gr' },
    'attention': { label: 'Attention', cls: 't-or' },
    'at-risk': { label: 'At Risk', cls: 't-rd' },
  };
  const status = client.status || 'on-track';
  const s = statusMap[status] || statusMap['on-track'];
  const name = client.client_name || client.name || 'Unknown';

  return (
    <div
      className="card"
      style={{ cursor: 'pointer', transition: 'border-color .15s' }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', background: 'var(--gold-d)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--gold)', fontFamily: 'var(--fd)', fontSize: 16, fontWeight: 600,
        }}>
          {name.charAt(0)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{name}</div>
          <div style={{ fontSize: 11, color: 'var(--t3)' }}>{client.goal || '—'}</div>
        </div>
        <span className={`tag ${s.cls}`}>{s.label}</span>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <div>
          <div className="kl">Adherence</div>
          <div style={{ fontSize: 16, fontFamily: 'var(--fd)', color: (client.adherence || 0) > 80 ? 'var(--green)' : (client.adherence || 0) > 60 ? 'var(--orange)' : 'var(--red)' }}>
            {client.adherence || 0}%
          </div>
        </div>
        <div>
          <div className="kl">Weight</div>
          <div style={{ fontSize: 16, fontFamily: 'var(--fd)' }}>{client.weight ? `${client.weight} kg` : '—'}</div>
        </div>
        <div>
          <div className="kl">Streak</div>
          <div style={{ fontSize: 16, fontFamily: 'var(--fd)', color: 'var(--gold)' }}>{client.streak || 0}d</div>
        </div>
      </div>

      {client.start_date && (
        <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 10 }}>
          Started: {(() => {
            try {
              const dt = new Date(client.start_date + 'T00:00:00');
              return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            } catch { return client.start_date; }
          })()}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--t3)' }}>
        <Icon name="user" size={32} style={{ opacity: 0.2, display: 'block', margin: '0 auto 14px' }} />
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6, color: 'var(--t2)' }}>No clients yet</div>
        <div style={{ fontSize: 12 }}>Add your first client to get started with coaching.</div>
      </div>
    </Card>
  );
}

export default function ClientsScreen() {
  const { clients } = useCoachStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = clients.filter(c => {
    const name = (c.client_name || c.name || '').toLowerCase();
    const matchSearch = name.includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (c.status || 'on-track') === filter;
    return matchSearch && matchFilter;
  });

  const handleClientClick = (client) => {
    const id = client.client_id || client.id;
    navigate(`/coach/clients/${id}`);
  };

  return (
    <div className="screen active">
      {/* Search & filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
          <Icon name="search" size={14} style={{ color: 'var(--t3)' }} />
          <input
            className="search-input"
            placeholder="Search clients..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { key: 'all', label: 'All' },
            { key: 'on-track', label: 'On Track' },
            { key: 'attention', label: 'Attention' },
            { key: 'at-risk', label: 'At Risk' },
          ].map(f => (
            <button
              key={f.key}
              className={`chip ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Client grid */}
      {clients.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="g3">
            {filtered.map(c => (
              <ClientCard
                key={c.client_id || c.id}
                client={c}
                onClick={() => handleClientClick(c)}
              />
            ))}
          </div>

          {filtered.length === 0 && clients.length > 0 && (
            <Card>
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--t3)' }}>
                No clients match your search.
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
