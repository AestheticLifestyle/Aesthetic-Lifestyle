import { useRef, useCallback } from 'react';
import { getLevelFromXP } from '../../utils/gamification';

/**
 * AchievementShareCard — renders a branded share card for an achievement.
 * Uses html2canvas-style approach: renders to a hidden canvas, then
 * triggers Web Share API or downloads the image.
 */

const CARD_W = 400;
const CARD_H = 520;

function drawShareCard(canvas, { achievement, level, streak, userName, timestamp }) {
  const ctx = canvas.getContext('2d');
  canvas.width = CARD_W * 2; // 2x for retina
  canvas.height = CARD_H * 2;
  ctx.scale(2, 2);

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, CARD_H);
  grad.addColorStop(0, '#1a1a2e');
  grad.addColorStop(0.5, '#16213e');
  grad.addColorStop(1, '#0f0f23');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Gold border
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 12, CARD_W - 24, CARD_H - 24);

  // Inner glow line
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 20, CARD_W - 40, CARD_H - 40);

  // "ACHIEVEMENT UNLOCKED" header
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d4af37';
  ctx.font = '600 11px system-ui, -apple-system, sans-serif';
  ctx.letterSpacing = '6px';
  ctx.fillText('ACHIEVEMENT UNLOCKED', CARD_W / 2, 65);

  // Decorative line
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, 82);
  ctx.lineTo(CARD_W - 80, 82);
  ctx.stroke();

  // Achievement icon (large emoji)
  ctx.font = '72px serif';
  ctx.fillText(achievement.icon || '🏆', CARD_W / 2, 165);

  // Achievement title
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 28px system-ui, -apple-system, sans-serif';
  ctx.fillText(achievement.title || 'Achievement', CARD_W / 2, 220);

  // Achievement description
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '400 14px system-ui, -apple-system, sans-serif';
  ctx.fillText(achievement.description || '', CARD_W / 2, 250);

  // Bonus XP badge
  if (achievement.bonusXP) {
    ctx.fillStyle = 'rgba(212, 175, 55, 0.15)';
    const bw = 120, bh = 30;
    const bx = (CARD_W - bw) / 2, by = 268;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 15);
    ctx.fill();
    ctx.fillStyle = '#d4af37';
    ctx.font = '600 13px system-ui, -apple-system, sans-serif';
    ctx.fillText(`+${achievement.bonusXP} XP`, CARD_W / 2, 288);
  }

  // Divider
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(50, 320);
  ctx.lineTo(CARD_W - 50, 320);
  ctx.stroke();

  // Stats row
  const statsY = 360;
  const colW = (CARD_W - 80) / 3;

  // Level
  ctx.fillStyle = level?.color || '#d4af37';
  ctx.font = '700 22px system-ui, -apple-system, sans-serif';
  ctx.fillText(`LV ${level?.level || 1}`, 40 + colW * 0.5, statsY);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '400 10px system-ui, -apple-system, sans-serif';
  ctx.fillText(level?.title || 'Beginner', 40 + colW * 0.5, statsY + 20);

  // Streak
  ctx.fillStyle = '#ff6b35';
  ctx.font = '700 22px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${streak?.current || 0}`, 40 + colW * 1.5, statsY);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '400 10px system-ui, -apple-system, sans-serif';
  ctx.fillText('DAY STREAK', 40 + colW * 1.5, statsY + 20);

  // Total XP
  ctx.fillStyle = '#3b82f6';
  ctx.font = '700 22px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${(level?.totalXP || 0).toLocaleString()}`, 40 + colW * 2.5, statsY);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '400 10px system-ui, -apple-system, sans-serif';
  ctx.fillText('TOTAL XP', 40 + colW * 2.5, statsY + 20);

  // User name
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = '500 14px system-ui, -apple-system, sans-serif';
  ctx.fillText(userName || 'Athlete', CARD_W / 2, 430);

  // App branding
  ctx.fillStyle = 'rgba(212, 175, 55, 0.6)';
  ctx.font = '600 11px system-ui, -apple-system, sans-serif';
  ctx.fillText('AESTHETIC LIFESTYLE', CARD_W / 2, 465);

  // Date
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.font = '400 10px system-ui, -apple-system, sans-serif';
  ctx.fillText(timestamp || '', CARD_W / 2, 490);
}

export default function AchievementShareCard({ achievement, level, streak, userName, onClose }) {
  const canvasRef = useRef(null);
  const timestamp = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const handleShare = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    drawShareCard(canvas, { achievement, level, streak, userName, timestamp });

    try {
      // Convert canvas to blob
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], `achievement-${achievement.id}.png`, { type: 'image/png' });

      // Use Web Share API if available
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `${achievement.title} - Achievement Unlocked!`,
          text: `I just unlocked "${achievement.title}" on Aesthetic Lifestyle! ${achievement.icon}`,
          files: [file],
        });
      } else {
        // Fallback: download the image
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `achievement-${achievement.id}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[Share] Error:', err);
        // Fallback download
        canvas.toBlob(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `achievement-${achievement.id}.png`;
          a.click();
          URL.revokeObjectURL(url);
        });
      }
    }
  }, [achievement, level, streak, userName, timestamp]);

  // Pre-render the card
  const renderCard = useCallback((node) => {
    if (node) {
      canvasRef.current = node;
      drawShareCard(node, { achievement, level, streak, userName, timestamp });
    }
  }, [achievement, level, streak, userName, timestamp]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 20, padding: 20,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <canvas
          ref={renderCard}
          style={{ width: CARD_W, height: CARD_H, borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-primary"
            onClick={handleShare}
            style={{ padding: '10px 28px', fontSize: 14, fontWeight: 600 }}
          >
            Share Achievement
          </button>
          <button
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: '10px 20px', fontSize: 14 }}
          >
            Close
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', textAlign: 'center' }}>
          Share to Instagram, WhatsApp, or save the image
        </div>
      </div>
    </div>
  );
}
