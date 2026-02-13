import { Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export default function ProtectedRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isVerifying, setIsVerifying] = useState(true);
  
  // Use a stable boolean for auth check
  const isAuthenticated = sessionStorage.getItem('admin_session') === 'active';

  // We wrap the check in useCallback to keep the reference stable
  const checkSingleSession = useCallback(async () => {
    if (!isAuthenticated) {
      setIsVerifying(false);
      return;
    }

    try {
      const userId = sessionStorage.getItem('userId');
      const localToken = sessionStorage.getItem('device_token');

      // If we are authenticated but missing IDs, the session is corrupt
      if (!userId || !localToken) {
        console.warn("Session identifiers missing. Cleaning up...");
        sessionStorage.clear();
        navigate('/admin/login', { replace: true });
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('active_session_id')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (profile && profile.active_session_id !== localToken) {
        console.warn("Session mismatch detected.");
        sessionStorage.clear();
        await supabase.auth.signOut();
        alert("This account is now active on another device.");
        navigate('/admin/login', { replace: true });
      }
    } catch (err) {
      console.error("Verification failed:", err.message);
    } finally {
      setIsVerifying(false);
    }
  }, [isAuthenticated, navigate]); // Dependencies are now constant size

  useEffect(() => {
    checkSingleSession();

    // Re-verify when the window gets focus (user tabs back)
    window.addEventListener('focus', checkSingleSession);
    return () => window.removeEventListener('focus', checkSingleSession);
  }, [checkSingleSession]); // Array size stays exactly 1

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  if (isVerifying) return null; 

  return <Outlet />;
}