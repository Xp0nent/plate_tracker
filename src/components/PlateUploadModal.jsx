import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Box, Typography, Button, Modal, Stack, IconButton, 
  LinearProgress, Paper, MenuItem, TextField, Fade, Alert, 
  CircularProgress
} from '@mui/material';
import Grid from '@mui/material/Grid'; 
import { 
  CloudUpload, Close, CheckCircle, 
  History, WarningAmber, FileDownload, Assessment,
  GppGood, FactCheck
} from '@mui/icons-material';
import { supabase } from '../lib/supabase'; 
import Papa from 'papaparse';

const COLORS = {
  bg: '#020617',
  paper: '#0f172a',
  border: '#1e293b',
  accent: '#3b82f6',
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

export default function PlateUploadModal({ open, onClose, onComplete }) {
  const [offices, setOffices] = useState([]);
  const [isLoadingOffices, setIsLoadingOffices] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dbError, setDbError] = useState(null);
  
  // Pull from session immediately
  const sessionOfficeId = sessionStorage.getItem('branch_office');
  const userRole = Number(sessionStorage.getItem('role'));

  const [uploadOfficeId, setUploadOfficeId] = useState('');
  const [targetStatus, setTargetStatus] = useState(1); 
  const [selectedFile, setSelectedFile] = useState(null);

  const [stats, setStats] = useState({ totalRaw: 0, csvDups: 0, cloudDups: 0, saved: 0 });
  const [rejectionData, setRejectionData] = useState([]); 
  const csvDataRef = useRef([]);

  const fetchOffices = useCallback(async () => {
    setIsLoadingOffices(true);
    const { data } = await supabase.from('offices').select('id, name').order('name');
    if (data) {
      setOffices(data);
      // If we have a session office, set it. Otherwise use first available.
      if (sessionOfficeId) {
        setUploadOfficeId(sessionOfficeId);
      } else if (data.length > 0) {
        setUploadOfficeId(data[0].id);
      }
    }
    setIsLoadingOffices(false);
  }, [sessionOfficeId]);

  useEffect(() => { 
    if (open) {
      fetchOffices();
    } else {
      setSelectedFile(null);
      setDbError(null);
      setProgress(0);
      setStats({ totalRaw: 0, csvDups: 0, cloudDups: 0, saved: 0 });
    }
  }, [open, fetchOffices]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setIsParsing(true);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      worker: true, 
      complete: ({ data }) => {
        const unique = new Map();
        const seenMV = new Set();
        const seenPlate = new Set();
        let internalDups = 0;
        const tempRejections = [];

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const p = row.plate_number?.trim()?.toUpperCase();
          const m = row.mv_file?.trim()?.toUpperCase();
          if (!p || !m) continue;

          if (seenPlate.has(p) || seenMV.has(m)) {
            internalDups++;
            if (internalDups < 1000) tempRejections.push(`[FILE REPEAT] Plate: ${p} | MV: ${m}`);
            continue;
          }
          unique.set(p, { plate_number: p, mv_file: m, dealer: row.dealer || 'N/A' });
          seenMV.add(m); seenPlate.add(p);
        }

        csvDataRef.current = [...unique.values()];
        setStats({ totalRaw: data.length, csvDups: internalDups, cloudDups: 0, saved: 0 });
        setRejectionData(tempRejections);
        setIsParsing(false);
      }
    });
  };

  const startSync = async () => {
    setIsProcessing(true); setProgress(0); setDbError(null);
    try {
      const batchSize = 2500;
      const dataToSync = csvDataRef.current;
      let savedCount = 0;
      let cloudDupCount = 0;
      const cloudRejections = [];

      for (let i = 0; i < dataToSync.length; i += batchSize) {
        const chunk = dataToSync.slice(i, i + batchSize).map(r => ({
          ...r, office_id: Number(uploadOfficeId), status: Number(targetStatus)
        }));

        const { data, error } = await supabase.rpc('sync_plates_v9', { items: chunk });
        if (error) throw new Error(error.message);

        const result = data[0];
        savedCount += result.inserted_count;
        cloudDupCount += (result.skipped_records?.length || 0);

        if (result.skipped_records && rejectionData.length < 5000) {
          result.skipped_records.forEach(r => cloudRejections.push(`[DB CONFLICT] Plate: ${r.p} | MV: ${r.m}`));
        }

        setStats(s => ({ ...s, saved: savedCount, cloudDups: cloudDupCount }));
        setProgress((Math.min(i + batchSize, dataToSync.length) / dataToSync.length) * 100);
      }
      setRejectionData(prev => [...prev, ...cloudRejections]);
      setIsProcessing(false);
      onComplete?.();
    } catch (err) {
      setDbError(err.message);
      setIsProcessing(false);
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

  // Use simple lookup for the header name
  const currentOfficeName = offices.find(o => String(o.id) === String(uploadOfficeId))?.name || 'Loading...';

  return (
    <Modal open={open} onClose={isProcessing ? undefined : onClose}>
      <Fade in={open}>
        <Box sx={MODAL_STYLE}>
          {/* Header */}
          <Box sx={{ p: 3, borderBottom: `1px solid ${COLORS.border}`, bgcolor: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <GppGood sx={{ color: COLORS.accent, fontSize: 28 }} />
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 900, lineHeight: 1 }}>LTO DATA COMMAND</Typography>
                <Typography variant="caption" sx={{ color: COLORS.textSecondary }}>Authorized Branch: {currentOfficeName}</Typography>
              </Box>
            </Stack>
            {!isProcessing && <IconButton onClick={onClose} sx={{ color: COLORS.textSecondary }}><Close /></IconButton>}
          </Box>

          <Box sx={{ p: 4 }}>
            {dbError && <Alert severity="error" variant="filled" sx={{ mb: 3, borderRadius: 2 }}>{dbError}</Alert>}

            {isLoadingOffices || isParsing ? (
              <Stack alignItems="center" spacing={3} py={6}>
                <CircularProgress size={50} thickness={4} sx={{ color: COLORS.accent }} />
                <Typography variant="body1" sx={{ fontWeight: 700, color: COLORS.textSecondary }}>INITIALIZING ENGINE...</Typography>
              </Stack>
            ) : !isProcessing && progress < 100 ? (
              <Stack spacing={4}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={7}>
                    {/* The Select Component */}
                    <TextField 
                      select 
                      fullWidth 
                      label="TARGET BRANCH" 
                      // Crucial: Convert to string to ensure MenuItem value match
                      value={String(uploadOfficeId)} 
                      disabled={userRole !== 1} 
                      onChange={(e) => setUploadOfficeId(e.target.value)}
                      variant="outlined"
                      // SelectProps ensures the underlying Select works correctly with MUI
                      SelectProps={{ displayEmpty: true }}
                    >
                      {offices.map((off) => (
                        <MenuItem key={off.id} value={String(off.id)}>
                          {off.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={5}>
                    <TextField 
                      select 
                      fullWidth 
                      label="INITIAL STATUS" 
                      value={targetStatus} 
                      onChange={(e) => setTargetStatus(e.target.value)}
                      variant="outlined"
                    >
                      <MenuItem value={1}>FOR PICKUP</MenuItem>
                      <MenuItem value={0}>RELEASED</MenuItem>
                    </TextField>
                  </Grid>
                </Grid>

                {!selectedFile ? (
                  <Button component="label" fullWidth sx={{ py: 10, border: `2px dashed ${COLORS.border}`, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.01)', transition: 'all 0.2s', '&:hover': { borderColor: COLORS.accent, bgcolor: 'rgba(59, 130, 246, 0.04)' } }}>
                    <Stack alignItems="center" spacing={1}>
                      <CloudUpload sx={{ fontSize: 48, color: COLORS.accent, mb: 1 }} />
                      <Typography variant="h6" sx={{ fontWeight: 800, color: 'white' }}>SOURCE SELECTION</Typography>
                      <Typography variant="caption" sx={{ color: COLORS.textSecondary }}>Targeting {currentOfficeName}</Typography>
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
                            <Typography variant="body2" sx={{ color: COLORS.textSecondary, fontWeight: 700 }}>VALIDATED DATA</Typography>
                            <Typography variant="h5" sx={{ fontWeight: 900 }}>{csvDataRef.current.length.toLocaleString()} RECORDS</Typography>
                          </Box>
                        </Stack>
                        <Button size="small" onClick={() => setSelectedFile(null)} sx={{ color: COLORS.error, fontWeight: 700 }}>Change File</Button>
                      </Stack>
                    </Paper>
                    <Button variant="contained" fullWidth onClick={startSync} sx={{ py: 2, borderRadius: 3, fontWeight: 900, bgcolor: COLORS.accent }}>
                      START ENTERPRISE SYNC
                    </Button>
                  </Stack>
                )}
              </Stack>
            ) : (
              <Stack spacing={4}>
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-end" mb={1.5}>
                    <Typography variant="h3" sx={{ fontWeight: 900, color: COLORS.accent }}>{Math.round(progress)}%</Typography>
                    <Typography variant="caption" sx={{ color: COLORS.textSecondary, fontWeight: 800 }}>
                      {isProcessing ? 'WRITING TO DATABASE...' : 'PROCESS COMPLETE'}
                    </Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={progress} sx={{ height: 12, borderRadius: 6, bgcolor: COLORS.bg }} />
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}><StatCard icon={CheckCircle} label="Success" value={stats.saved} color={COLORS.success} /></Grid>
                  <Grid item xs={6} sm={3}><StatCard icon={WarningAmber} label="DB Conf" value={stats.cloudDups} color={COLORS.error} /></Grid>
                  <Grid item xs={6} sm={3}><StatCard icon={History} label="CSV Dup" value={stats.csvDups} color={COLORS.warning} /></Grid>
                  <Grid item xs={6} sm={3}><StatCard icon={Assessment} label="Total" value={stats.totalRaw} color={COLORS.accent} /></Grid>
                </Grid>

                {progress === 100 && (
                  <Stack direction="row" spacing={2} sx={{ pt: 2 }}>
                    <Button variant="outlined" startIcon={<FileDownload />} fullWidth onClick={() => {
                        const blob = new Blob([rejectionData.join('\n')], { type: 'text/plain' });
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(blob);
                        link.download = `Log_${new Date().getTime()}.txt`;
                        link.click();
                      }} sx={{ borderRadius: 3, color: 'white', borderColor: COLORS.border, fontWeight: 700 }}>
                      ERROR LOG
                    </Button>
                    <Button variant="contained" fullWidth onClick={onClose} sx={{ borderRadius: 3, bgcolor: COLORS.success, fontWeight: 900 }}>
                      DONE
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