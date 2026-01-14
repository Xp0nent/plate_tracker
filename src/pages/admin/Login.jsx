import { useState, useEffect } from 'react';
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
      // 1. Auth check
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });
      
      if (authError) throw authError;

      // 2. Fetch profile WITH branch_office
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, role, branch_office')
        .eq('id', authData.user.id)
        .maybeSingle(); 

      if (profileError || !profile) {
        throw new Error("Account verified, but profile data is missing.");
      }

      // 3. Set Session Storage
      sessionStorage.clear();
      sessionStorage.setItem('userId', authData.user.id); 
      sessionStorage.setItem('email', authData.user.email); 
      sessionStorage.setItem('admin_session', 'active');
      sessionStorage.setItem('admin_name', profile.first_name || 'Admin');
      sessionStorage.setItem('role', String(profile.role));
      
      // CRITICAL: Save the branch ID so the Layout can find the name
      sessionStorage.setItem('branch_office', profile.branch_office || ''); 

      navigate('/admin', { replace: true });

    } catch (err) {
      setError(err.message);
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
          <Typography variant="h5" fontWeight="900" letterSpacing={1}>LTO ADMIN LOGIN</Typography>
          <Typography variant="body2" color="gray">Verify Inventory Credentials</Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2, fontSize: '0.85rem', borderRadius: 2 }}>
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
              sx: { color: 'white', bgcolor: 'rgba(255,255,255,0.05)' },
              startAdornment: <InputAdornment position="start"><Email sx={{ color: '#3b82f6' }} /></InputAdornment>
            }} 
          />
          <TextField 
            fullWidth label="Password" type="password" variant="filled" margin="normal" required 
            value={password}
            onChange={e => setPassword(e.target.value)} 
            InputLabelProps={{ sx: { color: '#94a3b8' } }}
            InputProps={{ 
              sx: { color: 'white', bgcolor: 'rgba(255,255,255,0.05)' },
              startAdornment: <InputAdornment position="start"><Lock sx={{ color: '#3b82f6' }} /></InputAdornment>
            }} 
          />

          <Button 
            fullWidth variant="contained" size="large" type="submit" disabled={loading} 
            sx={{ 
              mt: 4, py: 1.5, fontWeight: 'bold', bgcolor: '#3b82f6',
              '&:hover': { bgcolor: '#2563eb' }
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'SIGN IN'}
          </Button>
        </form>
      </Paper>
    </Box>
  );
}