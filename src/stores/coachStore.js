import { create } from 'zustand';

export const useCoachStore = create((set, get) => ({
  // Clients
  clients: [],
  selectedClient: null,

  // Check-ins
  pendingCheckins: [],
  checkinHistory: {},

  // Training templates
  trainingTemplates: [],
  editingTemplate: null,

  // Nutrition templates
  nutritionTemplates: [],
  editingNutrition: null,

  // Stats (overview)
  stats: {
    totalClients: 0,
    activeToday: 0,
    pendingCheckins: 0,
    avgAdherence: 0,
  },

  // Actions
  setClients: (clients) => set({ clients }),
  setSelectedClient: (client) => set({ selectedClient: client }),
  setStats: (stats) => set({ stats }),

  setPendingCheckins: (list) => set({ pendingCheckins: list }),
  addCheckinFeedback: (checkinId, feedback) => {
    const pending = get().pendingCheckins.filter(c => c.id !== checkinId);
    set({ pendingCheckins: pending });
  },

  setTrainingTemplates: (templates) => set({ trainingTemplates: templates }),
  setEditingTemplate: (template) => set({ editingTemplate: template }),
  addTrainingTemplate: (template) => set(s => ({
    trainingTemplates: [...s.trainingTemplates, template],
  })),
  updateTrainingTemplate: (id, data) => set(s => ({
    trainingTemplates: s.trainingTemplates.map(t => t.id === id ? { ...t, ...data } : t),
  })),

  setNutritionTemplates: (templates) => set({ nutritionTemplates: templates }),
  setEditingNutrition: (nutrition) => set({ editingNutrition: nutrition }),
  addNutritionTemplate: (template) => set(s => ({
    nutritionTemplates: [...s.nutritionTemplates, template],
  })),
}));
