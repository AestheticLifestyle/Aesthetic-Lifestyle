import { useState, useEffect, useRef } from 'react';
import { useCoachStore } from '../../stores/coachStore';
import { useAuthStore } from '../../stores/authStore';
import ChatScreen from '../client/ChatScreen';
import { Card } from '../../components/ui';
import { Icon } from '../../utils/icons';
import { fetchLatestMessages, subscribeToMessages } from '../../services/chat';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function ClientChatItem({ client, active, onClick, lastMsg, unread }) {
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
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: active ? 'var(--gold)' : 'var(--s3)',
          color: active ? 'var(--black)' : 'var(--t2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--fd)', fontSize: 13, fontWeight: 600,
        }}>
          {name.charAt(0)}
        </div>
        {unread && (
          <div style={{
            position: 'absolute', top: -2, right: -2, width: 10, height: 10,
            borderRadius: '50%', background: 'var(--gold)', border: '2px solid var(--s1)',
          }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{
            fontSize: 13, color: 'var(--t1)',
            fontWeight: unread ? 700 : 500,
          }}>{name}</span>
          {lastMsg?.created_at && (
            <span style={{ fontSize: 10, color: 'var(--t3)', flexShrink: 0 }}>
              {timeAgo(lastMsg.created_at)}
            </span>
          )}
        </div>
        <div style={{
          fontSize: 11, color: unread ? 'var(--t1)' : 'var(--t3)',
          fontWeight: unread ? 600 : 400,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          maxWidth: 180,
        }}>
          {lastMsg?.text || (client.goal || 'No messages yet')}
        </div>
      </div>
    </div>
  );
}

export default function CoachChatScreen() {
  const { clients } = useCoachStore();
  const { user } = useAuthStore();
  const [activeClient, setActiveClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [latestMsgs, setLatestMsgs] = useState({});
  const [readMap, setReadMap] = useState({}); // { clientId: timestamp } — tracks when coach last opened chat
  const readMapRef = useRef(readMap);
  readMapRef.current = readMap;

  // Fetch latest messages on mount
  useEffect(() => {
    if (!user?.id || !clients.length) return;
    const clientIds = clients.map(c => c.client_id || c.id);
    fetchLatestMessages(user.id, clientIds).then(setLatestMsgs);
  }, [user?.id, clients]);

  // Subscribe to new incoming messages to update previews live
  useEffect(() => {
    if (!user?.id) return;
    const channel = subscribeToMessages(user.id, (newMsg) => {
      const clientId = newMsg.sender_id;
      setLatestMsgs(prev => ({
        ...prev,
        [clientId]: { text: newMsg.text, created_at: newMsg.created_at, isFromClient: true },
      }));
    });
    return () => { channel.unsubscribe(); };
  }, [user?.id]);

  // Mark as read when selecting a client
  const handleSelectClient = (client) => {
    setActiveClient(client);
    const cid = client.client_id || client.id;
    setReadMap(prev => ({ ...prev, [cid]: Date.now() }));
  };

  const filtered = clients.filter(c => {
    const name = (c.client_name || c.name || '').toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  });

  // Sort by latest message time (most recent first)
  const sorted = [...filtered].sort((a, b) => {
    const aId = a.client_id || a.id;
    const bId = b.client_id || b.id;
    const aTime = latestMsgs[aId]?.created_at || '';
    const bTime = latestMsgs[bId]?.created_at || '';
    return bTime.localeCompare(aTime);
  });

  const selected = activeClient || (sorted.length > 0 ? sorted[0] : null);

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
              placeholder="Search clients..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              aria-label="Search clients"
            />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sorted.map(c => {
            const cid = c.client_id || c.id;
            const lastMsg = latestMsgs[cid];
            const unread = lastMsg?.isFromClient && (!readMap[cid] || new Date(lastMsg.created_at).getTime() > readMap[cid]);
            return (
              <ClientChatItem
                key={cid}
                client={c}
                active={selected && (selected.client_id === c.client_id || selected.id === c.id)}
                onClick={() => handleSelectClient(c)}
                lastMsg={lastMsg}
                unread={unread}
              />
            );
          })}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, padding: '0 20px' }}>
        {selected ? (
          <ChatScreen
            key={selected.client_id || selected.id}
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
