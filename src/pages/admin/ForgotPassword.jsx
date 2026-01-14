import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Box, Paper, TextField, Button, Typography, Alert } from '@mui/material';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin/reset-password`,
    });
    if (!error) setSent(true);
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#020617' }}>
      <Paper sx={{ p: 4, width: 400, bgcolor: '#0f172a', color: 'white' }}>
        <Typography variant="h5" fontWeight="800" mb={2}>RESET ACCESS</Typography>
        {sent ? (
          <Alert severity="success">Check your email for the LTO Plate Tracker reset link!</Alert>
        ) : (
          <form onSubmit={handleReset}>
            <TextField fullWidth label="Admin Email" variant="filled" sx={{ mb: 2, bgcolor: 'white', borderRadius: 1 }} onChange={e => setEmail(e.target.value)} />
            <Button fullWidth variant="contained" type="submit">Send Reset Link</Button>
          </form>
        )}
      </Paper>
    </Box>
  );
}