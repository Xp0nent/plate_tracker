import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Box, Typography, Button, Modal, Stack, IconButton, 
  LinearProgress, Paper, MenuItem, TextField, Fade, Grid, Alert, CircularProgress 
} from '@mui/material';
import { 
  CloudUpload, Close, Refresh, CheckCircle, 
  Storage, WarningAmber, FileDownload, Assessment, Speed
} from '@mui/icons-material';
import { supabase } from '../lib/supabase'; 
import Papa from 'papaparse';

const COLORS = {
  bg: '#020617', paper: '#0f172a', border: '#1e293b',
  accent: '#3b82f6', textSecondary: '#94a3b8',
  danger: '#f87171', success: '#4ade80', warning: '#f59e0b',
  cardBg: '#111827'
};

const MODAL_STYLE = {
  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  width: { xs: '95%', sm: 650 }, maxHeight: '95vh',
  bgcolor: COLORS.paper, border: `1px solid ${COLORS.border}`, 
  p: 4, borderRadius: 4, color: 'white', outline: 'none',
  boxShadow: '0 25px 50px rgba(0,0,0,0.5)', overflowY: 'auto'
};

export default function PlateUploadModal({ open, onClose, onComplete }) {
  const [offices, setOffices] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dbError, setDbError] = useState(null);
  const [uploadOfficeId, setUploadOfficeId] = useState('');
  const [targetStatus, setTargetStatus] = useState(1); 
  const [selectedFile, setSelectedFile] = useState(null);

  const [stats, setStats] = useState({ totalRaw: 0, csvDups: 0, cloudDups: 0, saved: 0 });
  const [rejectionData, setRejectionData] = useState([]); 
  
  const csvDataRef = useRef([]);
  const userRole = Number(sessionStorage.getItem('role'));
  const userBranchId = sessionStorage.getItem('branch_office');

  const fetchOffices = useCallback(async () => {
    const { data } = await supabase.from('offices').select('id, name').order('name');
    if (data) setOffices(data);
  }, []);

  useEffect(() => { if (open) fetchOffices(); }, [open, fetchOffices]);

  useEffect(() => {
    if (!open || !offices.length) return;
    if (userRole !== 1) setUploadOfficeId(userBranchId);
    else {
      const found = offices.find(o => String(o.id) === String(userBranchId));
      setUploadOfficeId(found ? String(found.id) : String(offices[0].id));
    }
  }, [open, offices, userRole, userBranchId]);

  const resetState = () => {
    if (isProcessing) return;
    setIsProcessing(false); setProgress(0); setDbError(null); setIsParsing(false);
    setSelectedFile(null); csvDataRef.current = []; setRejectionData([]);
    setStats({ totalRaw: 0, csvDups: 0, cloudDups: 0, saved: 0 });
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setIsParsing(true);
    const tempRejections = [];

    // Use Web Worker for massive 500k files
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      worker: true, 
      complete: ({ data }) => {
        const unique = new Map();
        const seenMV = new Set();
        const seenPlate = new Set();
        let internalDups = 0;

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const p = row.plate_number?.trim()?.toUpperCase();
          const m = row.mv_file?.trim()?.toUpperCase();
          if (!p || !m) continue;

          if (seenPlate.has(p) || seenMV.has(m)) {
            internalDups++;
            if (internalDups < 10000) { // Cap internal memory for logs
                tempRejections.push(`[FILE REPEAT] Plate: ${p} | MV: ${m}`);
            }
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
    if (!uploadOfficeId) { setDbError('Select an office'); return; }
    setIsProcessing(true); setProgress(0); setDbError(null);

    try {
      // 2000 per batch is optimal for 500k records
      const batchSize = 2000;
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
        
        if (result.skipped_records) {
          cloudDupCount += result.skipped_records.length;
          // Only log first 50k errors to prevent browser memory bloat
          if (rejectionData.length + cloudRejections.length < 50000) {
              result.skipped_records.forEach(r => {
                cloudRejections.push(`[DATABASE DUPLICATE] Plate: ${r.p} | MV: ${r.m}`);
              });
          }
        }

        setStats(s => ({ ...s, saved: savedCount, cloudDups: cloudDupCount }));
        setProgress((Math.min(i + batchSize, dataToSync.length) / dataToSync.length) * 100);
      }

      setRejectionData(prev => [...prev, ...cloudRejections]);
      setIsProcessing(false);
      onComplete?.();
    } catch (err) {
      setDbError(`Engine Interrupted: ${err.message}`);
      setIsProcessing(false);
    }
  };

  const downloadErrorReport = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    const header = `REJECTION REPORT\nTotal in File: ${stats.totalRaw}\nSaved: ${stats.saved}\nDuplicates: ${stats.csvDups + stats.cloudDups}\n\n--- LOGS ---\n\n`;
    const blob = new Blob([header + rejectionData.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rejects_${timestamp}.txt`;
    link.click();
  };

  const SummaryCard = ({ title, count, color, icon: Icon }) => (
    <Paper sx={{ p: 2.5, flex: 1, bgcolor: COLORS.cardBg, border: `1px solid ${COLORS.border}`, borderRadius: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Icon sx={{ color, fontSize: 24 }} />
        <Box>
          <Typography variant="caption" color={COLORS.textSecondary} fontWeight={800}>{title}</Typography>
          <Typography variant="h5" fontWeight={900}>{count.toLocaleString()}</Typography>
        </Box>
      </Stack>
    </Paper>
  );

  return (
    <Modal open={open} onClose={isProcessing ? undefined : onClose}>
      <Fade in={open}>
        <Box sx={MODAL_STYLE}>
          <Stack direction="row" justifyContent="space-between" mb={4}>
            <Box>
                <Typography variant="h5" fontWeight={900}>J.C.D CSV UPLOADER</Typography>
                <Typography variant="caption" color={COLORS.accent} fontWeight={800}>PLATE UPLOAD</Typography>
            </Box>
            {!isProcessing && <IconButton onClick={onClose} sx={{ color: 'white' }}><Close /></IconButton>}
          </Stack>

          {dbError && <Alert severity="error" sx={{ mb: 3 }}>{dbError}</Alert>}

          {isParsing ? (
             <Stack alignItems="center" spacing={2} py={8}>
                <CircularProgress color="primary" />
                <Typography variant="h6" fontWeight={800}>ANALYZING LARGE DATASET...</Typography>
                <Typography variant="body2" color={COLORS.textSecondary}>This may take a moment for 500k records</Typography>
             </Stack>
          ) : !isProcessing && progress < 100 ? (
            <Stack spacing={3}>
              <Grid container spacing={2}>
                <Grid item xs={6}><TextField select label="BRANCH" fullWidth disabled={userRole !== 1} value={uploadOfficeId} onChange={(e) => setUploadOfficeId(e.target.value)} variant="filled" sx={{ bgcolor: COLORS.bg, borderRadius: 2, '& .MuiInputBase-root': { color: 'white' } }}>{offices.map((off) => (<MenuItem key={off.id} value={String(off.id)}>{off.name}</MenuItem>))}</TextField></Grid>
                <Grid item xs={6}><TextField select label="STATUS" fullWidth value={targetStatus} onChange={(e) => setTargetStatus(e.target.value)} variant="filled" sx={{ bgcolor: COLORS.bg, borderRadius: 2, '& .MuiInputBase-root': { color: 'white' } }}><MenuItem value={1}>FOR PICKUP</MenuItem><MenuItem value={0}>RELEASED TO DEALERS</MenuItem></TextField></Grid>
              </Grid>

              {!selectedFile ? (
                <Box sx={{ p: 8, border: `2px dashed ${COLORS.border}`, textAlign: 'center', cursor: 'pointer', borderRadius: 4 }} component="label">
                  <CloudUpload sx={{ fontSize: 48, color: COLORS.accent, mb: 2 }} />
                  <Typography variant="h6" fontWeight={800}>SELECT SOURCE CSV</Typography>
                  <input type="file" accept=".csv" hidden onChange={handleFileSelect} />
                </Box>
              ) : (
                <Stack spacing={3}>
                  <SummaryCard title="VALID ENTRIES DETECTED" count={csvDataRef.current.length} color={COLORS.accent} icon={Speed} />
                  <Button variant="contained" fullWidth onClick={startSync} sx={{ py: 2, fontWeight: 900 }}>INITIALIZE 500K SYNC</Button>
                </Stack>
              )}
            </Stack>
          ) : (
            <Stack spacing={4}>
              <Box>
                <Typography variant="h4" fontWeight={900}>{Math.round(progress)}%</Typography>
                <LinearProgress variant="determinate" value={progress} sx={{ height: 12, borderRadius: 6 }} />
              </Box>

              <Stack direction="row" spacing={2}>
                <SummaryCard title="SAVED TO DATABASE" count={stats.saved} color={COLORS.success} icon={CheckCircle} />
                <SummaryCard title="DUPLICATE RECORDS" count={stats.csvDups + stats.cloudDups} color={COLORS.warning} icon={WarningAmber} />
              </Stack>

              {progress === 100 && (
                <Stack spacing={2}>
                  {(stats.csvDups + stats.cloudDups) > 0 && (
                    <Button variant="outlined" startIcon={<FileDownload />} fullWidth onClick={downloadErrorReport} sx={{ color: COLORS.warning, borderColor: COLORS.warning, fontWeight: 800 }}>
                      DOWNLOAD ERROR LOG (.TXT)
                    </Button>
                  )}
                  <Button variant="contained" fullWidth onClick={onClose} sx={{ py: 2, fontWeight: 900 }}>FINISH SESSION</Button>
                </Stack>
              )}
            </Stack>
          )}
        </Box>
      </Fade>
    </Modal>
  );
}