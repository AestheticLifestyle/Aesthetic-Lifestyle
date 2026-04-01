import { useEffect, useCallback } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { Icon } from '../../utils/icons';

/**
 * Slide-in modal panel (from right).
 * Controlled by uiStore.activeModal key.
 */
export default function Modal({ modalKey, title, children, width = 820 }) {
  const { activeModal, closeModal } = useUIStore();
  const isOpen = activeModal === modalKey;

  // Close on Escape key
  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') closeModal();
  }, [closeModal]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }
  }, [isOpen, handleKey]);

  if (!isOpen) return null;

  return (
    <div className="modal-ov open" onClick={closeModal}>
      <div
        className="modal"
        style={{ width: `min(${width}px, 95vw)` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-hdr">
          <h2 style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>{title}</h2>
          <button className="icon-btn" onClick={closeModal} aria-label="Close">
            <Icon name="x" size={14} />
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
