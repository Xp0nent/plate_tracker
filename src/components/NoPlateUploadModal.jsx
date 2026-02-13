import { useState, useEffect, useRef } from 'react';
import { 
  Box, Typography, Button, Modal, Stack, IconButton, 
  LinearProgress, Paper, Fade, Alert, CircularProgress, Grid
} from '@mui/material';
import { 
  CloudUpload, Close, CheckCircle, 
  History, WarningAmber, Assessment,
  GppGood, FactCheck, Storage
} from '@mui/icons-material';
import { supabase } from '../lib/supabase'; 
import Papa from 'papaparse';

const COLORS = {
  bg: '#020617',
  paper: '#0f172a',
  border: '#1e293b',
  accent: '#ef4444', 
  cardBg: 'rgba(30, 41, 59, 0.4)',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  textSecondary: '#94a3b8'
};

const MODAL_STYLE = {
  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  width: { xs: '95%', sm: 720 }, maxHeight: '95vh',
  bgcolor: COLORS.paper, border: `1px solid ${COLORS.border}`, 
  p: 0, borderRadius: 4, color: 'white', outline: 'none', overflowY: 'auto',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
};

export default function NoPlateUploadModal({ open, onClose, onComplete }) {
  const [isParsing, setIsParsing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [dbError, setDbError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const [stats, setStats] = useState({ totalRaw: 0, csvDups: 0, cloudDups: 0, saved: 0 });
  const csvDataRef = useRef([]);

  useEffect(() => { 
    if (!open) {
      setSelectedFile(null);
      setDbError(null);
      setIsSuccess(false);
      setIsSyncing(false);
      setStats({ totalRaw: 0, csvDups: 0, cloudDups: 0, saved: 0 });
    }
  }, [open]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setIsParsing(true);
    setDbError(null);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      worker: true, 
      complete: ({ data }) => {
        const unique = new Map();
        const seenMV = new Set();
        let internalDups = 0;

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const m = row.mv_file?.trim()?.toUpperCase();
          const p = row.plate_number?.trim()?.toUpperCase() || 'NO PLATE';
          
          if (!m) continue;

          if (seenMV.has(m)) {
            internalDups++;
            continue;
          }
          
          // ADDED: Status is explicitly set to 0 here
          unique.set(m, { 
            mv_file: m, 
            plate_number: p, 
            status: 0 
          });
          seenMV.add(m);
        }

        csvDataRef.current = [...unique.values()];
        setStats({ totalRaw: data.length, csvDups: internalDups, cloudDups: 0, saved: 0 });
        setIsParsing(false);
      }
    });
  };

  const startSync = async () => {
    setIsSyncing(true);
    setDbError(null);
    try {
      const dataToSync = csvDataRef.current;
      
      const { data, error } = await supabase
        .from('no_plates')
        .upsert(dataToSync, { onConflict: 'mv_file', ignoreDuplicates: true })
        .select();

      if (error) throw error;

      const savedCount = data?.length || 0;
      const cloudDupCount = dataToSync.length - savedCount;

      setStats(s => ({ ...s, saved: savedCount, cloudDups: cloudDupCount }));
      setIsSuccess(true);
      onComplete?.();
    } catch (err) {
      setDbError(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const StatCard = ({ icon: Icon, label, value, color }) => (
    <Paper sx={{ p: 2, bgcolor: COLORS.cardBg, border: `1px solid ${COLORS.border}`, borderRadius: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box sx={{ p: 1, borderRadius: 2, bgcolor: `${color}15`, color }}>
          <Icon fontSize="small" />
        </Box>
        <Box>
          <Typography variant="caption" color={COLORS.textSecondary} sx={{ fontWeight: 600, textTransform: 'uppercase' }}>{label}</Typography>
          <Typography variant="h6" sx={{ fontWeight: 800, color: 'white', lineHeight: 1.2 }}>{value.toLocaleString()}</Typography>
        </Box>
      </Stack>
    </Paper>
  );

  return (
    <Modal open={open} onClose={(isSyncing || isParsing) ? undefined : onClose}>
      <Fade in={open}>
        <Box sx={MODAL_STYLE}>
          <Box sx={{ p: 3, borderBottom: `1px solid ${COLORS.border}`, bgcolor: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <GppGood sx={{ color: COLORS.accent, fontSize: 28 }} />
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 900, lineHeight: 1 }}>REGISTRY SYNC</Typography>
                <Typography variant="caption" sx={{ color: COLORS.textSecondary }}>MV File & Plate Verification</Typography>
              </Box>
            </Stack>
            {(!isSyncing && !isParsing) && <IconButton onClick={onClose} sx={{ color: COLORS.textSecondary }}><Close /></IconButton>}
          </Box>

          <Box sx={{ p: 4 }}>
            {dbError && <Alert severity="error" variant="filled" sx={{ mb: 3, borderRadius: 2 }}>{dbError}</Alert>}

            {isParsing ? (
              <Stack alignItems="center" spacing={3} py={6}>
                <CircularProgress size={50} thickness={4} sx={{ color: COLORS.accent }} />
                <Typography variant="body1" sx={{ fontWeight: 700, color: COLORS.textSecondary }}>READING CSV FILE...</Typography>
              </Stack>
            ) : isSyncing ? (
              <Stack alignItems="center" spacing={3} py={6}>
                <Storage sx={{ fontSize: 50, color: COLORS.accent, animation: 'pulse 1.5s infinite' }} />
                <Typography variant="body1" sx={{ fontWeight: 700, color: COLORS.textSecondary }}>UPLOADING TO SUPABASE...</Typography>
                <LinearProgress sx={{ width: '100%', borderRadius: 5, height: 8, bgcolor: COLORS.border, '& .MuiLinearProgress-bar': { bgcolor: COLORS.accent } }} />
              </Stack>
            ) : isSuccess ? (
              <Stack spacing={4}>
                <Box textAlign="center">
                  <CheckCircle sx={{ color: COLORS.success, fontSize: 64, mb: 2 }} />
                  <Typography variant="h4" sx={{ fontWeight: 900, color: COLORS.success }}>UPLOAD COMPLETE</Typography>
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}><StatCard icon={CheckCircle} label="New" value={stats.saved} color={COLORS.success} /></Grid>
                  <Grid item xs={6} sm={3}><StatCard icon={WarningAmber} label="Existing" value={stats.cloudDups} color={COLORS.error} /></Grid>
                  <Grid item xs={6} sm={3}><StatCard icon={History} label="File Dup" value={stats.csvDups} color={COLORS.warning} /></Grid>
                  <Grid item xs={6} sm={3}><StatCard icon={Assessment} label="Total" value={stats.totalRaw} color={COLORS.accent} /></Grid>
                </Grid>

                <Button variant="contained" fullWidth onClick={onClose} sx={{ py: 2, borderRadius: 3, bgcolor: COLORS.success, fontWeight: 900, '&:hover': { bgcolor: '#059669' } }}>
                  FINISH
                </Button>
              </Stack>
            ) : (
              <Stack spacing={4}>
                {!selectedFile ? (
                  <Button component="label" fullWidth sx={{ py: 10, border: `2px dashed ${COLORS.border}`, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.01)', transition: '0.2s', '&:hover': { borderColor: COLORS.accent, bgcolor: 'rgba(239, 68, 68, 0.02)' } }}>
                    <Stack alignItems="center" spacing={1}>
                      <CloudUpload sx={{ fontSize: 48, color: COLORS.accent, mb: 1 }} />
                      <Typography variant="h6" sx={{ fontWeight: 800, color: 'white' }}>SELECT CSV FILE</Typography>
                      <Typography variant="caption" sx={{ color: COLORS.textSecondary }}>Required Header: "mv_file"</Typography>
                    </Stack>
                    <input type="file" accept=".csv" hidden onChange={handleFileSelect} />
                  </Button>
                ) : (
                  <Stack spacing={3}>
                    <Paper sx={{ p: 3, bgcolor: COLORS.cardBg, border: `1px solid ${COLORS.accent}40`, borderRadius: 3 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={2} alignItems="center">
                          <FactCheck sx={{ color: COLORS.accent }} />
                          <Box>
                            <Typography variant="body2" sx={{ color: COLORS.textSecondary, fontWeight: 700 }}>PREPARED RECORDS</Typography>
                            <Typography variant="h5" sx={{ fontWeight: 900 }}>{csvDataRef.current.length.toLocaleString()} VEHICLES</Typography>
                          </Box>
                        </Stack>
                        <Button size="small" onClick={() => setSelectedFile(null)} sx={{ color: COLORS.error, fontWeight: 700 }}>Change File</Button>
                      </Stack>
                    </Paper>
                    <Button variant="contained" fullWidth onClick={startSync} sx={{ py: 2, borderRadius: 3, fontWeight: 900, bgcolor: COLORS.accent, '&:hover': { bgcolor: '#dc2626' } }}>
                      BEGIN DATABASE SYNC
                    </Button>
                  </Stack>
                )}
              </Stack>
            )}
          </Box>
        </Box>
      </Fade>
    </Modal>
  );
}