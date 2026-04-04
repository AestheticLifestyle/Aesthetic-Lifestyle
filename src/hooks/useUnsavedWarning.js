import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook that warns users about unsaved changes when navigating away.
 * Uses the browser's beforeunload event (for tab close/refresh)
 * and tracks dirty state for in-app use.
 *
 * Usage:
 *   const { markDirty, markClean, isDirty } = useUnsavedWarning();
 *   // Call markDirty() when user edits something
 *   // Call markClean() after a successful save
 *   // Check isDirty before allowing navigation
 */
export function useUnsavedWarning() {
  const dirtyRef = useRef(false);

  const markDirty = useCallback(() => { dirtyRef.current = true; }, []);
  const markClean = useCallback(() => { dirtyRef.current = false; }, []);

  useEffect(() => {
    const handler = (e) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
    };
  }, []);

  return { markDirty, markClean, isDirty: () => dirtyRef.current };
}
