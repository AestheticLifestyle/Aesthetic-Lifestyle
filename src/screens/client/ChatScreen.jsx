import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { Icon } from '../../utils/icons';
import { fetchMessages, sendMessage, subscribeToMessages } from '../../services/chat';
import { supabase } from '../../services/supabase';

function MessageBubble({ msg, isOwn }) {
  const ts = msg.created_at
    ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : msg.ts || '';

  return (
    <div style={{
      display: 'flex',
      justifyContent: isOwn ? 'flex-end' : 'flex-start',
      marginBottom: 8,
    }}>
      <div style={{
        maxWidth: '75%',
        padding: '10px 14px',
        borderRadius: isOwn ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        background: isOwn ? 'var(--gold-d)' : 'var(--s2)',
        border: `1px solid ${isOwn ? 'rgba(200,169,110,.2)' : 'var(--border)'}`,
        color: 'var(--t1)',
        fontSize: 13,
        lineHeight: 1.5,
      }}>
        {msg.text}
        <div style={{
          fontSize: 10, color: 'var(--t3)', marginTop: 4,
          textAlign: isOwn ? 'right' : 'left',
        }}>
          {ts}
        </div>
      </div>
    </div>
  );
}

export default function ChatScreen({ otherUserId: propOtherUserId, otherUserName: propOtherUserName }) {
  const { user, role } = useAuthStore();
  const isCoach = role === 'coach';
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);
  const [sendError, setSendError] = useState(null);

  // For client: auto-resolve coach ID if not passed as prop
  const [resolvedOther, setResolvedOther] = useState({ id: propOtherUserId || null, name: propOtherUserName || null });

  useEffect(() => {
    if (propOtherUserId) {
      setResolvedOther({ id: propOtherUserId, name: propOtherUserName || null });
      return;
    }
    if (!user?.id || isCoach) return;
    // Client with no prop — look up coach from coach_clients
    supabase.from('coach_clients').select('coach_id').eq('client_id', user.id).limit(1).single()
      .then(({ data }) => {
        if (data?.coach_id) {
          // Get coach name
          supabase.from('profiles').select('full_name').eq('id', data.coach_id).single()
            .then(({ data: profile }) => {
              setResolvedOther({ id: data.coach_id, name: profile?.full_name || 'Your Coach' });
            });
        }
      });
  }, [user?.id, propOtherUserId, isCoach]);

  const otherUserId = resolvedOther.id;
  const otherUserName = resolvedOther.name;

  // Load messages from Supabase
  useEffect(() => {
    if (!user?.id || !otherUserId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const msgs = await fetchMessages(user.id, otherUserId);
        setMessages(msgs || []);
      } catch (e) {
        console.error('[Chat] fetch error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id, otherUserId]);

  // Real-time subscription for incoming messages
  useEffect(() => {
    if (!user?.id) return;
    const channel = subscribeToMessages(user.id, (newMsg) => {
      // Only add if from the current conversation partner
      if (otherUserId && newMsg.sender_id === otherUserId) {
        setMessages(prev => {
          // Avoid duplicates
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }
    });
    return () => { channel.unsubscribe(); };
  }, [user?.id, otherUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !user?.id) return;
    setSendError(null);

    const text = input.trim();
    const tempId = Date.now();
    // Optimistic add
    const tempMsg = {
      id: tempId,
      sender_id: user.id,
      text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);
    setInput('');

    // Save to Supabase if we have a recipient
    if (otherUserId) {
      const ok = await sendMessage(user.id, otherUserId, text);
      if (!ok) {
        // Remove optimistic message on failure
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setSendError('Message failed to send. Tap to retry.');
        setInput(text); // Restore input so user can retry
      }
    }
  };

  const displayName = otherUserName || (isCoach ? 'Client' : 'Your Coach');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--hdr) - 44px)' }}>
      {/* Chat header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0',
        borderBottom: '1px solid var(--border)', marginBottom: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', background: 'var(--gold-d)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--gold)', fontFamily: 'var(--fd)', fontSize: 14,
        }}>
          {displayName.charAt(0)}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{displayName}</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--t3)' }}>
            <div className="spinner-sm" />
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--t3)', fontSize: 13 }}>
            <Icon name="message" size={28} style={{ opacity: 0.2, display: 'block', margin: '0 auto 12px' }} />
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map(msg => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isOwn={msg.sender_id === user?.id}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Send error */}
      {sendError && (
        <div style={{ fontSize: 11, color: 'var(--red)', padding: '4px 0', textAlign: 'center' }}>
          {sendError}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSend}
        style={{
          display: 'flex', gap: 8, padding: '12px 0', borderTop: '1px solid var(--border)',
          marginTop: 8,
        }}
      >
        <input
          className="form-inp"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={!input.trim()}>
          <Icon name="send" size={13} />
        </button>
      </form>
    </div>
  );
}
