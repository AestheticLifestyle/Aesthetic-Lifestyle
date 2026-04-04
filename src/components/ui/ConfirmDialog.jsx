import { useEffect, useRef } from 'react';

/**
 * Lightweight confirm dialog overlay.
 * Usage:
 *   <ConfirmDialog
 *     open={showConfirm}
 *     title="Remove exercise?"
 *     message="This can't be undone."
 *     confirmLabel="Remove"
 *     danger
 *     onConfirm={() => { doDelete(); setShowConfirm(false); }}
 *     onCancel={() => setShowConfirm(false)}
 *   />
 */
export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }) {
  const confirmRef = useRef(null);

  // Auto-focus the confirm button and trap focus
  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,.6)', animation: 'fadeIn .15s ease',
      }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--s1)', border: '1px solid var(--border2)',
          borderRadius: 14, padding: '24px 22px 18px', width: 'min(340px, 90vw)',
          animation: 'fadeUp .2s ease',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t1)', marginBottom: 6 }}>
          {title}
        </div>
        {message && (
          <div style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.5, marginBottom: 20 }}>
            {message}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary btn-sm" onClick={onCancel}>
            Cancel
          </button>
          <button
            ref={confirmRef}
            className={`btn btn-sm ${danger ? '' : 'btn-primary'}`}
            style={danger ? { background: 'var(--red)', color: '#fff', border: 'none' } : {}}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
