import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ROLES, ROLE_LABELS } from '../constants/roles';

export default function Layout() {
  const { user, signOut } = useAuth();
  const seesDashboard = user && (user.role === ROLES.MANAGER || user.role === ROLES.ADMIN);

  return (
    <div className="app">
      {/* First stop for a keyboard or screen reader user, so they are not
          walked through the whole navigation on every page. */}
      <a className="skip-link" href="#main">Skip to content</a>

      <header className="appbar">
        <div className="appbar-inner">
          <span className="brand">SiteLog</span>
          {user && (
            <button type="button" className="link-button" onClick={signOut}>
              Sign out
            </button>
          )}
        </div>
        {user && (
          <p className="appbar-user">
            {user.fullName} · {ROLE_LABELS[user.role] || user.role}
          </p>
        )}
      </header>

      <main className="content" id="main" tabIndex={-1}>
        <Outlet />
      </main>

      {user && (
        <nav className="tabbar" aria-label="Main">
          {seesDashboard && <NavLink to="/dashboard">Dashboard</NavLink>}
          <NavLink to="/report/new">New report</NavLink>
          <NavLink to="/reports">Reports</NavLink>
        </nav>
      )}
    </div>
  );
}
