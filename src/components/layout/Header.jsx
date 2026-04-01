import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { Icon } from '../../utils/icons';

export default function Header({ title }) {
  const { role } = useAuthStore();
  const { toggleSidebar } = useUIStore();
  const isCoach = role === 'coach';

  return (
    <header className="app-header">
      <button className="menu-btn" onClick={toggleSidebar} aria-label="Toggle menu">
        <Icon name="menu" size={18} />
      </button>

      <h1 className="header-title">{title}</h1>

      <div className="header-right">
        <button className="icon-btn" aria-label="Notifications">
          <Icon name="bell" size={17} />
        </button>
        <div className="rt-dot" title="Live sync active" />
      </div>
    </header>
  );
}
