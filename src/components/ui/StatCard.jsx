/**
 * Small stat display card — used on Dashboard for quick metrics.
 */
export default function StatCard({ label, value, sub, color, icon }) {
  return (
    <div className="card stat-card">
      <div className="stat-top">
        {icon && <div className="stat-icon" style={{ color }}>{icon}</div>}
        <div className="stat-label">{label}</div>
      </div>
      <div className="stat-value" style={{ color }}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
