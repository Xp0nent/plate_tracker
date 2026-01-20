import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Paper, 
  CircularProgress, 
  Fade, 
  Zoom,
  alpha,
  Divider
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VerifiedIcon from '@mui/icons-material/Verified';
import ShieldIcon from '@mui/icons-material/Shield';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import { supabase } from "../supabaseClient"; 

export default function SearchForm() {
  const [plate, setPlate] = useState('');
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Security & Counter State
  const [honeypot, setHoneypot] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (honeypot) return; 
    if (cooldown > 0 || !plate || loading) return; 

    setLoading(true);
    setError(null);

    // SECURITY: Strict sanitization to prevent SQL Injection
    const cleanInput = plate.trim().toUpperCase().replace(/[^A-Z0-9\s]/g, '');

    if (cleanInput.length < 3) {
      setError("INPUT TOO SHORT");
      setLoading(false);
      return;
    }

    try {
      const { data, error: dbError } = await supabase
        .from('plates')
        .select(`*, offices:office_id ( name )`)
        .or(`plate_number.ilike.${cleanInput},mv_file.ilike.${cleanInput}`)
        .maybeSingle();

      if (dbError) {
        setError("SYSTEM ERROR: ACCESS DENIED");
        setCooldown(10); 
      } else if (!data) {
        setError("RECORD NOT FOUND");
        setCooldown(3); 
      } else {
        setRecord(data);
        setCooldown(0);
      }
    } catch (err) {
      setError("UNEXPECTED ERROR");
    } finally {
      setLoading(false);
    }
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
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
            }}
          >
            <input 
              type="text" 
              autoComplete="off"
              style={{ display: 'none' }} 
              value={honeypot} 
              onChange={(e) => setHoneypot(e.target.value)} 
              tabIndex="-1"
            />
            
            <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 1 }}>
                    <ShieldIcon sx={{ color: alpha('#3b82f6', 0.4), fontSize: '1.2rem' }} />
                    <DirectionsCarIcon sx={{ color: '#3b82f6', fontSize: '1.2rem' }} />
                </Box>
                <Typography sx={{ color: '#3b82f6', fontWeight: 900, letterSpacing: '0.2em', fontSize: '0.7rem' }}>
                PLATE NUMBER | MV FILE NUMBER
                </Typography>
            </Box>
            
            <TextField
              fullWidth variant="standard" autoComplete="off" placeholder="XXXXXXX"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              inputProps={{ maxLength: 15 }}
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
              fullWidth type="submit" 
              disabled={loading || cooldown > 0}
              variant="contained"
              sx={{ 
                mt: 3, py: 1.5, borderRadius: 2, fontWeight: 900, 
                bgcolor: cooldown > 0 ? alpha('#ef4444', 0.2) : '#2563eb',
                color: cooldown > 0 ? '#ef4444' : 'white',
                border: cooldown > 0 ? '1px solid #ef4444' : 'none',
                '&:hover': { bgcolor: '#3b82f6' },
                transition: 'all 0.3s ease'
              }}
            >
              {loading ? <CircularProgress size={20} color="inherit" /> : cooldown > 0 ? `LOCKED: ${cooldown}S` : "SEARCH DATABASE"}
            </Button>

            {error && <Typography sx={{ color: '#f87171', fontSize: '0.65rem', fontWeight: 800, textAlign: 'center', mt: 2 }}>{error}</Typography>}
          </Paper>
        </Zoom>
      ) : (
        /* --- RESULTS VIEW (ONLY STATUS) --- */
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
                sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', fontWeight: 900 }}
              >
                BACK TO SEARCH
              </Button>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: alpha('#22c55e', 0.1), px: 1.5, py: 0.5, borderRadius: 1 }}>
                <VerifiedIcon sx={{ color: '#22c55e', fontSize: '0.8rem' }} />
                <Typography sx={{ color: '#22c55e', fontWeight: 900, fontSize: '0.6rem' }}>OFFICIAL RECORD</Typography>
              </Box>
            </Box>

            {/* PLATE TEMPLATE */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
              <Box sx={{ 
                width: '100%', maxWidth: 320, bgcolor: '#f8fafc', borderRadius: 2, 
                border: '4px solid #94a3b8', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', overflow: 'hidden' 
              }}>
                <Box sx={{ bgcolor: '#0038a8', py: 0.5, textAlign: 'center' }}>
                  <Typography sx={{ color: 'white', fontSize: '0.55rem', fontWeight: 900, letterSpacing: '0.4em' }}>PHILIPPINES</Typography>
                </Box>
                <Box sx={{ py: 4, textAlign: 'center', bgcolor: 'white' }}>
                  <Typography sx={{ fontSize: { xs: '2.5rem', md: '3.5rem' }, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
                    {record.plate_number}
                  </Typography>
                </Box>
                <Box sx={{ borderTop: '1px solid #f1f5f9', py: 1, textAlign: 'center', bgcolor: '#f8fafc' }}>
                  <Typography sx={{ color: '#64748b', fontSize: '0.65rem', fontWeight: 900, fontStyle: 'italic' }}>REGION V - BICOL</Typography>
                </Box>
              </Box>
            </Box>

            <Divider sx={{ mb: 4, borderColor: 'rgba(255,255,255,0.1)' }} />

            {/* STATUS ONLY SECTION */}
            <Box sx={{ 
              p: 3, borderRadius: 3, bgcolor: alpha('#3b82f6', 0.05), 
              border: '1px solid', borderColor: alpha('#3b82f6', 0.2)
            }}>
              <DataRow 
                label="STATUS" 
                value={
                  record.status === 1 || record.status === '1'
                    ? `AVAILABLE FOR PICK-UP. Please visit ${record.offices?.name || 'the LTO Office'} and present your original CR/OR to claim your plate.`
                    : `RELEASED TO DEALER. Please coordinate directly with ${record.dealer || 'your dealer'} for your plate.`
                } 
                highlight 
              />
            </Box>
          </Paper>
        </Fade>
      )}
    </Box>
  );
}

function DataRow({ label, value, highlight = false }) {
  return (
    <Box sx={{ textAlign: 'left' }}>
      <Typography sx={{ 
        color: '#3b82f6', fontWeight: 900, fontSize: '0.65rem', letterSpacing: '0.15em', mb: 1.5, textTransform: 'uppercase',
        display: 'flex', alignItems: 'center',
        '&::after': {
          content: '""', flex: 1, height: '1px', bgcolor: alpha('#3b82f6', 0.2), ml: 2
        }
      }}>
        {label}
      </Typography>
      <Typography sx={{ 
        color: highlight ? 'white' : 'rgba(255, 255, 255, 0.7)', 
        fontSize: highlight ? '1.1rem' : '1rem', 
        fontWeight: highlight ? 700 : 500,
        lineHeight: 1.6
      }}>
        {value || 'DATA UNAVAILABLE'}
      </Typography>
    </Box>
  );
}