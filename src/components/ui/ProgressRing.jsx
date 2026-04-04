/**
 * Circular progress indicator — used for macro rings, step goals, etc.
 */
export default function ProgressRing({
  value = 0,
  max = 100,
  size = 56,
  stroke = 4,
  color = 'var(--gold)',
  trackColor = 'var(--s4)',
  children,
}) {
  const pct = Math.min(value / max, 1);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .4s ease' }}
        />
      </svg>
      {children && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 600, color: 'var(--t1)',
        }}>
          {children}
        </div>
      )}
    </div>
  );
}
