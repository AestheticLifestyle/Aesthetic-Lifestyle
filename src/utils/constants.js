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
  { id: 'overview', label: 'Command Center', group: 'Overview', icon: 'grid' },
  { id: 'clients', label: 'All Clients', group: 'Clients', icon: 'users', badge: true },
  { id: 'checkins', label: 'Check-ins', group: 'Clients', icon: 'clipboard', badge: true },
  { id: 'workout-builder', label: 'Workout Builder', group: 'Builder', icon: 'dumbbell' },
  { id: 'nutrition-editor', label: 'Nutrition Editor', group: 'Builder', icon: 'utensils' },
  { id: 'chat', label: 'Coach Chat', group: 'System', icon: 'message', badge: true },
  { id: 'settings', label: 'Settings', group: 'System', icon: 'settings' },
];

export const CLIENT_NAV = [
  { id: 'dashboard', label: 'Dashboard', group: 'Main', icon: 'grid' },
  { id: 'training', label: 'Training', group: 'Main', icon: 'dumbbell' },
  { id: 'nutrition', label: 'Nutrition', group: 'Main', icon: 'utensils' },
  { id: 'progress', label: 'Progress', group: 'Tracking', icon: 'trending-up' },
  { id: 'journal', label: 'Journal', group: 'Tracking', icon: 'book' },
  { id: 'chat', label: 'Chat', group: 'Connect', icon: 'message' },
  { id: 'settings', label: 'Settings', group: 'Connect', icon: 'settings' },
];
