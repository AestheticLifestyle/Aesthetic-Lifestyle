import { create } from 'zustand';
import { signIn, signUp, signOut as authSignOut, getSession, onAuthStateChange } from '../services/auth';
import { supabase } from '../services/supabase';

// Fetch role from profiles table (more reliable than user_metadata)
async function fetchProfileRole(userId) {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    return data?.role || null;
  } catch {
    return null;
  }
}

export const useAuthStore = create((set, get) => ({
  user: null,
  role: null, // 'coach' | 'client'
  roleOverride: false, // true when coach manually switches to client view
  session: null,
  loading: true,
  error: null,

  // Initialize — call once on app mount
  init: async () => {
    const session = await getSession();
    if (session?.user) {
      const profileRole = await fetchProfileRole(session.user.id);
      const dbRole = profileRole || session.user.user_metadata?.role || 'client';

      // Restore roleOverride from sessionStorage (survives page refresh)
      const savedOverride = sessionStorage.getItem('roleOverride') === 'true';
      const role = savedOverride ? 'client' : dbRole;

      set({ user: session.user, role, roleOverride: savedOverride, session, loading: false });
    } else {
      sessionStorage.removeItem('roleOverride');
      sessionStorage.removeItem('overrideClientId');
      set({ loading: false });
    }

    // Listen for auth changes (tab focus, token refresh, etc.)
    onAuthStateChange(async (session) => {
      if (session?.user) {
        const state = get();
        if (state.roleOverride) {
          set({ user: session.user, session });
        } else {
          const profileRole = await fetchProfileRole(session.user.id);
          const role = profileRole || session.user.user_metadata?.role || 'client';
          set({ user: session.user, role, session });
        }
      } else {
        sessionStorage.removeItem('roleOverride');
        sessionStorage.removeItem('overrideClientId');
        set({ user: null, role: null, session: null, roleOverride: false });
      }
    });
  },

  login: async (email, password) => {
    set({ error: null, loading: true });
    try {
      const data = await signIn(email, password);
      const profileRole = await fetchProfileRole(data.user.id);
      const role = profileRole || data.user?.user_metadata?.role || 'client';
      set({ user: data.user, role, session: data.session, loading: false });
      return true;
    } catch (err) {
      set({ error: err.message, loading: false });
      return false;
    }
  },

  register: async (email, password, fullName, role) => {
    set({ error: null, loading: true });
    try {
      const data = await signUp(email, password, fullName, role);
      set({ user: data.user, role, session: data.session, loading: false });
      return true;
    } catch (err) {
      set({ error: err.message, loading: false });
      return false;
    }
  },

  logout: async () => {
    sessionStorage.removeItem('roleOverride');
    sessionStorage.removeItem('overrideClientId');
    await authSignOut();
    set({ user: null, role: null, session: null, roleOverride: false });
  },

  clearError: () => set({ error: null }),
}));
