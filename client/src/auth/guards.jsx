import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { Loading } from '../components/ui.jsx';
import Forbidden from '../pages/Forbidden.jsx';

/** Signed-in users only; others are sent to /login and returned afterwards. */
export function ProtectedRoute() {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="center-screen"><div className="spinner" /></div>;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

/** Shows "You don't have access" unless the user holds the permission. */
export function RequirePermission({ action, children }) {
  const { can, loading } = useAuth();
  if (loading) return <Loading />;
  return can(action) ? children : <Forbidden />;
}
