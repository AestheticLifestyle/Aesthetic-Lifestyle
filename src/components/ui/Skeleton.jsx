/**
 * Skeleton loading placeholders — drop-in replacements for content while loading.
 */

const shimmer = {
  background: 'linear-gradient(90deg, var(--s2) 25%, var(--s3) 50%, var(--s2) 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s ease-in-out infinite',
  borderRadius: 'var(--r)',
};

export function SkeletonLine({ width = '100%', height = 14, style }) {
  return <div style={{ ...shimmer, width, height, ...style }} />;
}

export function SkeletonCircle({ size = 40, style }) {
  return <div style={{ ...shimmer, width: size, height: size, borderRadius: '50%', ...style }} />;
}

export function SkeletonCard({ rows = 3, style }) {
  return (
    <div className="card" style={{ ...style }}>
      <SkeletonLine width="40%" height={16} style={{ marginBottom: 14 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonLine
          key={i}
          width={i === rows - 1 ? '60%' : '100%'}
          height={12}
          style={{ marginBottom: i < rows - 1 ? 10 : 0 }}
        />
      ))}
    </div>
  );
}

/** Full page skeleton: shows 4 cards in a grid */
export function PageSkeleton() {
  return (
    <div className="screen active" style={{ animation: 'fadeIn .3s ease' }}>
      <SkeletonLine width="35%" height={22} style={{ marginBottom: 8 }} />
      <SkeletonLine width="55%" height={13} style={{ marginBottom: 24 }} />
      <div className="g4">
        <SkeletonCard rows={2} />
        <SkeletonCard rows={2} />
        <SkeletonCard rows={3} />
        <SkeletonCard rows={2} />
      </div>
    </div>
  );
}
