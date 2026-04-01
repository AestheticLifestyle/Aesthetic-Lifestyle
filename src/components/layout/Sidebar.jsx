import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useCoachStore } from '../../stores/coachStore';
import { useUIStore } from '../../stores/uiStore';
import { Icon } from '../../utils/icons';
import { COACH_NAV, CLIENT_NAV } from '../../utils/constants';

export default function Sidebar() {
  const { user, role, logout } = useAuthStore();
  const { sidebarOpen, closeSidebar } = useUIStore();
  const navigate = useNavigate();
  const isCoach = role === 'coach';
  const navItems = isCoach ? COACH_NAV : CLIENT_NAV;
  const basePath = isCoach ? '/coach' : '/app';
  const fullName = user?.user_metadata?.full_name || 'User';
  const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Group nav items
  const groups = {};
  navItems.forEach(item => {
    if (!groups[item.group]) groups[item.group] = [];
    groups[item.group].push(item);
  });

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleRoleSwitch = () => {
    const newRole = isCoach ? 'client' : 'coach';
    const isOverride = newRole === 'client';
    useAuthStore.setState({ role: newRole, roleOverride: isOverride });

    // Persist across page refresh
    if (isOverride) {
      sessionStorage.setItem('roleOverride', 'true');
      // Save the client ID so useDataLoader can find it after refresh
      const clients = useCoachStore.getState().clients;
      const clientId = clients?.[0]?.client_id;
      if (clientId) sessionStorage.setItem('overrideClientId', clientId);
    } else {
      sessionStorage.removeItem('roleOverride');
      sessionStorage.removeItem('overrideClientId');
    }

    closeSidebar();
    navigate(newRole === 'coach' ? '/coach/overview' : '/app/dashboard');
  };

  return (
    <nav className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      {/* Logo */}
      <div className="nav-logo">
        <div className="logo-mark">
          <img src="/logo-al.jpg" alt="AL" />
        </div>
        <div className="logo-words">
          <div className="brand">AESTHETIC LIFESTYLE</div>
          <div className="sub">{isCoach ? 'Coach CMS · Admin' : 'Client App'}</div>
        </div>
      </div>

      {/* Nav groups */}
      {Object.entries(groups).map(([group, items]) => (
        <div className="nav-grp" key={group}>
          <div className="nav-grp-label">{group}</div>
          {items.map(item => (
            <NavLink
              key={item.id}
              to={`${basePath}/${item.id}`}
              className={({ isActive }) =>
                `ni ${isCoach ? '' : 'client-nav'} ${isActive ? 'active' : ''}`
              }
              onClick={closeSidebar}
            >
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </div>
      ))}

      {/* Bottom user card */}
      <div className="nav-bottom">
        <div className="u-card">
          <div className="u-av" style={{
            background: isCoach
              ? 'linear-gradient(135deg, var(--gold), var(--gold-l))'
              : 'linear-gradient(135deg, var(--green), var(--blue))',
            color: 'var(--black)',
          }}>
            {initials}
          </div>
          <div>
            <div className="u-name">{fullName}</div>
            <div className="u-role">{isCoach ? 'Head Coach' : 'Athlete'}</div>
          </div>
          <div className="rt-dot" style={{ marginLeft: 'auto' }} title="Live sync active" />
        </div>
        {/* Role switcher for testing */}
        <button
          className="ni"
          onClick={handleRoleSwitch}
          style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}
        >
          <Icon name="refresh" />
          Switch to {isCoach ? 'Client' : 'Coach'} View
        </button>
        <button
          className="ni"
          onClick={handleLogout}
          style={{ marginTop: 4, opacity: 0.6 }}
        >
          <Icon name="log-out" />
          Sign Out
        </button>
      </div>
    </nav>
  );
}
