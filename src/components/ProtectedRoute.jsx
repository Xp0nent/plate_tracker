import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase'; // Adjust path to your supabase client

export default function ProtectedRoute() {
  const navigate = useNavigate();
  const [isVerifying, setIsVerifying] = useState(true);
  
  // 1. Initial local check
  const isAuthenticated = sessionStorage.getItem('admin_session') === 'active';

  useEffect(() => {
    const checkSingleSession = async () => {
      // If locally not logged in, don't bother checking DB
      if (!isAuthenticated) {
        setIsVerifying(false);
        return;
      }

      try {
        const userId = sessionStorage.getItem('userId');
        const localToken = sessionStorage.getItem('device_token');

        // Fetch the current session ID locked in the database
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('active_session_id')
          .eq('id', userId)
          .single();

        if (error) throw error;

        // THE HEART OF THE LOGIC: 
        // If the DB has a different ID, this device is no longer the "Active" one.
        if (profile?.active_session_id !== localToken) {
          console.warn("Session hijacked or logged in on another device.");
          
          // Clear everything and kick out
          await supabase.auth.signOut();
          sessionStorage.clear();
          navigate('/admin/login', { replace: true });
          alert("This account is now active on another device. You have been logged out.");
        }
      } catch (err) {
        console.error("Session verification failed:", err.message);
      } finally {
        setIsVerifying(false);
      }
    };

    // Run check immediately on route change
    checkSingleSession();

    // Also check when the user returns to this tab (Window Focus)
    window.addEventListener('focus', checkSingleSession);
    return () => window.removeEventListener('focus', checkSingleSession);
  }, [isAuthenticated, navigate]);

  // If locally not authenticated, redirect immediately
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  // Optional: Show a tiny loader while the first DB check happens
  if (isVerifying) return null; 

  return <Outlet />;
}