import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export default function AuthGuard({ children, requiredRole }) {
  const { user, role, loading } = useAuthStore();
  const location = useLocation();

  // Show nothing while auth is initializing
  if (loading) {
    return (
      <div className="auth-loading">
        <div className="spinner" />
      </div>
    );
  }

  // Not logged in → redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Wrong role → redirect to correct dashboard
  if (requiredRole && role !== requiredRole) {
    const redirectTo = role === 'coach' ? '/coach/overview' : '/app/dashboard';
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}
