import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { 
  Box, Paper, TextField, Button, Typography, 
  Alert, CircularProgress, InputAdornment 
} from '@mui/material';
import { Email, Lock } from '@mui/icons-material';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (sessionStorage.getItem('admin_session') === 'active') {
      navigate('/admin', { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      /**
       * STEP 1: PRE-LOGIN CLEANUP
       * Wipes any "stuck" sessions from previous attempts to prevent 
       * the ProtectedRoute from triggering a mismatch immediately.
       */
      sessionStorage.clear();
      await supabase.auth.signOut();

      // STEP 2: AUTHENTICATION
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });
      
      if (authError) throw authError;

      // STEP 3: GENERATE NEW DEVICE TOKEN
      const currentSessionId = self.crypto.randomUUID();

      // STEP 4: UPDATE PROFILE IN DATABASE
      // This "registers" this browser/device as the current active one.
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .update({ active_session_id: currentSessionId })
        .eq('id', authData.user.id)
        .select('first_name, role, branch_office')
        .maybeSingle(); 

      if (profileError) {
        throw new Error(`Database Error: ${profileError.message}`);
      }

      if (!profile) {
        // If this fails, check your RLS policies for UPDATE on 'profiles' table.
        throw new Error("Profile access denied. Ensure Row Level Security (RLS) allows updates.");
      }

      /**
       * STEP 5: ATOMIC SESSION STORAGE
       * We save the IDs FIRST, and the 'admin_session' flag LAST.
       */
      sessionStorage.setItem('userId', authData.user.id); 
      sessionStorage.setItem('email', authData.user.email); 
      sessionStorage.setItem('admin_name', profile.first_name || 'Admin');
      sessionStorage.setItem('role', String(profile.role));
      sessionStorage.setItem('branch_office', profile.branch_office || ''); 
      sessionStorage.setItem('device_token', currentSessionId);
      
      // The trigger for ProtectedRoute
      sessionStorage.setItem('admin_session', 'active');

      // FINAL STEP: NAVIGATION
      navigate('/admin', { replace: true });

    } catch (err) {
      console.error("Login failed:", err);
      setError(err.message);
      sessionStorage.clear(); 
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#020617' }}>
      <Paper 
        elevation={6} 
        sx={{ 
          p: 4, width: '100%', maxWidth: 400, bgcolor: '#0f172a', 
          color: 'white', borderRadius: 3, border: '1px solid #1e293b' 
        }}
      >
        <Box textAlign="center" mb={3}>
          <Typography variant="h5" fontWeight="900" letterSpacing={1} color="white">
            LTO ADMIN <span style={{ color: '#ef4444' }}>LOGIN</span>
          </Typography>
          
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2, fontSize: '0.85rem', borderRadius: 2, bgcolor: 'rgba(211, 47, 47, 0.1)', color: '#ff8a80' }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleLogin}>
          <TextField 
            fullWidth label="Email Address" variant="filled" margin="normal" required 
            value={email}
            onChange={e => setEmail(e.target.value)} 
            InputLabelProps={{ sx: { color: '#94a3b8' } }}
            InputProps={{ 
              sx: { color: 'white', bgcolor: 'rgba(255,255,255,0.03)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } },
              startAdornment: <InputAdornment position="start"><Email sx={{ color: '#ef4444' }} /></InputAdornment>,
              disableUnderline: true
            }} 
            sx={{ mb: 1 }}
          />
          <TextField 
            fullWidth label="Password" type="password" variant="filled" margin="normal" required 
            value={password}
            onChange={e => setPassword(e.target.value)} 
            InputLabelProps={{ sx: { color: '#94a3b8' } }}
            InputProps={{ 
              sx: { color: 'white', bgcolor: 'rgba(255,255,255,0.03)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } },
              startAdornment: <InputAdornment position="start"><Lock sx={{ color: '#ef4444' }} /></InputAdornment>,
              disableUnderline: true
            }} 
          />

          <Button 
            fullWidth variant="contained" size="large" type="submit" disabled={loading} 
            sx={{ 
              mt: 4, py: 1.5, fontWeight: 900, bgcolor: '#ef4444',
              '&:hover': { bgcolor: '#dc2626' },
              '&.Mui-disabled': { bgcolor: '#1e293b', color: '#475569' }
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'LOGIN'}
          </Button>
        </form>
      </Paper>
    </Box>
  );
}