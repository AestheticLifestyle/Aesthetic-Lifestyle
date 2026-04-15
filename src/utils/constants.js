// SVG check icon used throughout the app
export const CHECK_SVG = `<svg viewBox="0 0 12 12" fill="none" width="10" height="10"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// Date helpers
export function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function formatShortDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

export function formatVolume(v) {
  if (v >= 10000) return (v / 1000).toFixed(1) + 'k';
  return v.toLocaleString();
}

// Navigation items
export const COACH_NAV = [
  { id: 'overview', label: 'navCommandCenter', group: 'navOverview', icon: 'grid' },
  { id: 'clients', label: 'navAllClients', group: 'navClients', icon: 'users', badge: true },
  { id: 'checkins', label: 'navCheckins', group: 'navClients', icon: 'clipboard', badge: true },
  { id: 'weekly-review', label: 'navWeeklyReview', group: 'navClients', icon: 'trending-up' },
  { id: 'workout-builder', label: 'navWorkoutBuilder', group: 'navBuilder', icon: 'dumbbell' },
  { id: 'nutrition-editor', label: 'navNutritionEditor', group: 'navBuilder', icon: 'utensils' },
  { id: 'supplements', label: 'navSupplements', group: 'navBuilder', icon: 'pill' },
  { id: 'analytics', label: 'navAnalytics', group: 'navClients', icon: 'bar-chart' },
  { id: 'chat', label: 'navCoachChat', group: 'navSystem', icon: 'message', badge: true },
  { id: 'settings', label: 'navSettings', group: 'navSystem', icon: 'settings' },
];

export const CLIENT_NAV = [
  { id: 'dashboard', label: 'navDashboard', group: 'navMain', icon: 'grid' },
  { id: 'training', label: 'navTraining', group: 'navMain', icon: 'dumbbell' },
  { id: 'nutrition', label: 'navNutrition', group: 'navMain', icon: 'utensils' },
  { id: 'supplements', label: 'navSupplements', group: 'navMain', icon: 'pill' },
  { id: 'progress', label: 'navProgress', group: 'navTracking', icon: 'trending-up' },
  { id: 'journal', label: 'navJournal', group: 'navTracking', icon: 'book' },
  { id: 'chat', label: 'navChat', group: 'navConnect', icon: 'message' },
  { id: 'settings', label: 'navSettings', group: 'navConnect', icon: 'settings' },
];
