import { useState, useRef, useEffect } from 'react';
import { 
  Box, Typography, Button, Modal, Stack, IconButton, 
  LinearProgress, Paper, MenuItem, TextField, Fade, Divider, Grid
} from '@mui/material';
import { 
  CloudUpload, CheckCircle, Close, FilePresent, 
  Refresh, FileDownload, Speed, ErrorOutline
} from '@mui/icons-material';
import { supabase } from '../lib/supabase'; 
import Papa from 'papaparse';

const COLORS = {
  bg: '#020617', paper: '#0f172a', border: '#1e293b',
  accent: '#3b82f6', textSecondary: '#94a3b8',
  danger: '#f87171', warning: '#f59e0b', success: '#4ade80',
};

const MODAL_STYLE = {
  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  width: { xs: '95%', sm: 600 }, bgcolor: COLORS.paper, border: `1px solid ${COLORS.border}`, 
  boxShadow: '0 24px 48px rgba(0,0,0,0.6)', p: 4, borderRadius: 4, color: 'white', outline: 'none'
};

const BATCH_SIZE = 1000; 
const STATUS_OPTIONS = ['AVAILABLE TO PICK UP AT LTO OFFICE', 'RELEASED TO DEALER'];

export default function PlateUploadModal({ open, onClose, offices = [], userRole, userBranchId, onComplete }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ totalRows: 0, inserted: 0, skipped: 0 });
  const [errorLog, setErrorLog] = useState([]); 
  const [uploadOfficeId, setUploadOfficeId] = useState(userBranchId || '');
  const [batchStatus, setBatchStatus] = useState(STATUS_OPTIONS[0]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState({ name: '', rows: 0 });
  const [dbError, setDbError] = useState(null);

  const processedPlatesRef = useRef(new Set());
  const processedMVRef = useRef(new Set());

  useEffect(() => {
    if (userBranchId && open) setUploadOfficeId(userBranchId);
  }, [userBranchId, open]);

  const resetState = () => {
    setIsProcessing(false);
    setProgress(0);
    setStats({ totalRows: 0, inserted: 0, skipped: 0 });
    setSelectedFile(null);
    setErrorLog([]);
    processedPlatesRef.current = new Set();
    processedMVRef.current = new Set();
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (results) => setFilePreview({ name: file.name, rows: results.data.length })
    });
  };

  const downloadAuditLog = () => {
    const reportHeader = `PLATE NUMBER    | MV FILE NUMBER  | REJECTION REASON\n` + 
                         `------------------------------------------------------------\n`;

    const blob = new Blob([reportHeader + errorLog.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Audit_Report_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
  };

  const uploadBatch = async (batch) => {
    try {
      const perRowErrors = [];
      const cleanBatch = [];

      // 1. Local Duplicate Check (Prevention of internal file conflicts)
      batch.forEach(item => {
        const p = String(item.plate_number).trim().toUpperCase();
        const m = String(item.mv_file).trim().toUpperCase();

        if (processedPlatesRef.current.has(p)) {
          perRowErrors.push(`${p.padEnd(15)} | ${m.padEnd(15)} | FILE DUP (PLATE)`);
        } else if (processedMVRef.current.has(m)) {
          perRowErrors.push(`${p.padEnd(15)} | ${m.padEnd(15)} | FILE DUP (MV FILE)`);
        } else {
          processedPlatesRef.current.add(p);
          processedMVRef.current.add(m);
          cleanBatch.push(item);
        }
      });

      if (cleanBatch.length === 0) {
        setErrorLog(prev => [...prev, ...perRowErrors]);
        return { inserted: 0, skipped: batch.length };
      }

      // 2. Database Sync via RPC
      const { data: savedResults, error } = await supabase.rpc('sync_plates_optimized', { 
        items: cleanBatch 
      });
      
      if (error) throw error;

      // 3. Identify exactly which rows were rejected by DB constraints
      const savedPlates = new Set(savedResults.map(d => d.inserted_plate));
      
      cleanBatch.forEach(item => {
        if (!savedPlates.has(item.plate_number)) {
          perRowErrors.push(`${item.plate_number.padEnd(15)} | ${item.mv_file.padEnd(15)} | DB DUP (ALREADY EXISTS)`);
        }
      });

      setErrorLog(prev => [...prev, ...perRowErrors]);
      return { inserted: savedPlates.size, skipped: batch.length - savedPlates.size };
    } catch (err) {
      setDbError(err.message);
      return { inserted: 0, skipped: batch.length };
    }
  };

  const startSync = async () => {
    if (!selectedFile || !uploadOfficeId) return;
    setIsProcessing(true);
    setDbError(null);
    setErrorLog([]);
    processedPlatesRef.current = new Set();
    processedMVRef.current = new Set();

    let localIns = 0;
    let localSkp = 0;
    let batchCounter = 0;
    let currentBatch = [];
    const totalLines = filePreview.rows;
    const finalOfficeId = userRole === 1 ? uploadOfficeId : Number(userBranchId);

    Papa.parse(selectedFile, {
      header: true, skipEmptyLines: true,
      step: async (results, parser) => {
        const row = results.data;
        if (row.plate_number && row.mv_file) {
          currentBatch.push({
            plate_number: String(row.plate_number).trim().toUpperCase(),
            mv_file: String(row.mv_file).trim().toUpperCase(),
            dealer: String(row.dealer || 'N/A').trim(),
            office_id: finalOfficeId,
            status: batchStatus
          });
        }

        if (currentBatch.length >= BATCH_SIZE) {
          parser.pause();
          batchCounter++;
          const res = await uploadBatch(currentBatch);
          localIns += res.inserted; localSkp += res.skipped;
          setStats({ totalRows: totalLines, inserted: localIns, skipped: localSkp });
          setProgress((batchCounter / Math.ceil(totalLines / BATCH_SIZE)) * 100);
          currentBatch = [];
          parser.resume();
        }
      },
      complete: async () => {
        if (currentBatch.length > 0) {
          const res = await uploadBatch(currentBatch);
          localIns += res.inserted; localSkp += res.skipped;
        }
        setStats({ totalRows: totalLines, inserted: localIns, skipped: localSkp });
        setProgress(100); setIsProcessing(false);
        if (onComplete) onComplete();
      }
    });
  };

  return (
    <Modal open={open} onClose={isProcessing ? null : () => { resetState(); onClose(); }}>
      <Fade in={open}>
        <Box sx={MODAL_STYLE}>
          <Typography variant="overline" color={COLORS.accent} fontWeight={900}>RECONCILIATION ENGINE</Typography>
          <Typography variant="h5" fontWeight={900} mb={3}>UPLOAD PLATES</Typography>
          
          {dbError ? (
            <Paper sx={{ p: 4, bgcolor: 'rgba(248, 113, 113, 0.05)', border: `1px solid ${COLORS.danger}`, textAlign: 'center' }}>
                <ErrorOutline sx={{ color: COLORS.danger, fontSize: 48, mb: 2 }} />
                <Typography variant="h6" color={COLORS.danger}>SYNC ERROR</Typography>
                <Typography variant="body2" color={COLORS.textSecondary} mb={3}>{dbError}</Typography>
                <Button variant="contained" color="error" fullWidth onClick={resetState}>RETRY</Button>
            </Paper>
          ) : (
            <>
              {!isProcessing && progress === 0 && (
                <Stack spacing={3}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <TextField select label="TARGET OFFICE" fullWidth value={uploadOfficeId} onChange={(e) => setUploadOfficeId(e.target.value)} disabled={userRole !== 1} sx={{ '& .MuiOutlinedInput-root': { color: 'white', '& fieldset': { borderColor: COLORS.border } } }}>
                        {offices.map((o) => <MenuItem key={o.id} value={o.id}>{o.name.toUpperCase()}</MenuItem>)}
                      </TextField>
                    </Grid>
                    <Grid item xs={6}>
                      <TextField select label="STATUS" fullWidth value={batchStatus} onChange={(e) => setBatchStatus(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { color: 'white', '& fieldset': { borderColor: COLORS.border } } }}>
                        {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                      </TextField>
                    </Grid>
                  </Grid>

                  {!selectedFile ? (
                    <Box sx={{ p: 6, borderRadius: 3, border: `2px dashed ${COLORS.border}`, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.02)', cursor: 'pointer' }} component="label">
                        <CloudUpload sx={{ fontSize: 60, color: COLORS.accent, mb: 2 }} />
                        <Typography variant="body1" fontWeight={700}>Select Plate CSV File</Typography>
                        <input type="file" accept=".csv" hidden onChange={handleFileSelect} />
                    </Box>
                  ) : (
                    <Paper sx={{ p: 3, bgcolor: COLORS.bg, border: `1px solid ${COLORS.accent}` }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <FilePresent sx={{ color: COLORS.accent, fontSize: 40 }} />
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="subtitle1" fontWeight={800}>{filePreview.name}</Typography>
                                <Typography variant="caption" color={COLORS.textSecondary}>{filePreview.rows.toLocaleString()} Rows Detected</Typography>
                            </Box>
                            <IconButton onClick={() => setSelectedFile(null)} sx={{ color: COLORS.danger }}><Refresh /></IconButton>
                        </Stack>
                        <Button variant="contained" fullWidth size="large" onClick={startSync} sx={{ mt: 4, py: 2, fontWeight: 900, bgcolor: COLORS.accent }}>START SYNC</Button>
                    </Paper>
                  )}
                </Stack>
              )}

              {isProcessing && (
                <Box py={2}>
                  <Stack direction="row" justifyContent="space-between" mb={1.5}>
                     <Typography variant="body2" fontWeight={800} color={COLORS.accent}><Speed sx={{ fontSize: 18, mr: 1 }} /> PROCESSING...</Typography>
                     <Typography variant="h4" fontWeight={900}>{Math.round(progress)}%</Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={progress} sx={{ height: 12, borderRadius: 6, mb: 4, bgcolor: COLORS.border, '& .MuiLinearProgress-bar': { bgcolor: COLORS.accent } }} />
                  <Grid container spacing={2}>
                    <StatBox label="SUCCESS" value={stats.inserted.toLocaleString()} color={COLORS.success} />
                    <StatBox label="SKIPPED" value={stats.skipped.toLocaleString()} color={COLORS.warning} />
                  </Grid>
                </Box>
              )}

              {progress === 100 && !isProcessing && (
                <Box py={1}>
                  <Box textAlign="center" mb={4}>
                    <CheckCircle sx={{ fontSize: 70, color: COLORS.success, mb: 1 }} />
                    <Typography variant="h5" fontWeight={900}>UPLOAD FINISHED</Typography>
                  </Box>
                  <Grid container spacing={2} mb={3}>
                    <ResultCard label="SYNCED" value={stats.inserted} color={COLORS.success} />
                    <ResultCard label="SKIPPED" value={stats.skipped} color={COLORS.warning} />
                  </Grid>
                  <Stack direction="row" spacing={2}>
                    <Button variant="outlined" fullWidth startIcon={<FileDownload />} onClick={downloadAuditLog} sx={{ color: 'white', borderColor: COLORS.border, fontWeight: 800 }}>AUDIT REPORT</Button>
                    <Button variant="contained" fullWidth onClick={() => { resetState(); onClose(); }} sx={{ fontWeight: 900, bgcolor: COLORS.accent }}>CLOSE</Button>
                  </Stack>
                </Box>
              )}
            </>
          )}
        </Box>
      </Fade>
    </Modal>
  );
}

function StatBox({ label, value, color }) {
    return (
        <Grid item xs={6}>
            <Paper sx={{ p: 2, bgcolor: COLORS.bg, border: `1px solid ${COLORS.border}`, textAlign: 'center' }}>
                <Typography variant="caption" color={COLORS.textSecondary} fontWeight={700}>{label}</Typography>
                <Typography variant="body1" fontWeight={800} sx={{ color }}>{value}</Typography>
            </Paper>
        </Grid>
    );
}

function ResultCard({ label, value, color }) {
    return (
        <Grid item xs={6}>
            <Paper sx={{ p: 2.5, bgcolor: 'rgba(255,255,255,0.02)', border: `1px solid ${color}` }}>
                <Typography variant="caption" fontWeight={900} color={color}>{label}</Typography>
                <Typography variant="h4" fontWeight={900}>{value.toLocaleString()}</Typography>
            </Paper>
        </Grid>
    );
}
