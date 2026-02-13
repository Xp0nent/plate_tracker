import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, Typography, TextField, Button, Paper, CircularProgress, 
  Fade, Zoom, alpha, Divider 
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VerifiedIcon from '@mui/icons-material/Verified';
import ShieldIcon from '@mui/icons-material/Shield';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import { supabase } from "../supabaseClient"; 
import { encryptData } from '../utils/crypto';

export default function SearchForm() {
  const navigate = useNavigate();
  const location = useLocation(); 
  const resultRef = useRef(null);
  
  const [plate, setPlate] = useState('');
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [honeypot, setHoneypot] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // LOGIC TO HIDE THIS COMPONENT WHEN AUTHORIZATION IS SHOWING
  const queryParams = new URLSearchParams(location.search);
  const showAuth = queryParams.get('showAuth') === 'true';

  useEffect(() => {
    if (record && resultRef.current) {
      setTimeout(() => {
        resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [record]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // If we are in "Auth Mode", render nothing so the other component takes over
  if (showAuth) return null;

  const handleSearch = async (e) => {
    e.preventDefault();
    if (honeypot) return; 
    if (cooldown > 0 || !plate || loading) return; 

    setLoading(true);
    setError(null);

    const cleanInput = plate.trim().toUpperCase().replace(/[^A-Z0-9\s]/g, '');

    if (cleanInput.length < 3) {
      setError("INPUT TOO SHORT");
      setLoading(false);
      return;
    }

    try {
      const { data: physicalData, error: physicalError } = await supabase
        .from('plates')
        .select(`id, plate_number, mv_file, status, dealer, office_id, offices:office_id ( name )`)
        .or(`plate_number.ilike.${cleanInput},mv_file.ilike.${cleanInput}`)
        .maybeSingle();

      if (physicalError) throw physicalError;

      if (physicalData) {
        setRecord({ ...physicalData, type: 'PHYSICAL' });
        setCooldown(0);
        return;
      }

      const { data: noPlateData, error: noPlateError } = await supabase
        .from('no_plates')
        .select('id, plate_number, mv_file, status')
        .or(`plate_number.ilike.${cleanInput},mv_file.ilike.${cleanInput}`)
        .maybeSingle();

      if (noPlateError) throw noPlateError;

      if (noPlateData) {
        setRecord({ ...noPlateData, type: 'NO_PLATE' });
        setCooldown(0);
      } else {
        setError("RECORD NOT FOUND");
        setCooldown(3); 
      }
    } catch (err) {
      console.error(err);
      setError("SYSTEM ERROR: PLEASE TRY AGAIN");
      setCooldown(5);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setRecord(null);
    setPlate('');
    setError(null);
  };

  const handleGoToAuthorization = () => {
    if (!record || !record.id) {
        setError("DATA ERROR: MISSING RECORD ID");
        return;
    }

    const payload = {
      id: record.id,
      plate: record.plate_number || record.mv_file || 'PENDING'
    };
    
    const token = encryptData(payload);
    navigate(`/?showAuth=true&token=${token}`);
  };

  const renderStatusDescription = () => {
    const s = Number(record.status);
    const officeName = record.offices?.name || 'the LTO Office';
    const dealerName = record.dealer || 'your dealer';

    if (s === 2) {
      return (
        <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1rem', lineHeight: 1.6 }}>
          THIS PLATE HAS BEEN RELEASED TO THE OWNER.
        </Typography>
      );
    }

    if (s === 1) {
      return (
        <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1rem', lineHeight: 1.6 }}>
          AVAILABLE FOR PICK-UP. Please visit <span style={{ color: '#3b82f6', fontWeight: 900 }}>{officeName.toUpperCase()}</span> and present your original CR/OR to claim your physical plate.
        </Typography>
      );
    }

    return (
      <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1rem', lineHeight: 1.6 }}>
        RELEASED TO DEALER. Please coordinate directly with <span style={{ color: '#3b82f6', fontWeight: 900 }}>{dealerName.toUpperCase()}</span> to schedule the release of your physical plate.
      </Typography>
    );
  };

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', p: 2 }}>
      {!record ? (
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
            <input type="text" style={{ display: 'none' }} value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex="-1" />
            
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
              {loading ? <CircularProgress size={20} color="inherit" /> : cooldown > 0 ? `LOCKED: ${cooldown}S` : "SEARCH"}
            </Button>

            {error && <Typography sx={{ color: '#f87171', fontSize: '0.65rem', fontWeight: 800, textAlign: 'center', mt: 2 }}>{error}</Typography>}
          </Paper>
        </Zoom>
      ) : (
        <Fade in={true}>
          <Paper
            ref={resultRef}
            sx={{
              width: '100%', maxWidth: 550, p: { xs: 3, md: 5 }, borderRadius: 6,
              bgcolor: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(30px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 40px 80px -20px rgba(0,0,0,0.8)',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
              <Button
                onClick={() => {
                   // FORCED REFRESH LOGIC
                   window.location.href = '/';
                }}
                startIcon={<ArrowBackIcon />}
                sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', fontWeight: 900 }}
              >
                BACK TO SEARCH
              </Button>

              <Box sx={{ 
                display: 'flex', alignItems: 'center', gap: 1, 
                bgcolor: alpha(record.type === 'NO_PLATE' && Number(record.status) === 1 ? '#3b82f6' : Number(record.status) === 2 ? '#4ade80' : '#3b82f6', 0.1), 
                px: 1.5, py: 0.5, borderRadius: 1 
              }}>
                {Number(record.status) === 2 ? <CheckCircleIcon sx={{ color: '#4ade80', fontSize: '0.8rem' }} /> : <VerifiedIcon sx={{ color: '#3b82f6', fontSize: '0.8rem' }} />}
                <Typography sx={{ color: Number(record.status) === 2 ? '#4ade80' : '#3b82f6', fontWeight: 900, fontSize: '0.6rem' }}>
                  {record.type === 'NO_PLATE' && Number(record.status) === 1 ? 'PENDING VERIFICATION' : Number(record.status) === 2 ? 'RECORD FINALIZED' : 'OFFICIAL SYSTEM RECORD'}
                </Typography>
              </Box>
            </Box>

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
                    {record.plate_number || record.mv_file || "NO PLATE"}
                  </Typography>
                </Box>
                <Box sx={{ borderTop: '1px solid #f1f5f9', py: 1, textAlign: 'center', bgcolor: '#f8fafc' }}>
                  <Typography sx={{ color: '#64748b', fontSize: '0.65rem', fontWeight: 900, fontStyle: 'italic' }}>REGION V - BICOL</Typography>
                </Box>
              </Box>
            </Box>

            <Divider sx={{ mb: 4, borderColor: 'rgba(255,255,255,0.1)' }} />

            <Box sx={{ 
              p: 3, borderRadius: 3, 
              bgcolor: 'rgba(255, 255, 255, 0.02)',
              border: '2px solid', 
              borderColor: record.type === 'NO_PLATE' && Number(record.status) === 1 ? '#3b82f6' : Number(record.status) === 2 ? '#4ade80' : 'rgba(255, 255, 255, 0.1)'
            }}>
              
              <Box sx={{ textAlign: 'left' }}>
                <Typography sx={{ 
                  color: record.type === 'NO_PLATE' && Number(record.status) === 1 ? '#3b82f6' : Number(record.status) === 2 ? '#4ade80' : 'white', 
                  fontWeight: 900, fontSize: '0.7rem', letterSpacing: '0.15em', mb: 1.5, textTransform: 'uppercase',
                  display: 'flex', alignItems: 'center',
                  '&::after': { content: '""', flex: 1, height: '1px', bgcolor: 'rgba(255,255,255,0.1)', ml: 2 }
                }}>
                  STATUS: {
                    record.type === 'NO_PLATE' 
                    ? (Number(record.status) === 2 ? 'AUTHORIZATION ISSUED' : Number(record.status) === 1 ? 'UNDER VERIFICATION' : 'PENDING REQUEST')
                    : (Number(record.status) === 2 ? 'CLAIMED' : Number(record.status) === 1 ? 'FOR PICKUP' : 'RELEASED TO DEALER')
                  }
                </Typography>
                
                {record.type === 'PHYSICAL' ? (
                  renderStatusDescription()
                ) : (
                  <Box>
                    {Number(record.status) === 2 ? (
                      <Box sx={{ textAlign: 'center', py: 2 }}>
                        <MarkEmailReadIcon sx={{ color: '#4ade80', fontSize: '3rem', mb: 2 }} />
                        <Typography sx={{ color: 'white', fontWeight: 800, mb: 1 }}>
                          AUTHORIZATION SENT
                        </Typography>
                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.95rem', lineHeight: 1.6, mb: 2 }}>
                          The official <strong>Authorization to use Improvised Plates</strong> has been verified and sent to your registered email address. Please check your inbox or spam folder.
                        </Typography>
                        <Box sx={{ p: 2, bgcolor: 'rgba(245, 158, 11, 0.1)', borderRadius: 2, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                          <Typography sx={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: 800 }}>
                            NOTE: YOUR PHYSICAL PLATE IS NOT YET AVAILABLE.
                          </Typography>
                        </Box>
                      </Box>
                    ) : Number(record.status) === 1 ? (
                      <Box sx={{ textAlign: 'center', py: 2 }}>
                        <HourglassEmptyIcon sx={{ color: '#3b82f6', fontSize: '3rem', mb: 2 }} />
                        <Typography sx={{ color: 'white', fontWeight: 800, mb: 1 }}>
                          REQUEST UNDER REVIEW
                        </Typography>
                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                          Our team is currently verifying your submitted details. Once approved, the official authorization to use improvised plates will be emailed to your registered address.
                        </Typography>
                      </Box>
                    ) : (
                      <>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <WarningAmberIcon sx={{ color: '#f59e0b', fontSize: '1.2rem' }} />
                          <Typography sx={{ color: '#f59e0b', fontWeight: 900, fontSize: '0.9rem' }}>
                            NO PHYSICAL PLATE YET
                          </Typography>
                        </Box>
                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.95rem', lineHeight: 1.6, mb: 2 }}>
                          This is due to the current shortage or ongoing production of physical plates. You may request temporary authorization below.
                        </Typography>

                        <Box sx={{ mt: 3 }}>
                          <Button 
                            variant="contained" 
                            fullWidth 
                            size="large" 
                            onClick={handleGoToAuthorization}
                            sx={{ 
                              fontWeight: 900, 
                              bgcolor: '#22c55e', 
                              color: '#020617', 
                              py: 1.5,
                              '&:hover': { bgcolor: '#4ade80' }
                            }}
                          >
                            GET AUTHORIZATION TO USE IMPROVISED PLATE
                          </Button>
                        </Box>
                      </>
                    )}
                  </Box>
                )}
              </Box>
            </Box>
          </Paper>
        </Fade>
      )}
    </Box>
  );
}