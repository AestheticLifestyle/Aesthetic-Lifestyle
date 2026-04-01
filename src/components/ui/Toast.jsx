import { useUIStore } from '../../stores/uiStore';

/**
 * Global toast notification — rendered in Shell but can be
 * used standalone. Reads from uiStore.toast.
 */
export default function Toast() {
  const toast = useUIStore(s => s.toast);
  if (!toast) return null;

  return (
    <div className={`toast toast-${toast.type || 'info'}`}>
      {toast.message}
    </div>
  );
}
