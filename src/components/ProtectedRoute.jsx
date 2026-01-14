import { Navigate, Outlet } from 'react-router-dom';

export default function ProtectedRoute() {
  // Check session storage for the 'active' flag
  const isAuthenticated = sessionStorage.getItem('admin_session') === 'active';

  // If not authenticated, redirect to login and REPLACE the history entry
  // This prevents the user from clicking "Back" into a loop
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
}