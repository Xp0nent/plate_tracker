import { useState, useEffect } from 'react';
import { 
  Box, Typography, Button, Modal, Stack, IconButton, 
  LinearProgress, Paper, MenuItem, TextField, Fade, Grid, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip
} from '@mui/material';
import { 
  CloudUpload, FilePresent, FileDownload, ErrorOutline, 
  CheckCircle, Close, Terminal, Analytics
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
  width: { xs: '95%', sm: 700 }, bgcolor: COLORS.paper, border: `1px solid ${COLORS.border}`, 
  boxShadow: '0 24px 48px rgba(0,0,0,0.8)', p: 4, borderRadius: 4, color: 'white', outline: 'none',
  maxHeight: '95vh', overflowY: 'auto'
};

const BATCH_SIZE = 500;

export default function PlateUploadModal({ open, onClose, offices = [], userRole, userBranchId, onComplete }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ totalRows: 0, inserted: 0, skipped: 0 });
  const [detailedLogs, setDetailedLogs] = useState([]); 
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
    setDetailedLogs([]);
    setDbError(null);
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

  const downloadReport = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    const reportText = `IMPORT AUDIT LOG - ${timestamp}\n` +
      `Total Records: ${stats.totalRows}\n` +
      `Inserted: ${stats.inserted}\n` +
      `Rejected/Duplicates: ${stats.skipped}\n\n` +
      `REJECTED ITEMS LIST:\n` +
      detailedLogs.map((l, i) => `${i + 1}. Plate: ${l.plate} | MV: ${l.mv}`).join('\n');

    const blob = new Blob([reportText], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Audit_Log_${timestamp}.txt`;
    link.click();
  };

  const startSync = async () => {
    if (!selectedFile || !uploadOfficeId) return;
    setIsProcessing(true);
    setDbError(null);
    
    let localIns = 0;
    let localSkp = 0;
    let processedCount = 0;
    let allDuplicates = [];
    
    const statusText = batchStatus === 1 ? 'RELEASED TO DEALER' : 'FOR PICK UP AT LTO OFFICE';

    Papa.parse(selectedFile, {
      header: true, skipEmptyLines: true,
      chunk: async (results, parser) => {
        parser.pause();
        const batchData = results.data.map(row => ({
          plate_number: String(row.plate_number || '').trim().toUpperCase(),
          mv_file: String(row.mv_file || '').trim().toUpperCase(),
          dealer: String(row.dealer || 'N/A').trim()
        })).filter(r => r.plate_number && r.mv_file);

        try {
          const { data: res, error } = await supabase.rpc('fast_csv_import', { 
            items: batchData,
            target_office_id: Number(uploadOfficeId),
            target_status: statusText
          });

          if (error) throw error;

          localIns += res.inserted;
          localSkp += res.skipped;
          processedCount += results.data.length;
          if (res.duplicate_details) allDuplicates = [...allDuplicates, ...res.duplicate_details];

          setStats({ totalRows: filePreview.rows, inserted: localIns, skipped: localSkp });
          setProgress(Math.min((processedCount / filePreview.rows) * 100, 100));
        } catch (err) {
          setDbError(err.message);
          parser.abort();
          setIsProcessing(false);
          return;
        }
        parser.resume();
      },
      complete: () => {
        setDetailedLogs(allDuplicates);
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
          <Stack direction="row" spacing={1.5} alignItems="center" mb={4}>
            <Terminal sx={{ color: COLORS.accent }} />
            <Typography variant="h6" fontWeight={900} sx={{ letterSpacing: 1 }}>
              PLATE IMPORT ENGINE <span style={{ color: COLORS.accent, fontWeight: 400 }}>v2.4</span>
            </Typography>
          </Stack>

          {dbError ? (
            <Paper sx={{ p: 4, bgcolor: '#450a0a', border: `1px solid ${COLORS.danger}`, textAlign: 'center' }}>
                <ErrorOutline sx={{ color: COLORS.danger, fontSize: 48, mb: 2 }} />
                <Typography variant="h6" color={COLORS.danger} fontWeight={900}>SYSTEM EXCEPTION</Typography>
                <Typography variant="body2" sx={{ color: '#fca5a5', mb: 3 }}>{dbError}</Typography>
                <Button variant="contained" color="error" fullWidth onClick={resetState}>INITIALIZE RESET</Button>
            </Paper>
          ) : (
            <>
              {/* Step 1: Configuration */}
              {!isProcessing && progress === 0 && (
                <Stack spacing={3}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <TextField select label="TARGET OFFICE" fullWidth value={uploadOfficeId} onChange={(e) => setUploadOfficeId(e.target.value)} disabled={userRole !== 1}>
                        {offices.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
                      </TextField>
                    </Grid>
                    <Grid item xs={6}>
                      <TextField select label="DEFAULT STATUS" fullWidth value={batchStatus} onChange={(e) => setBatchStatus(Number(e.target.value))}>
                        <MenuItem value={1}>RELEASED TO DEALER</MenuItem>
                        <MenuItem value={2}>FOR PICK UP AT LTO</MenuItem>
                      </TextField>
                    </Grid>
                  </Grid>

                  {!selectedFile ? (
                    <Box sx={{ 
                      p: 8, borderRadius: 2, border: `1px dashed ${COLORS.border}`, 
                      textAlign: 'center', bgcolor: 'rgba(255,255,255,0.01)', cursor: 'pointer',
                      transition: '0.2s', '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.05)', borderColor: COLORS.accent }
                    }} component="label">
                      <CloudUpload sx={{ fontSize: 48, color: COLORS.textSecondary, mb: 2 }} />
                      <Typography variant="body1" fontWeight={600} color={COLORS.textSecondary}>Deploy CSV File</Typography>
                      <input type="file" accept=".csv" hidden onChange={handleFileSelect} />
                    </Box>
                  ) : (
                    <Paper sx={{ p: 3, bgcolor: COLORS.bg, border: `1px solid ${COLORS.accent}`, borderRadius: 2 }}>
                      <Stack direction="row" justifyContent="space-between" mb={2}>
                        <Box>
                          <Typography variant="subtitle2" fontWeight={900}>{filePreview.name}</Typography>
                          <Typography variant="caption" color={COLORS.textSecondary}>{filePreview.rows.toLocaleString()} Records Detected</Typography>
                        </Box>
                        <IconButton size="small" onClick={() => setSelectedFile(null)} sx={{ color: COLORS.danger }}><Close /></IconButton>
                      </Stack>
                      <Button variant="contained" fullWidth size="large" onClick={startSync} sx={{ py: 1.5, fontWeight: 900, bgcolor: COLORS.accent }}>EXECUTE IMPORT</Button>
                    </Paper>
                  )}
                </Stack>
              )}

              {/* Step 2: Processing */}
              {isProcessing && (
                <Box py={6} textAlign="center">
                  <Analytics sx={{ fontSize: 60, color: COLORS.accent, mb: 2, animation: 'pulse 2s infinite' }} />
                  <Typography variant="h5" fontWeight={900} mb={1}>SYNCHRONIZING...</Typography>
                  <Typography variant="body2" color={COLORS.textSecondary} mb={4}>Please wait while the engine writes to the database.</Typography>
                  <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 4, bgcolor: COLORS.border, '& .MuiLinearProgress-bar': { bgcolor: COLORS.accent } }} />
                </Box>
              )}

              {/* Step 3: Detailed Results */}
              {progress === 100 && !isProcessing && (
                <Box>
                  <Grid container spacing={2} mb={3}>
                    <Grid item xs={4}>
                      <Paper sx={{ p: 2, bgcolor: COLORS.bg, borderLeft: `4px solid ${COLORS.accent}`, textAlign: 'center' }}>
                        <Typography variant="caption" color={COLORS.textSecondary} fontWeight={800}>TOTAL</Typography>
                        <Typography variant="h6" fontWeight={900}>{stats.totalRows}</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={4}>
                      <Paper sx={{ p: 2, bgcolor: COLORS.bg, borderLeft: `4px solid ${COLORS.success}`, textAlign: 'center' }}>
                        <Typography variant="caption" color={COLORS.success} fontWeight={800}>SUCCESS</Typography>
                        <Typography variant="h6" fontWeight={900}>{stats.inserted}</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={4}>
                      <Paper sx={{ p: 2, bgcolor: COLORS.bg, borderLeft: `4px solid ${COLORS.warning}`, textAlign: 'center' }}>
                        <Typography variant="caption" color={COLORS.warning} fontWeight={800}>SKIPPED</Typography>
                        <Typography variant="h6" fontWeight={900}>{stats.skipped}</Typography>
                      </Paper>
                    </Grid>
                  </Grid>

                  <Typography variant="overline" color={COLORS.textSecondary} fontWeight={900} sx={{ mb: 1, display: 'block' }}>Duplicate Analysis</Typography>
                  
                  <TableContainer component={Paper} sx={{ bgcolor: COLORS.bg, border: `1px solid ${COLORS.border}`, maxHeight: 250, borderRadius: 2 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ bgcolor: COLORS.border, color: COLORS.textSecondary, fontWeight: 900 }}>PLATE NUMBER</TableCell>
                          <TableCell sx={{ bgcolor: COLORS.border, color: COLORS.textSecondary, fontWeight: 900 }}>MV FILE</TableCell>
                          <TableCell sx={{ bgcolor: COLORS.border, color: COLORS.textSecondary, fontWeight: 900 }} align="right">REASON</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {detailedLogs.length > 0 ? (
                          detailedLogs.map((row, i) => (
                            <TableRow key={i}>
                              <TableCell sx={{ color: 'white', borderBottom: `1px solid ${COLORS.border}` }}>{row.plate}</TableCell>
                              <TableCell sx={{ color: COLORS.textSecondary, borderBottom: `1px solid ${COLORS.border}` }}>{row.mv}</TableCell>
                              <TableCell align="right" sx={{ borderBottom: `1px solid ${COLORS.border}` }}>
                                <Chip label="EXISTING" size="small" sx={{ bgcolor: 'rgba(245, 158, 11, 0.1)', color: COLORS.warning, fontWeight: 900, fontSize: 10 }} />
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={3} align="center" sx={{ py: 4, color: COLORS.textSecondary }}>Zero conflicts detected. Integrity check passed.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Stack direction="row" spacing={2} mt={4}>
                    <Button variant="outlined" fullWidth startIcon={<FileDownload />} onClick={downloadReport} sx={{ borderColor: COLORS.border, color: 'white' }}>EXPORT AUDIT LOG</Button>
                    <Button variant="contained" fullWidth onClick={() => { resetState(); onClose(); }} sx={{ bgcolor: COLORS.accent, fontWeight: 900 }}>FINISH</Button>
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
