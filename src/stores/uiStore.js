import { create } from 'zustand';

export const useUIStore = create((set) => ({
  sidebarOpen: false,
  activeModal: null, // string key or null
  toast: null, // { message, type } or null
  dashDate: new Date().toISOString().slice(0, 10),

  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),

  openModal: (key) => set({ activeModal: key }),
  closeModal: () => set({ activeModal: null }),

  showToast: (message, type = 'info', duration = 2500) => {
    set({ toast: { message, type } });
    setTimeout(() => set({ toast: null }), duration);
  },

  setDashDate: (date) => set({ dashDate: date }),
}));
