import { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Paper, 
  Grid, 
  CircularProgress, 
  Fade, 
  Zoom,
  alpha
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VerifiedIcon from '@mui/icons-material/Verified';
import { supabase } from "../supabaseClient"; 

export default function SearchForm() {
  const [plate, setPlate] = useState('');
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Security & Counter State
  const [honeypot, setHoneypot] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Handles the countdown logic for the button
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (honeypot) return; 
    
    // Prevent clicking if cooldown is active
    if (cooldown > 0) return;
    if (!plate || loading) return; 

    setLoading(true);
    setError(null);

    const cleanInput = plate.trim().toUpperCase().replace(/[^A-Z0-9\s-]/g, '');

    const { data, error: dbError } = await supabase
      .from('plates')
      .select(`*, offices:office_id ( name )`)
      .or(`plate_number.eq.${cleanInput},mv_file.eq.${cleanInput}`)
      .maybeSingle();

    if (dbError) {
      setError("DATABASE CONNECTION ERROR");
      setCooldown(5); // 5 second penalty for system errors
    } else if (!data) {
      setError("RECORD NOT FOUND");
      setCooldown(3); // 3 second cooldown for missed searches
    } else {
      setRecord(data);
      setCooldown(0);
    }
    setLoading(false);
  };

  const handleBack = () => {
    setRecord(null);
    setPlate('');
    setError(null);
  };

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', p: 2 }}>
      {!record ? (
        /* --- SEARCH VIEW --- */
        <Zoom in={true}>
          <Paper
            component="form"
            onSubmit={handleSearch}
            sx={{
              width: '100%', maxWidth: 400, p: 4, borderRadius: 6,
              bgcolor: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <input type="text" style={{ display: 'none' }} value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
            
            <Typography sx={{ color: '#3b82f6', fontWeight: 900, textAlign: 'center', mb: 3, letterSpacing: '0.2em', fontSize: '0.7rem' }}>
              PLATE NUMBER - MV FILE
            </Typography>
            
            <TextField
              fullWidth variant="standard" autoComplete="off" placeholder="ABC 1234"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              InputProps={{
                disableUnderline: true,
                sx: {
                  color: 'white', fontSize: '1.8rem', fontWeight: 900, fontFamily: 'monospace',
                  bgcolor: 'rgba(255, 255, 255, 0.05)', borderRadius: 2, px: 2, py: 1,
                  '& input': { textAlign: 'center' },
                }
              }}
            />

            <Button
              fullWidth 
              type="submit" 
              disabled={loading || cooldown > 0}
              variant="contained"
              sx={{ 
                mt: 3, 
                py: 1.5, 
                borderRadius: 2, 
                fontWeight: 900, 
                letterSpacing: '0.1em',
                bgcolor: cooldown > 0 ? alpha('#ef4444', 0.2) : '#2563eb',
                color: cooldown > 0 ? '#ef4444' : 'white',
                border: cooldown > 0 ? '1px solid #ef4444' : 'none',
                '&:hover': { bgcolor: '#3b82f6' },
                transition: 'all 0.3s ease'
              }}
            >
              {loading ? (
                <CircularProgress size={20} color="inherit" />
              ) : cooldown > 0 ? (
                `WAIT ${cooldown}S`
              ) : (
                "SEARCH"
              )}
            </Button>

            {error && <Typography sx={{ color: '#f87171', fontSize: '0.65rem', fontWeight: 800, textAlign: 'center', mt: 2 }}>{error}</Typography>}
          </Paper>
        </Zoom>
      ) : (
        /* --- RESTORED PLATE TEMPLATE VIEW --- */
        <Fade in={true}>
          <Paper
            sx={{
              width: '100%', maxWidth: 550, p: { xs: 3, md: 5 }, borderRadius: 6,
              bgcolor: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(30px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 40px 80px -20px rgba(0,0,0,0.8)',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
              <Button
                onClick={handleBack}
                startIcon={<ArrowBackIcon />}
                sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.1em' }}
              >
                RETURN
              </Button>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: alpha('#22c55e', 0.1), px: 1.5, py: 0.5, borderRadius: 1 }}>
                <VerifiedIcon sx={{ color: '#22c55e', fontSize: '0.8rem' }} />
                <Typography sx={{ color: '#22c55e', fontWeight: 900, fontSize: '0.6rem' }}>VERIFIED</Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 6 }}>
              <Box sx={{ 
                width: '100%', maxWidth: 320, bgcolor: '#f8fafc', borderRadius: 2, 
                border: '4px solid #94a3b8', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', overflow: 'hidden' 
              }}>
                <Box sx={{ bgcolor: '#0038a8', py: 0.5, textAlign: 'center' }}>
                  <Typography sx={{ color: 'white', fontSize: '0.55rem', fontWeight: 900, letterSpacing: '0.4em' }}>
                    PHILIPPINES
                  </Typography>
                </Box>
                <Box sx={{ py: 4, position: 'relative', textAlign: 'center', bgcolor: 'white' }}>
                  <Box sx={{ position: 'absolute', top: 8, left: 16, width: 8, height: 8, borderRadius: '50%', bgcolor: '#e2e8f0', border: '1px solid #cbd5e1' }} />
                  <Box sx={{ position: 'absolute', top: 8, right: 16, width: 8, height: 8, borderRadius: '50%', bgcolor: '#e2e8f0', border: '1px solid #cbd5e1' }} />
                  
                  <Typography sx={{ fontSize: { xs: '2.5rem', md: '3.5rem' }, fontWeight: 900, color: '#0f172a', lineHeight: 1, letterSpacing: '-0.02em' }}>
                    {record.plate_number}
                  </Typography>
                </Box>
                <Box sx={{ borderTop: '1px solid #f1f5f9', py: 1, textAlign: 'center', bgcolor: '#f8fafc' }}>
                  <Typography sx={{ color: '#64748b', fontSize: '0.65rem', fontWeight: 900, fontStyle: 'italic', letterSpacing: '0.1em' }}>
                    {record.dealer || "REGION V - BICOL"}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <DataRow label="Current Status" value={record.status} highlight />
              </Grid>
              <Grid item xs={12} md={6}>
                <DataRow label="MV File Number" value={record.mv_file} />
              </Grid>
              <Grid item xs={12} md={6}>
                <DataRow label="LTO Office" value={record.offices?.name || "N/A"} />
              </Grid>
            </Grid>
          </Paper>
        </Fade>
      )}
    </Box>
  );
}

function DataRow({ label, value, highlight = false }) {
  return (
    <Box sx={{ textAlign: 'left', borderLeft: highlight ? '3px solid #3b82f6' : '1px solid rgba(255,255,255,0.05)', pl: 2 }}>
      <Typography sx={{ color: '#3b82f6', fontWeight: 900, fontSize: '0.6rem', letterSpacing: '0.15em', mb: 0.5, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography sx={{ 
        color: highlight ? 'white' : 'rgba(255, 255, 255, 0.7)', 
        fontSize: highlight ? '1.4rem' : '1.1rem', 
        fontWeight: highlight ? 800 : 600,
        textTransform: 'uppercase'
      }}>
        {value || '---'}
      </Typography>
    </Box>
  );
}