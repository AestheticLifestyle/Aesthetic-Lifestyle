import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCoachStore } from '../../stores/coachStore';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { Card } from '../../components/ui';
import { Icon } from '../../utils/icons';
import { createInviteCode, fetchInviteCodes, deactivateInviteCode } from '../../services/invites';

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

// ── Invite Code Modal ──
function InviteModal({ onClose }) {
  const { user } = useAuthStore();
  const { showToast } = useUIStore();
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [maxUses, setMaxUses] = useState(1);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    if (user?.id) {
      fetchInviteCodes(user.id).then(data => {
        setCodes(data);
        setLoading(false);
      });
    }
  }, [user?.id]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const newCode = await createInviteCode(user.id, {
        label: label.trim() || undefined,
        maxUses: maxUses,
      });
      setCodes(prev => [newCode, ...prev]);
      setLabel('');
      setMaxUses(1);
      showToast('Invite code created!', 'success');
    } catch (err) {
      showToast('Failed to create code', 'error');
    }
    setCreating(false);
  };

  const handleDeactivate = async (codeId) => {
    try {
      await deactivateInviteCode(codeId);
      setCodes(prev => prev.map(c => c.id === codeId ? { ...c, active: false } : c));
      showToast('Code deactivated', 'success');
    } catch {
      showToast('Failed to deactivate', 'error');
    }
  };

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--s1)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480,
        maxHeight: '80vh', overflow: 'auto', border: '1px solid var(--border)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Invite Clients</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '4px 8px', minWidth: 0 }}>
            <Icon name="x" size={14} />
          </button>
        </div>

        {/* Create new code */}
        <div style={{
          background: 'var(--s2)', borderRadius: 12, padding: 16, marginBottom: 20,
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 10 }}>Generate New Code</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Label (optional)"
              style={{ flex: 1, fontSize: 13 }}
            />
            <select
              value={maxUses}
              onChange={e => setMaxUses(Number(e.target.value))}
              style={{
                background: 'var(--s3)', color: 'var(--t1)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '6px 10px', fontSize: 12,
              }}
            >
              <option value={1}>1 use</option>
              <option value={5}>5 uses</option>
              <option value={10}>10 uses</option>
              <option value={50}>50 uses</option>
            </select>
          </div>
          <button
            className="btn btn-primary btn-sm"
            style={{ width: '100%' }}
            onClick={handleCreate}
            disabled={creating}
          >
            <Icon name="plus" size={12} /> {creating ? 'Creating...' : 'Generate Invite Code'}
          </button>
        </div>

        {/* Existing codes */}
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 10 }}>
          Your Codes {codes.length > 0 && `(${codes.length})`}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--t3)', fontSize: 12 }}>Loading...</div>
        ) : codes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--t3)', fontSize: 12 }}>
            No invite codes yet. Create one above!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {codes.map(c => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                background: 'var(--s2)', borderRadius: 10, border: '1px solid var(--border)',
                opacity: c.active ? 1 : 0.4,
              }}>
                <div style={{
                  fontFamily: 'var(--fd)', fontSize: 16, fontWeight: 700, letterSpacing: 2,
                  color: c.active ? 'var(--gold)' : 'var(--t3)', flex: 1,
                }}>
                  {c.code}
                </div>
                <div style={{ fontSize: 10, color: 'var(--t3)', textAlign: 'right', minWidth: 60 }}>
                  {c.label && <div>{c.label}</div>}
                  <div>{c.used_count}/{c.max_uses} used</div>
                </div>
                {c.active && (
                  <>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 8px', minWidth: 0, fontSize: 10 }}
                      onClick={() => handleCopy(c.code)}
                    >
                      {copied === c.code ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 8px', minWidth: 0, fontSize: 10, color: 'var(--red)' }}
                      onClick={() => handleDeactivate(c.id)}
                    >
                      <Icon name="x" size={10} />
                    </button>
                  </>
                )}
                {!c.active && (
                  <span style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase' }}>Inactive</span>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{
          marginTop: 16, padding: '10px 12px', background: 'rgba(212,175,55,.06)',
          borderRadius: 8, border: '1px solid rgba(212,175,55,.15)',
          fontSize: 11, color: 'var(--t3)', lineHeight: 1.5,
        }}>
          Share the invite code with your client. They can enter it during signup or in their Settings to connect with you.
        </div>
      </div>
    </div>
  );
}

export default function ClientsScreen() {
  const { clients } = useCoachStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showInviteModal, setShowInviteModal] = useState(false);

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
      {showInviteModal && <InviteModal onClose={() => setShowInviteModal(false)} />}

      {/* Search & filters + Add Client button */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowInviteModal(true)}
          style={{ whiteSpace: 'nowrap' }}
        >
          <Icon name="plus" size={12} /> Add Client
        </button>
      </div>
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
