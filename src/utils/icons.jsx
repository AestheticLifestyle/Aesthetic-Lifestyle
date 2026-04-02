// Centralized icon components — lightweight SVGs matching the original app
export function Icon({ name, size = 15, ...props }) {
  const icons = {
    grid: <><rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor"/><rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4"/><rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4"/><rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4"/></>,
    users: <><circle cx="6" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M1 14c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/><path d="M12 7c1.1 0 2 .9 2 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/></>,
    clipboard: <><rect x="2" y="1" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M5 5h4M5 8h4M5 11h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/></>,
    dumbbell: <path d="M1 8h2M13 8h2M3 8h10M3 5v6M13 5v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>,
    utensils: <><circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M5.5 8a2.5 2.5 0 005 0" stroke="currentColor" strokeWidth="1.5" fill="none"/></>,
    message: <path d="M2 3h12v8H9l-3 2v-2H2V3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>,
    'trending-up': <path d="M2 12l4-4 3 3 5-5M10 6h4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    book: <><path d="M2 2h5a3 3 0 013 3v9a2 2 0 00-2-2H2V2z" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M14 2H9a3 3 0 00-3 3v9a2 2 0 012-2h6V2z" stroke="currentColor" strokeWidth="1.5" fill="none"/></>,
    settings: <><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M13 3l-1.5 1.5M4.5 11.5L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/></>,
    check: <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    x: <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>,
    menu: <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>,
    'log-out': <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 11l3-3-3-3M6 8h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    bell: <><path d="M8 1.5a4.5 4.5 0 00-4.5 4.5c0 5-2 6.5-2 6.5h13s-2-1.5-2-6.5A4.5 4.5 0 008 1.5z" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M6.5 13a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.5" fill="none"/></>,
    chevron: <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    'chevron-left': <path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    'chevron-right': <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    'chevron-up': <path d="M3 10l5-5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    'chevron-down': <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    camera: <><rect x="1" y="4" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="8" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M5 4l1-2h4l1 2" stroke="currentColor" strokeWidth="1.5" fill="none"/></>,
    plus: <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>,
    minus: <path d="M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>,
    send: <path d="M2 8l12-5-4 5 4 5-12-5zM14 3l-4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    search: <><circle cx="7" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M10 10l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/></>,
    edit: <path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>,
    trash: <><path d="M3 4h10M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/><path d="M4 4l.7 9a1.5 1.5 0 001.5 1.4h3.6A1.5 1.5 0 0011.3 13L12 4" stroke="currentColor" strokeWidth="1.5" fill="none"/></>,
    copy: <><rect x="4" y="4" width="8" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M4 12H3a1 1 0 01-1-1V3a1 1 0 011-1h6a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.5" fill="none"/></>,
    target: <><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="8" cy="8" r="0.5" fill="currentColor"/></>,
    user: <><circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M2 15c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/></>,
    star: <path d="M8 1l2 4.5 5 .7-3.6 3.5.8 5L8 12.5 3.8 14.7l.8-5L1 6.2l5-.7L8 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>,
    zap: <path d="M9 1L3 9h5l-1 6 6-8H8l1-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>,
    'bar-chart': <><rect x="1" y="8" width="3" height="6" rx="0.5" fill="currentColor" opacity=".4"/><rect x="6.5" y="4" width="3" height="10" rx="0.5" fill="currentColor" opacity=".7"/><rect x="12" y="1" width="3" height="13" rx="0.5" fill="currentColor"/></>,
    calendar: <><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M2 7h12M5 1v4M11 1v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/></>,
    clock: <><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M8 4v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></>,
    refresh: <path d="M2 8a6 6 0 0111.5-2.3M14 8a6 6 0 01-11.5 2.3M13.5 2v3.7h-3.7M2.5 14v-3.7h3.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    download: <><path d="M8 2v8M4 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/><path d="M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/></>,
    image: <><rect x="1" y="2" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="5" cy="6" r="1.5" fill="currentColor"/><path d="M1 12l4-4 2 2 3-3 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/></>,
    pill: <><rect x="2" y="5" width="12" height="6" rx="3" stroke="currentColor" strokeWidth="1.5" fill="none"/><line x1="8" y1="5" x2="8" y2="11" stroke="currentColor" strokeWidth="1.5"/></>,
  };

  return (
    <svg viewBox="0 0 16 16" fill="none" width={size} height={size} {...props}>
      {icons[name] || null}
    </svg>
  );
}
