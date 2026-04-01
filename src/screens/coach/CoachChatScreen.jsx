import { useState } from 'react';
import { useCoachStore } from '../../stores/coachStore';
import ChatScreen from '../client/ChatScreen';
import { Card } from '../../components/ui';
import { Icon } from '../../utils/icons';

function ClientChatItem({ client, active, onClick }) {
  const name = client.client_name || client.name || 'Client';

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
        borderRadius: 8, cursor: 'pointer', transition: 'background .12s',
        background: active ? 'var(--gold-d)' : 'transparent',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: '50%',
        background: active ? 'var(--gold)' : 'var(--s3)',
        color: active ? 'var(--black)' : 'var(--t2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--fd)', fontSize: 13, fontWeight: 600, flexShrink: 0,
      }}>
        {name.charAt(0)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{name}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--t3)' }}>
          {client.goal || 'No goal set'}
        </div>
      </div>
    </div>
  );
}

export default function CoachChatScreen() {
  const { clients } = useCoachStore();
  const [activeClient, setActiveClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = clients.filter(c => {
    const name = (c.client_name || c.name || '').toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  });

  // Select first client by default
  const selected = activeClient || (filtered.length > 0 ? filtered[0] : null);

  if (clients.length === 0) {
    return (
      <div className="screen active">
        <Card>
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--t3)' }}>
            <Icon name="message" size={32} style={{ opacity: 0.2, display: 'block', margin: '0 auto 14px' }} />
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6, color: 'var(--t2)' }}>No clients to chat with</div>
            <div style={{ fontSize: 12 }}>Your client conversations will appear here.</div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - var(--hdr) - 44px)', gap: 0 }}>
      {/* Client list sidebar */}
      <div style={{
        width: 280, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
        flexShrink: 0,
      }}>
        <div style={{ padding: '12px 12px 8px' }}>
          <div className="search-bar" style={{ marginBottom: 0 }}>
            <Icon name="search" size={13} style={{ color: 'var(--t3)' }} />
            <input
              className="search-input"
              placeholder="Search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.map(c => (
            <ClientChatItem
              key={c.client_id || c.id}
              client={c}
              active={selected?.client_id === c.client_id || selected?.id === c.id}
              onClick={() => setActiveClient(c)}
            />
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, padding: '0 20px' }}>
        {selected ? (
          <ChatScreen
            otherUserId={selected.client_id || selected.id}
            otherUserName={selected.client_name || selected.name}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--t3)', fontSize: 13 }}>
            Select a client to start chatting
          </div>
        )}
      </div>
    </div>
  );
}
