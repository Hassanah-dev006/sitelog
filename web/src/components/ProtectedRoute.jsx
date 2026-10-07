import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/**
 * Guards a route. This is convenience, not security — the API enforces
 * permissions on every request regardless of what the UI shows.
 */
export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <p className="muted center">Loading…</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // An account whose password was set by someone else goes nowhere else first.
  if (user.mustChangePassword && location.pathname !== '/account/password') {
    return <Navigate to="/account/password" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="card">
        <h2>Not available</h2>
        <p className="muted">Your account does not have access to this page.</p>
      </div>
    );
  }

  return children;
}
