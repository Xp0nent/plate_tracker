import { useState, useEffect } from 'react';
import { 
  Box, Typography, Button, Modal, Stack, IconButton, 
  LinearProgress, Paper, MenuItem, TextField, Fade, Grid, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Divider
} from '@mui/material';
import { 
  CloudUpload, FilePresent, FileDownload, ErrorOutline, 
  CheckCircle, Close, Storage, Assessment, WarningAmber
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
  width: { xs: '95%', sm: 720 }, bgcolor: COLORS.paper, border: `1px solid ${COLORS.border}`, 
  boxShadow: '0 24px 64px rgba(0,0,0,0.8)', p: 4, borderRadius: 4, color: 'white', outline: 'none',
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
    const timestamp = new Date().toLocaleString();
    const reportText = `PLATE IMPORT AUDIT LOG\n========================\n` +
      `Date: ${timestamp}\nTotal Records: ${stats.totalRows}\n` +
      `Success: ${stats.inserted}\nSkipped: ${stats.skipped}\n\n` +
      `CONFLICT DETAILS:\n` +
      detailedLogs.map((l, i) => `${i + 1}. Plate: ${l.plate} | MV: ${l.mv}`).join('\n');

    const blob = new Blob([reportText], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Import_Audit_${Date.now()}.txt`;
    link.click();
  };

  const startSync = async () => {
    if (!selectedFile || !uploadOfficeId) return;
    setIsProcessing(true);
    setDbError(null);
    let allDuplicates = [];
    let localIns = 0;
    let localSkp = 0;
    let processedCount = 0;

    const statusText = batchStatus === 1 ? 'RELEASED TO DEALER' : 'FOR PICK UP AT LTO OFFICE';

    Papa.parse(selectedFile, {
      header: true, skipEmptyLines: true,
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
          processedCount += results.data.length;
          if (res.duplicate_details) allDuplicates = [...allDuplicates, ...res.duplicate_details];

          setStats({ totalRows: filePreview.rows, inserted: localIns, skipped: localSkp });
          setProgress(Math.min((processedCount / filePreview.rows) * 100, 100));
          parser.resume();
        } catch (err) {
          setDbError(err.message);
          parser.abort();
          setIsProcessing(false);
        }
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
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
            <Box>
                <Typography variant="overline" color={COLORS.accent} fontWeight={900} sx={{ letterSpacing: 2 }}>ADMINISTRATIVE TOOLS</Typography>
                <Typography variant="h5" fontWeight={900}>BATCH IMPORT MANAGER</Typography>
            </Box>
            {!isProcessing && <IconButton onClick={onClose} sx={{ color: COLORS.textSecondary }}><Close /></IconButton>}
          </Stack>

          {dbError ? (
            <Paper sx={{ p: 4, bgcolor: 'rgba(248, 113, 113, 0.05)', border: `1px solid ${COLORS.danger}`, textAlign: 'center' }}>
                <ErrorOutline sx={{ color: COLORS.danger, fontSize: 48, mb: 2 }} />
                <Typography variant="h6" color={COLORS.danger} fontWeight={900}>IMPORT FAILED</Typography>
                <Typography variant="body2" color={COLORS.textSecondary} mb={3}>{dbError}</Typography>
                <Button variant="contained" color="error" fullWidth onClick={resetState}>RESTART ENGINE</Button>
            </Paper>
          ) : (
            <>
              {/* Setup View */}
              {!isProcessing && progress === 0 && (
                <Stack spacing={3}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <TextField select label="OFFICE ASSIGNMENT" fullWidth value={uploadOfficeId} onChange={(e) => setUploadOfficeId(e.target.value)} disabled={userRole !== 1}>
                        {offices.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
                      </TextField>
                    </Grid>
                    <Grid item xs={6}>
                      <TextField select label="INITIAL STATUS" fullWidth value={batchStatus} onChange={(e) => setBatchStatus(Number(e.target.value))}>
                        <MenuItem value={1}>RELEASED TO DEALER</MenuItem>
                        <MenuItem value={2}>PICKUP AT LTO</MenuItem>
                      </TextField>
                    </Grid>
                  </Grid>

                  {!selectedFile ? (
                    <Box sx={{ p: 6, borderRadius: 4, border: `1px dashed ${COLORS.border}`, textAlign: 'center', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.05)', borderColor: COLORS.accent } }} component="label">
                      <CloudUpload sx={{ fontSize: 50, color: COLORS.accent, mb: 2 }} />
                      <Typography variant="body1" fontWeight={700}>Click to Select CSV File</Typography>
                      <input type="file" accept=".csv" hidden onChange={handleFileSelect} />
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
                      <Button variant="contained" fullWidth size="large" onClick={startSync} sx={{ fontWeight: 900, bgcolor: COLORS.accent }}>RUN BATCH PROCESSING</Button>
                    </Paper>
                  )}
                </Stack>
              )}

              {/* Progress View */}
              {isProcessing && (
                <Box py={6} textAlign="center">
                  <Storage sx={{ fontSize: 60, color: COLORS.accent, mb: 2 }} />
                  <Typography variant="h5" fontWeight={900} mb={1}>PROCESSING DATA...</Typography>
                  <Typography variant="body2" color={COLORS.textSecondary} mb={4}>Synchronizing with server. Do not close this window.</Typography>
                  <LinearProgress variant="determinate" value={progress} sx={{ height: 10, borderRadius: 5, bgcolor: COLORS.border, '& .MuiLinearProgress-bar': { bgcolor: COLORS.accent } }} />
                </Box>
              )}

              {/* Professional Results View */}
              {progress === 100 && !isProcessing && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={900} color={COLORS.textSecondary} gutterBottom>OPERATION SUMMARY</Typography>
                  <Grid container spacing={2} mb={4}>
                    <Grid item xs={4}>
                      <Paper sx={{ p: 2, bgcolor: COLORS.bg, textAlign: 'center', borderBottom: `3px solid ${COLORS.accent}` }}>
                        <Typography variant="caption" fontWeight={900} color={COLORS.textSecondary}>TOTAL PROCESSED</Typography>
                        <Typography variant="h5" fontWeight={900}>{stats.totalRows}</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={4}>
                      <Paper sx={{ p: 2, bgcolor: COLORS.bg, textAlign: 'center', borderBottom: `3px solid ${COLORS.success}` }}>
                        <Typography variant="caption" fontWeight={900} color={COLORS.success}>SUCCESSFULLY ADDED</Typography>
                        <Typography variant="h5" fontWeight={900}>{stats.inserted}</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={4}>
                      <Paper sx={{ p: 2, bgcolor: COLORS.bg, textAlign: 'center', borderBottom: `3px solid ${COLORS.warning}` }}>
                        <Typography variant="caption" fontWeight={900} color={COLORS.warning}>REJECTED (DUPLICATES)</Typography>
                        <Typography variant="h5" fontWeight={900}>{stats.skipped}</Typography>
                      </Paper>
                    </Grid>
                  </Grid>

                  <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                    <Assessment sx={{ fontSize: 18, color: COLORS.textSecondary }} />
                    <Typography variant="subtitle2" fontWeight={900} color={COLORS.textSecondary}>CONFLICT LOG</Typography>
                  </Stack>
                  
                  <TableContainer component={Paper} sx={{ bgcolor: COLORS.bg, border: `1px solid ${COLORS.border}`, maxHeight: 220, borderRadius: 2 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ bgcolor: COLORS.border, color: COLORS.textSecondary, fontWeight: 900 }}>PLATE NUMBER</TableCell>
                          <TableCell sx={{ bgcolor: COLORS.border, color: COLORS.textSecondary, fontWeight: 900 }}>MV FILE</TableCell>
                          <TableCell sx={{ bgcolor: COLORS.border, color: COLORS.textSecondary, fontWeight: 900 }} align="right">STATUS</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {detailedLogs.length > 0 ? (
                          detailedLogs.map((log, i) => (
                            <TableRow key={i}>
                              <TableCell sx={{ borderBottom: `1px solid ${COLORS.border}`, color: 'white' }}>{log.plate}</TableCell>
                              <TableCell sx={{ borderBottom: `1px solid ${COLORS.border}`, color: COLORS.textSecondary }}>{log.mv}</TableCell>
                              <TableCell align="right" sx={{ borderBottom: `1px solid ${COLORS.border}` }}>
                                <Chip label="CONFLICT" size="small" sx={{ height: 20, bgcolor: 'rgba(245, 158, 11, 0.1)', color: COLORS.warning, fontWeight: 900, fontSize: 10 }} />
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={3} align="center" sx={{ py: 4, color: COLORS.textSecondary }}>No data conflicts found in this batch.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Stack direction="row" spacing={2} mt={4}>
                    <Button variant="outlined" fullWidth startIcon={<FileDownload />} onClick={downloadReport} sx={{ py: 1.5, borderColor: COLORS.border, color: 'white', fontWeight: 800 }}>AUDIT REPORT</Button>
                    <Button variant="contained" fullWidth onClick={() => { resetState(); onClose(); }} sx={{ py: 1.5, bgcolor: COLORS.accent, fontWeight: 900 }}>DISMISS</Button>
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
