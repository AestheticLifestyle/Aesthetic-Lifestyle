import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useT } from '../../i18n';
import { redeemInviteCode } from '../../services/invites';

export default function LoginScreen() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState('client');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteError, setInviteError] = useState('');

  const { login, register, loading, error, clearError } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname;

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    setInviteError('');

    let success;
    if (isRegister) {
      success = await register(email, password, fullName, selectedRole);
    } else {
      success = await login(email, password);
    }

    if (success) {
      // If registering as client with an invite code, redeem it
      const { user, role } = useAuthStore.getState();
      if (isRegister && selectedRole === 'client' && inviteCode.trim()) {
        const result = await redeemInviteCode(user.id, inviteCode.trim());
        if (!result.success) {
          setInviteError(result.error);
          // Still proceed — account is created, just not linked
        }
      }

      const defaultPath = role === 'coach' ? '/coach/overview' : '/app/dashboard';
      navigate(from || defaultPath, { replace: true });
    }
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    clearError();
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <img src="/logo-al.jpg" alt="AL" className="auth-logo-img" />
          <div className="auth-brand">{t('appName')}</div>
          <div className="auth-sub">
            {isRegister ? t('createAccount') : t('welcomeBack')}
          </div>
        </div>

        {/* Error */}
        {error && <div className="auth-error">{error}</div>}

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister && (
            <div className="form-group">
              <label>{t('fullName')}</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder={t('yourFullName')}
                required
                autoComplete="name"
              />
            </div>
          )}

          <div className="form-group">
            <label>{t('email')}</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label>{t('password')}</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t('passwordPlaceholder')}
              required
              minLength={6}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
          </div>

          {isRegister && (
            <div className="form-group">
              <label>{t('iAmA')}</label>
              <div className="role-selector">
                <button
                  type="button"
                  className={`role-btn ${selectedRole === 'client' ? 'active' : ''}`}
                  onClick={() => setSelectedRole('client')}
                >
                  {t('athlete')}
                </button>
                <button
                  type="button"
                  className={`role-btn ${selectedRole === 'coach' ? 'active' : ''}`}
                  onClick={() => setSelectedRole('coach')}
                >
                  {t('coach')}
                </button>
              </div>
            </div>
          )}

          {isRegister && selectedRole === 'client' && (
            <div className="form-group">
              <label>{t('coachInviteCode')} <span style={{ color: 'var(--t3)', fontWeight: 400 }}>({t('optional')})</span></label>
              <input
                type="text"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                placeholder={t('inviteCodePlaceholder')}
                maxLength={6}
                style={{ letterSpacing: 3, fontFamily: 'var(--fd)', textAlign: 'center', fontSize: 16 }}
                autoComplete="off"
              />
              {inviteError && (
                <div style={{ fontSize: 11, color: 'var(--orange)', marginTop: 4 }}>{inviteError}</div>
              )}
            </div>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading ? t('loading') : isRegister ? t('createAccountBtn') : t('signIn')}
          </button>
        </form>

        {/* Toggle */}
        <div className="auth-toggle">
          {isRegister ? t('alreadyHaveAccount') : t('dontHaveAccount')}
          <button type="button" onClick={toggleMode} className="auth-link">
            {isRegister ? t('signIn') : t('register')}
          </button>
        </div>
      </div>
    </div>
  );
}
