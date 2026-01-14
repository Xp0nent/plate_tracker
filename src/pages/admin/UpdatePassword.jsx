import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Box, Paper, TextField, Button, Typography } from '@mui/material';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleUpdate = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) {
      alert("Password updated! Log in with your new credentials.");
      navigate('/admin/login');
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#020617' }}>
      <Paper sx={{ p: 4, width: 400, bgcolor: '#0f172a', color: 'white' }}>
        <Typography variant="h5" fontWeight="800" mb={2}>NEW PASSWORD</Typography>
        <form onSubmit={handleUpdate}>
          <TextField fullWidth type="password" label="Enter New Password" variant="filled" sx={{ mb: 2, bgcolor: 'white', borderRadius: 1 }} onChange={e => setPassword(e.target.value)} />
          <Button fullWidth variant="contained" type="submit">Update Password</Button>
        </form>
      </Paper>
    </Box>
  );
}