import { useState, useEffect } from 'react';

/**
 * AchievementToast — animated notification when a badge is unlocked.
 * Slides in from the top, stays for 4s, then slides out.
 * Click to open share card.
 */
export default function AchievementToast({ achievement, onDismiss, onShare }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!achievement) return;
    // Animate in
    const inTimer = setTimeout(() => setVisible(true), 50);
    // Auto dismiss after 5s
    const outTimer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => {
        setVisible(false);
        setExiting(false);
        onDismiss?.();
      }, 400);
    }, 5000);

    return () => { clearTimeout(inTimer); clearTimeout(outTimer); };
  }, [achievement]);

  if (!achievement) return null;

  return (
    <div
      style={{
        position: 'fixed', top: 20, left: '50%', transform: `translateX(-50%) translateY(${visible && !exiting ? 0 : -120}px)`,
        zIndex: 10000, transition: 'transform 0.4s cubic-bezier(.22,1,.36,1)',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        border: '1px solid rgba(212, 175, 55, 0.4)',
        borderRadius: 16, padding: '14px 20px', minWidth: 280, maxWidth: 400,
        boxShadow: '0 12px 40px rgba(0,0,0,.6), 0 0 20px rgba(212,175,55,.15)',
        cursor: 'pointer', userSelect: 'none',
      }}
      onClick={() => onShare?.(achievement)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Icon with glow */}
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: 'rgba(212, 175, 55, 0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, flexShrink: 0,
          boxShadow: '0 0 16px rgba(212, 175, 55, 0.2)',
        }}>
          {achievement.icon}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: 2,
            color: '#d4af37', textTransform: 'uppercase', marginBottom: 3,
          }}>
            Achievement Unlocked
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
            {achievement.title}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>
            {achievement.description}
            {achievement.bonusXP > 0 && (
              <span style={{ color: '#d4af37', marginLeft: 6 }}>+{achievement.bonusXP} XP</span>
            )}
          </div>
        </div>

        {/* Share hint */}
        <div style={{
          fontSize: 9, color: 'rgba(212,175,55,.6)',
          textTransform: 'uppercase', letterSpacing: 1,
          writingMode: 'vertical-rl', transform: 'rotate(180deg)',
        }}>
          Tap to share
        </div>
      </div>
    </div>
  );
}
