import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { Card } from '../../components/ui';
import { Icon } from '../../utils/icons';
import { supabase } from '../../services/supabase';

function SettingRow({ label, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13, color: 'var(--t2)' }}>{label}</span>
      <div>{children}</div>
    </div>
  );
}

function ProfileSection({ user }) {
  const { showToast } = useUIStore();
  const [name, setName] = useState(user?.user_metadata?.full_name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: name.trim() },
    });
    setSaving(false);
    showToast(error ? 'Failed to update profile' : 'Profile updated!', error ? 'error' : 'success');
  };

  return (
    <Card title="Profile">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: 'var(--gold-d)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--gold)', fontFamily: 'var(--fd)', fontSize: 22, fontWeight: 600,
        }}>
          {(name || 'C').charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{name || 'Coach'}</div>
          <div style={{ fontSize: 12, color: 'var(--t3)' }}>{user?.email}</div>
        </div>
      </div>

      <SettingRow label="Full Name">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            className="form-inp"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: 180, fontSize: 12, padding: '6px 10px' }}
          />
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving} style={{ padding: '5px 12px', fontSize: 11 }}>
            {saving ? '...' : 'Save'}
          </button>
        </div>
      </SettingRow>

      <SettingRow label="Email">
        <span style={{ fontSize: 12, color: 'var(--t3)' }}>{user?.email}</span>
      </SettingRow>

      <SettingRow label="Role">
        <span className="tag t-gold" style={{ fontSize: 10 }}>Coach</span>
      </SettingRow>
    </Card>
  );
}

function DefaultsSection() {
  const [stepTarget, setStepTarget] = useState(10000);
  const [defaultCalories, setDefaultCalories] = useState(2400);
  const [defaultProtein, setDefaultProtein] = useState(180);
  const { showToast } = useUIStore();

  return (
    <Card title="Coaching Defaults" subtitle="Applied to new clients">
      <SettingRow label="Default Step Target">
        <input
          className="form-inp"
          type="number"
          value={stepTarget}
          onChange={e => setStepTarget(e.target.value)}
          style={{ width: 90, fontSize: 12, padding: '6px 10px', textAlign: 'right' }}
        />
      </SettingRow>
      <SettingRow label="Default Calories">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            className="form-inp"
            type="number"
            value={defaultCalories}
            onChange={e => setDefaultCalories(e.target.value)}
            style={{ width: 80, fontSize: 12, padding: '6px 10px', textAlign: 'right' }}
          />
          <span style={{ fontSize: 11, color: 'var(--t3)' }}>kcal</span>
        </div>
      </SettingRow>
      <SettingRow label="Default Protein Target">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            className="form-inp"
            type="number"
            value={defaultProtein}
            onChange={e => setDefaultProtein(e.target.value)}
            style={{ width: 80, fontSize: 12, padding: '6px 10px', textAlign: 'right' }}
          />
          <span style={{ fontSize: 11, color: 'var(--t3)' }}>g</span>
        </div>
      </SettingRow>
      <div style={{ marginTop: 14 }}>
        <button className="btn btn-primary btn-sm" onClick={() => showToast('Defaults saved!', 'success')}>
          Save Defaults
        </button>
      </div>
    </Card>
  );
}

function AppSection({ onSignOut }) {
  return (
    <Card title="App">
      <SettingRow label="App Version">
        <span style={{ fontSize: 12, color: 'var(--t3)', fontFamily: 'var(--fm)' }}>1.0.0</span>
      </SettingRow>
      <SettingRow label="Theme">
        <span className="tag" style={{ fontSize: 10 }}>Dark</span>
      </SettingRow>
      <div style={{ marginTop: 18 }}>
        <button
          className="btn btn-secondary"
          style={{ width: '100%', color: 'var(--red)', borderColor: 'var(--red)' }}
          onClick={onSignOut}
        >
          <Icon name="log-out" size={14} /> Sign Out
        </button>
      </div>
    </Card>
  );
}

export default function CoachSettingsScreen() {
  const { user, signOut } = useAuthStore();

  return (
    <div className="screen active">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 600 }}>
        <ProfileSection user={user} />
        <DefaultsSection />
        <AppSection onSignOut={signOut} />
      </div>
    </div>
  );
}
