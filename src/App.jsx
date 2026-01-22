import { Routes, Route, Navigate } from 'react-router-dom';
import ClientLayout from './layouts/ClientLayout';
import AdminLayout from './layouts/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';

// Client Pages
import Home from './pages/client/Home';

// Admin Pages
import AdminLogin from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import ManagePlates from './pages/admin/ManagePlates';
import ManageUsers from './pages/admin/ManageUsers';

// Password Recovery Pages
import ForgotPassword from './pages/admin/ForgotPassword';
import UpdatePassword from './pages/admin/UpdatePassword';

// 2. Added Role-Based Guard for Super Admin (Role 1)
const SuperAdminRoute = ({ children }) => {
  const role = sessionStorage.getItem('role');
  return role === '1' ? children : <Navigate to="/admin" replace />;
};
// Temporary Polyfill for randomUUID in non-secure local contexts
if (!window.crypto.randomUUID) {
  window.crypto.randomUUID = function() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
  };
}

export default function App() {
  return (
    <Routes>
      
      {/* 1. PUBLIC CLIENT SIDE */}
      <Route element={<ClientLayout />}>
        <Route path="/" element={<Home />} />
      </Route>

      {/* 2. ADMIN AUTH (Publicly accessible) */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/forgot-password" element={<ForgotPassword />} />
      <Route path="/admin/reset-password" element={<UpdatePassword />} />

      {/* 3. PROTECTED ADMIN SIDE */}
      <Route path="/admin" element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="manage" element={<ManagePlates />} />
          
          {/* 3. NEW: Manage Users Route (Protected by SuperAdminRoute) */}
          <Route 
            path="users" 
            element={
              <SuperAdminRoute>
                <ManageUsers />
              </SuperAdminRoute>
            } 
          />
        </Route>
      </Route>

      {/* 4. 404 PAGE */}
      <Route path="*" element={<div className="p-20 text-center">404: PAGE NOT FOUND</div>} />
      
    </Routes>
  );
}