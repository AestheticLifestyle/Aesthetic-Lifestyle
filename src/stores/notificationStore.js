import { create } from 'zustand';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from '../services/reminders';

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  smartReminders: [], // generated on-the-fly
  loading: false,
  panelOpen: false,

  togglePanel: () => set(s => ({ panelOpen: !s.panelOpen })),
  closePanel: () => set({ panelOpen: false }),

  setSmartReminders: (reminders) => set({ smartReminders: reminders }),

  loadNotifications: async (clientId) => {
    if (!clientId) return;
    set({ loading: true });
    const data = await fetchNotifications(clientId);
    set({ notifications: data, loading: false });
  },

  markRead: async (id) => {
    await markNotificationRead(id);
    set(s => ({
      notifications: s.notifications.map(n => n.id === id ? { ...n, is_read: true } : n),
    }));
  },

  markAllRead: async (clientId) => {
    await markAllNotificationsRead(clientId);
    set(s => ({
      notifications: s.notifications.map(n => ({ ...n, is_read: true })),
      smartReminders: [],
    }));
  },

  dismissReminder: (type) => {
    set(s => ({
      smartReminders: s.smartReminders.filter(r => r.type !== type),
    }));
  },
}));
