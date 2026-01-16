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

// Smaller batch size is better for multi-user concurrency to avoid locking
const BATCH_SIZE = 500; 

export default function PlateUploadModal({ open, onClose, offices = [], userRole, userBranchId, onComplete }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ totalRows: 0, inserted: 0, skipped: 0 });
  const [errorLog, setErrorLog] = useState([]); 
  const [uploadOfficeId, setUploadOfficeId] = useState(userBranchId || '');
  const [batchStatus, setBatchStatus] = useState('AVAILABLE TO PICK UP AT LTO OFFICE');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState({ name: '', rows: 0 });
  const [dbError, setDbError] = useState(null);

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
    setDbError(null);
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
    const reportHeader = `PLATE | MV FILE | REJECTION REASON\n-----------------------------------\n`;
    const blob = new Blob([reportHeader + errorLog.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Audit_${new Date().getTime()}.txt`;
    link.click();
  };

  const uploadBatch = async (batch) => {
    try {
      const perRowErrors = [];
      const cleanBatch = [];

      // 1. FRONT-END DEDUPLICATION
      batch.forEach(item => {
        const m = String(item.mv_file).trim().toUpperCase();
        if (processedMVRef.current.has(m)) {
          perRowErrors.push(`${item.plate_number} | ${m} | DUPLICATE IN YOUR FILE`);
        } else {
          processedMVRef.current.add(m);
          cleanBatch.push(item);
        }
      });

      if (cleanBatch.length === 0) {
        setErrorLog(prev => [...prev, ...perRowErrors]);
        return { inserted: 0, skipped: batch.length };
      }

      // 2. CONCURRENT RPC CALL
      const { data: savedResults, error } = await supabase.rpc('sync_plates_optimized', { 
        items: cleanBatch 
      });

      if (error) throw error;

      // 3. AUDIT MAPPING
      const savedPlates = new Set(savedResults?.map(d => d.inserted_plate) || []);
      cleanBatch.forEach(item => {
        if (!savedPlates.has(item.plate_number)) {
          perRowErrors.push(`${item.plate_number} | ${item.mv_file} | ALREADY IN DB (CONCURRENT UPLOAD)`);
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
    processedMVRef.current = new Set();

    let localIns = 0;
    let localSkp = 0;
    let count = 0;
    const finalOfficeId = Number(uploadOfficeId);

    Papa.parse(selectedFile, {
      header: true, skipEmptyLines: true,
      chunk: async (results, parser) => {
        parser.pause();
        const batchData = results.data.map(row => ({
          plate_number: String(row.plate_number || '').trim(),
          mv_file: String(row.mv_file || '').trim(),
          dealer: String(row.dealer || 'N/A').trim(),
          office_id: finalOfficeId,
          status: batchStatus
        })).filter(r => r.plate_number && r.mv_file);

        const res = await uploadBatch(batchData);
        localIns += res.inserted;
        localSkp += res.skipped;
        count += results.data.length;

        setStats({ totalRows: filePreview.rows, inserted: localIns, skipped: localSkp });
        setProgress((count / filePreview.rows) * 100);
        
        if (!dbError) parser.resume(); else parser.abort();
      },
      complete: () => {
        setProgress(100);
        setIsProcessing(false);
        if (onComplete) onComplete();
      }
    });
  };

  return (
    <Modal open={open} onClose={isProcessing ? null : onClose}>
      <Fade in={open}>
        <Box sx={MODAL_STYLE}>
          <Typography variant="overline" color={COLORS.accent} fontWeight={900}>CONCURRENCY-SHIELD ACTIVE</Typography>
          <Typography variant="h5" fontWeight={900} mb={3}>MULTI-USER PLATE SYNC</Typography>
          
          {dbError ? (
            <Paper sx={{ p: 4, bgcolor: 'rgba(248, 113, 113, 0.05)', border: `1px solid ${COLORS.danger}`, textAlign: 'center' }}>
                <ErrorOutline sx={{ color: COLORS.danger, fontSize: 48, mb: 2 }} />
                <Typography variant="h6" color={COLORS.danger}>UPLOAD HALTED</Typography>
                <Typography variant="body2" color={COLORS.textSecondary} mb={3}>{dbError}</Typography>
                <Button variant="contained" color="error" fullWidth onClick={resetState}>RETRY</Button>
            </Paper>
          ) : (
            <>
              {!isProcessing && progress === 0 && (
                <Stack spacing={3}>
                  <TextField select label="TARGET OFFICE" fullWidth value={uploadOfficeId} onChange={(e) => setUploadOfficeId(e.target.value)} disabled={userRole !== 1}>
                    {offices.map((o) => <MenuItem key={o.id} value={o.id}>{o.name.toUpperCase()}</MenuItem>)}
                  </TextField>

                  {!selectedFile ? (
                    <Box sx={{ p: 6, borderRadius: 3, border: `2px dashed ${COLORS.border}`, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.02)', cursor: 'pointer' }} component="label">
                        <CloudUpload sx={{ fontSize: 60, color: COLORS.accent, mb: 2 }} />
                        <Typography variant="body1" fontWeight={700}>Click to Select CSV</Typography>
                        <input type="file" accept=".csv" hidden onChange={handleFileSelect} />
                    </Box>
                  ) : (
                    <Paper sx={{ p: 3, bgcolor: COLORS.bg, border: `1px solid ${COLORS.accent}` }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <FilePresent sx={{ color: COLORS.accent, fontSize: 40 }} />
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="subtitle1" fontWeight={800}>{filePreview.name}</Typography>
                                <Typography variant="caption" color={COLORS.textSecondary}>{filePreview.rows.toLocaleString()} Rows</Typography>
                            </Box>
                        </Stack>
                        <Button variant="contained" fullWidth size="large" onClick={startSync} sx={{ mt: 4, py: 2, fontWeight: 900, bgcolor: COLORS.accent }}>START ATOMIC SYNC</Button>
                    </Paper>
                  )}
                </Stack>
              )}

              {(isProcessing || progress === 100) && (
                <Box py={2}>
                  <Typography variant="h4" fontWeight={900} textAlign="right" mb={1}>{Math.round(progress)}%</Typography>
                  <LinearProgress variant="determinate" value={progress} sx={{ height: 12, borderRadius: 6, mb: 4, bgcolor: COLORS.border, '& .MuiLinearProgress-bar': { bgcolor: COLORS.accent } }} />
                  <Grid container spacing={2} mb={4}>
                    <Grid item xs={6}>
                        <Paper sx={{ p: 2, bgcolor: COLORS.bg, border: `1px solid ${COLORS.border}`, textAlign: 'center' }}>
                            <Typography variant="caption" color={COLORS.success} fontWeight={900}>SUCCESSFULLY SYNCED</Typography>
                            <Typography variant="h5" fontWeight={900}>{stats.inserted.toLocaleString()}</Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={6}>
                        <Paper sx={{ p: 2, bgcolor: COLORS.bg, border: `1px solid ${COLORS.border}`, textAlign: 'center' }}>
                            <Typography variant="caption" color={COLORS.warning} fontWeight={900}>SKIPPED (DUPLICATES)</Typography>
                            <Typography variant="h5" fontWeight={900}>{stats.skipped.toLocaleString()}</Typography>
                        </Paper>
                    </Grid>
                  </Grid>
                  {progress === 100 && (
                    <Stack direction="row" spacing={2}>
                      <Button variant="outlined" fullWidth startIcon={<FileDownload />} onClick={downloadAuditLog} sx={{ color: 'white', borderColor: COLORS.border }}>AUDIT LOG</Button>
                      <Button variant="contained" fullWidth onClick={() => { resetState(); onClose(); }} sx={{ bgcolor: COLORS.accent }}>CLOSE</Button>
                    </Stack>
                  )}
                </Box>
              )}
            </>
          )}
        </Box>
      </Fade>
    </Modal>
  );
}
