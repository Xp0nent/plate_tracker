import { useState, useEffect } from 'react';
import { 
  Box, Typography, Button, Modal, Stack, IconButton, 
  LinearProgress, Paper, MenuItem, TextField, Fade, Grid, Divider
} from '@mui/material';
import { 
  CloudUpload, FilePresent, FileDownload, ErrorOutline, 
  CheckCircle, Close, Storage, Assessment, WarningAmber, DoneAll
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
  width: { xs: '95%', sm: 650 }, bgcolor: COLORS.paper, border: `1px solid ${COLORS.border}`, 
  boxShadow: '0 24px 64px rgba(0,0,0,0.8)', p: 4, borderRadius: 4, color: 'white', outline: 'none',
};

export default function PlateUploadModal({ open, onClose, offices = [], userRole, userBranchId, onComplete }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ totalRows: 0, inserted: 0, skipped: 0 });
  const [uploadOfficeId, setUploadOfficeId] = useState(userBranchId || '');
  const [batchStatus, setBatchStatus] = useState(1); 
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState({ name: '', rows: 0 });
  const [dbError, setDbError] = useState(null);

  useEffect(() => {
    if (userBranchId && open) setUploadOfficeId(userBranchId);
  }, [userBranchId, open]);

  const resetState = () => {
    setIsProcessing(false);
    setProgress(0);
    setStats({ totalRows: 0, inserted: 0, skipped: 0 });
    setSelectedFile(null);
    setDbError(null);
  };

  const startSync = async () => {
    if (!selectedFile || !uploadOfficeId) return;
    setIsProcessing(true);
    setDbError(null);
    
    let localIns = 0;
    let localSkp = 0;
    const statusText = batchStatus === 1 ? 'RELEASED TO DEALER' : 'FOR PICK UP AT LTO OFFICE';

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      chunk: async (results, parser) => {
        parser.pause();
        try {
          const batchData = results.data.map(row => ({
            plate_number: String(row.plate_number || '').trim().toUpperCase(),
            mv_file: String(row.mv_file || '').trim().toUpperCase(),
            dealer: String(row.dealer || 'N/A').trim()
          })).filter(r => r.plate_number && r.mv_file);

          const { data: res, error } = await supabase.rpc('fast_csv_import', { 
            items: batchData, target_office_id: Number(uploadOfficeId), target_status: statusText
          });

          if (error) throw error;

          localIns += res.inserted;
          localSkp += res.skipped;

          setStats({ totalRows: filePreview.rows, inserted: localIns, skipped: localSkp });
          setProgress(100);
          parser.resume();
        } catch (err) {
          setDbError(err.message);
          parser.abort();
          setIsProcessing(false);
        }
      },
      complete: () => {
        setIsProcessing(false);
        if (onComplete) onComplete();
      }
    });
  };

  return (
    <Modal open={open} onClose={isProcessing ? null : onClose}>
      <Fade in={open}>
        <Box sx={MODAL_STYLE}>
          {/* Header */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
            <Box>
                <Typography variant="overline" color={COLORS.accent} fontWeight={900} sx={{ letterSpacing: 2 }}>ADMIN TOOLS</Typography>
                <Typography variant="h5" fontWeight={900}>BATCH DATA SYNC</Typography>
            </Box>
            {!isProcessing && <IconButton onClick={onClose} sx={{ color: COLORS.textSecondary }}><Close /></IconButton>}
          </Stack>

          {dbError ? (
            <Paper sx={{ p: 4, bgcolor: 'rgba(248, 113, 113, 0.05)', border: `1px solid ${COLORS.danger}`, textAlign: 'center' }}>
                <ErrorOutline sx={{ color: COLORS.danger, fontSize: 48, mb: 2 }} />
                <Typography variant="h6" color={COLORS.danger} fontWeight={900}>IMPORT HALTED</Typography>
                <Typography variant="body2" color={COLORS.textSecondary} mb={3}>{dbError}</Typography>
                <Button variant="contained" color="error" fullWidth onClick={resetState}>RE-INITIALIZE</Button>
            </Paper>
          ) : (
            <>
              {/* Configuration State */}
              {!isProcessing && progress === 0 && (
                <Stack spacing={3}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <TextField select label="OFFICE" fullWidth value={uploadOfficeId} onChange={(e) => setUploadOfficeId(e.target.value)} disabled={userRole !== 1}>
                        {offices.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
                      </TextField>
                    </Grid>
                    <Grid item xs={6}>
                      <TextField select label="DEFAULT STATUS" fullWidth value={batchStatus} onChange={(e) => setBatchStatus(Number(e.target.value))}>
                        <MenuItem value={1}>RELEASED TO DEALER</MenuItem>
                        <MenuItem value={2}>PICKUP AT LTO</MenuItem>
                      </TextField>
                    </Grid>
                  </Grid>

                  {!selectedFile ? (
                    <Box sx={{ p: 7, borderRadius: 4, border: `1px dashed ${COLORS.border}`, textAlign: 'center', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.05)', borderColor: COLORS.accent } }} component="label">
                      <CloudUpload sx={{ fontSize: 48, color: COLORS.accent, mb: 2 }} />
                      <Typography variant="body1" fontWeight={700}>Select CSV for Processing</Typography>
                      <input type="file" accept=".csv" hidden onChange={(e) => {
                         const file = e.target.files[0];
                         setSelectedFile(file);
                         Papa.parse(file, { header: true, complete: (r) => setFilePreview({ name: file.name, rows: r.data.length }) });
                      }} />
                    </Box>
                  ) : (
                    <Paper sx={{ p: 3, bgcolor: COLORS.bg, border: `1px solid ${COLORS.accent}`, borderRadius: 2 }}>
                      <Stack direction="row" spacing={2} alignItems="center" mb={3}>
                        <FilePresent sx={{ color: COLORS.accent, fontSize: 40 }} />
                        <Box>
                          <Typography variant="subtitle2" fontWeight={900}>{filePreview.name}</Typography>
                          <Typography variant="caption" color={COLORS.textSecondary}>{filePreview.rows.toLocaleString()} Records Detected</Typography>
                        </Box>
                      </Stack>
                      <Button variant="contained" fullWidth size="large" onClick={startSync} sx={{ fontWeight: 900, bgcolor: COLORS.accent }}>EXECUTE IMPORT</Button>
                    </Paper>
                  )}
                </Stack>
              )}

              {/* Processing State */}
              {isProcessing && (
                <Box py={6} textAlign="center">
                  <Storage sx={{ fontSize: 60, color: COLORS.accent, mb: 2 }} />
                  <Typography variant="h5" fontWeight={900} mb={1}>WRITING RECORDS...</Typography>
                  <Typography variant="body2" color={COLORS.textSecondary} mb={4}>Applying atomic transaction to database.</Typography>
                  <LinearProgress sx={{ height: 10, borderRadius: 5, bgcolor: COLORS.border, '& .MuiLinearProgress-bar': { bgcolor: COLORS.accent } }} />
                </Box>
              )}

              {/* Enhanced Summary Dashboard */}
              {progress === 100 && !isProcessing && (
                <Box>
                  <Stack direction="row" spacing={2} alignItems="center" mb={4} sx={{ p: 2, bgcolor: 'rgba(74, 222, 128, 0.05)', borderRadius: 2, border: `1px solid ${COLORS.success}` }}>
                    <CheckCircle sx={{ color: COLORS.success, fontSize: 32 }} />
                    <Box>
                        <Typography variant="h6" fontWeight={900} color={COLORS.success}>SUCCESS</Typography>
                        <Typography variant="caption" color={COLORS.textSecondary}>Batch processing completed successfully.</Typography>
                    </Box>
                  </Stack>

                  <Typography variant="overline" fontWeight={900} color={COLORS.textSecondary} sx={{ ml: 1 }}>Final Audit Counts</Typography>
                  <Grid container spacing={2} mb={4}>
                    <Grid item xs={4}>
                      <Paper sx={{ p: 3, bgcolor: COLORS.bg, textAlign: 'center', borderBottom: `4px solid ${COLORS.accent}` }}>
                        <Typography variant="caption" fontWeight={900} color={COLORS.textSecondary}>TOTAL ROWS</Typography>
                        <Typography variant="h4" fontWeight={900}>{stats.totalRows}</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={4}>
                      <Paper sx={{ p: 3, bgcolor: COLORS.bg, textAlign: 'center', borderBottom: `4px solid ${COLORS.success}` }}>
                        <Typography variant="caption" fontWeight={900} color={COLORS.success}>INSERTED</Typography>
                        <Typography variant="h4" fontWeight={900}>{stats.inserted}</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={4}>
                      <Paper sx={{ p: 3, bgcolor: COLORS.bg, textAlign: 'center', borderBottom: `4px solid ${COLORS.warning}` }}>
                        <Typography variant="caption" fontWeight={900} color={COLORS.warning}>SKIPPED</Typography>
                        <Typography variant="h4" fontWeight={900}>{stats.skipped}</Typography>
                      </Paper>
                    </Grid>
                  </Grid>

                  <Stack direction="row" spacing={2}>
                    <Button variant="outlined" fullWidth onClick={resetState} sx={{ py: 1.5, borderColor: COLORS.border, color: 'white' }}>NEW IMPORT</Button>
                    <Button variant="contained" fullWidth onClick={() => { resetState(); onClose(); }} sx={{ py: 1.5, bgcolor: COLORS.accent, fontWeight: 900 }}>CLOSE WINDOW</Button>
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
