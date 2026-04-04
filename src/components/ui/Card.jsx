/**
 * Card wrapper — the primary content container throughout the app.
 * Supports optional title, subtitle, and header actions.
 */
export default function Card({ title, subtitle, actions, children, className = '', ...props }) {
  return (
    <div className={`card ${className}`} {...props}>
      {(title || actions) && (
        <div className="card-hdr">
          <div>
            {title && <div className="card-title">{title}</div>}
            {subtitle && <div className="card-sub">{subtitle}</div>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
