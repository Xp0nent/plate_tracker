import { useState, useRef, useEffect } from 'react';
import { 
  Box, Typography, Button, Modal, Stack, IconButton, 
  LinearProgress, Paper, MenuItem, TextField, Fade, Grid, Divider, List, ListItem, ListItemText
} from '@mui/material';
import { 
  CloudUpload, FilePresent, FileDownload, ErrorOutline, CheckCircle, Close, Storage, Info
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
  boxShadow: '0 24px 48px rgba(0,0,0,0.6)', p: 4, borderRadius: 4, color: 'white', outline: 'none',
  maxHeight: '90vh', overflowY: 'auto'
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

  const downloadReport = () => {
    const timestamp = new Date().toLocaleString();
    const officeName = offices.find(o => o.id === uploadOfficeId)?.name || 'Branch';
    let report = `IMPORT REPORT - ${officeName}\n${timestamp}\n${'='.repeat(30)}\n`;
    report += `Total: ${stats.totalRows} | Added: ${stats.inserted} | Skipped: ${stats.skipped}\n\n`;
    detailedLogs.forEach((l, i) => {
      report += `${i + 1}. PLATE: ${l.plate} | MV: ${l.mv}\n`;
    });
    const blob = new Blob([report], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Sync_Report_${Date.now()}.txt`;
    link.click();
  };

  const startSync = async () => {
    if (!selectedFile || !uploadOfficeId) return;
    setIsProcessing(true);
    setDbError(null);
    setDetailedLogs([]);

    let localIns = 0;
    let localSkp = 0;
    let processedCount = 0;
    let allDuplicates = [];
    
    const statusText = batchStatus === 1 ? 'RELEASED TO DEALER' : 'FOR PICK UP AT LTO OFFICE';

    Papa.parse(selectedFile, {
      header: true, skipEmptyLines: true,
      chunk: async (results, parser) => {
        parser.pause();
        const data = results.data;

        for (let i = 0; i < data.length; i += BATCH_SIZE) {
          const chunk = data.slice(i, i + BATCH_SIZE);
          const batchData = chunk.map(row => ({
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
            processedCount += chunk.length;
            if (res.duplicate_details) allDuplicates = [...allDuplicates, ...res.duplicate_details];

            setStats({ totalRows: filePreview.rows, inserted: localIns, skipped: localSkp });
            setProgress(Math.min((processedCount / filePreview.rows) * 100, 99));
          } catch (err) {
            setDbError(err.message);
            parser.abort();
            setIsProcessing(false);
            return;
          }
        }
        parser.resume();
      },
      complete: () => {
        setDetailedLogs(allDuplicates);
        setProgress(100);
        setIsProcessing(false);
        // LIVE UPDATE: Trigger parent fetch function
        if (onComplete) onComplete(); 
      }
    });
  };

  return (
    <Modal open={open} onClose={isProcessing ? null : onClose}>
      <Fade in={open}>
        <Box sx={MODAL_STYLE}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
            <Box>
                <Typography variant="overline" color={COLORS.accent} sx={{ fontWeight: 900, letterSpacing: 2 }}>DATA ENGINE</Typography>
                <Typography variant="h5" fontWeight={900}>ATOMIC SYNC</Typography>
            </Box>
            {!isProcessing && (
              <IconButton onClick={onClose} sx={{ color: COLORS.textSecondary }}><Close /></IconButton>
            )}
          </Stack>

          {dbError ? (
            <Paper sx={{ p: 4, bgcolor: 'rgba(248, 113, 113, 0.05)', border: `1px solid ${COLORS.danger}`, textAlign: 'center' }}>
                <ErrorOutline sx={{ color: COLORS.danger, fontSize: 48, mb: 2 }} />
                <Typography variant="h6" color={COLORS.danger} fontWeight={900}>UPLOAD HALTED</Typography>
                <Typography variant="body2" color={COLORS.textSecondary} mb={3}>{dbError}</Typography>
                <Button variant="contained" color="error" fullWidth onClick={resetState}>RETRY PROCESS</Button>
            </Paper>
          ) : (
            <>
              {!isProcessing && progress === 0 && (
                <Stack spacing={2.5}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                        <TextField select label="OFFICE" fullWidth value={uploadOfficeId} onChange={(e) => setUploadOfficeId(e.target.value)} disabled={userRole !== 1}>
                            {offices.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
                        </TextField>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField select label="INITIAL STATUS" fullWidth value={batchStatus} onChange={(e) => setBatchStatus(Number(e.target.value))}>
                            <MenuItem value={1}>RELEASED TO DEALER</MenuItem>
                            <MenuItem value={2}>FOR PICK UP AT LTO</MenuItem>
                        </TextField>
                    </Grid>
                  </Grid>

                  {!selectedFile ? (
                    <Box sx={{ p: 5, borderRadius: 4, border: `2px dashed ${COLORS.border}`, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.02)', cursor: 'pointer', '&:hover': { borderColor: COLORS.accent, bgcolor: 'rgba(59, 130, 246, 0.05)' } }} component="label">
                        <CloudUpload sx={{ fontSize: 50, color: COLORS.accent, mb: 1.5 }} />
                        <Typography variant="body1" fontWeight={700}>Drop CSV here or click to browse</Typography>
                        <input type="file" accept=".csv" hidden onChange={handleFileSelect} />
                    </Box>
                  ) : (
                    <Paper sx={{ p: 2, bgcolor: COLORS.bg, border: `1px solid ${COLORS.accent}`, borderRadius: 3 }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <FilePresent sx={{ color: COLORS.accent, fontSize: 32 }} />
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="subtitle2" noWrap fontWeight={800}>{filePreview.name}</Typography>
                                <Typography variant="caption" color={COLORS.textSecondary}>{filePreview.rows.toLocaleString()} Potential Records</Typography>
                            </Box>
                            <IconButton onClick={() => setSelectedFile(null)} size="small" sx={{ color: COLORS.danger }}><Close /></IconButton>
                        </Stack>
                        <Button variant="contained" fullWidth size="large" onClick={startSync} sx={{ mt: 2, fontWeight: 900, bgcolor: COLORS.accent, py: 1.5 }}>RUN SYSTEM SYNC</Button>
                    </Paper>
                  )}
                </Stack>
              )}

              {isProcessing && (
                <Box py={4}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-end" mb={1.5}>
                     <Typography variant="body2" color={COLORS.accent} fontWeight={900}>WRITING TO DATABASE...</Typography>
                     <Typography variant="h4" fontWeight={900}>{Math.round(progress)}%</Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={progress} sx={{ height: 10, borderRadius: 5, mb: 4, bgcolor: COLORS.border, '& .MuiLinearProgress-bar': { bgcolor: COLORS.accent } }} />
                  
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                        <Paper sx={{ p: 2, bgcolor: COLORS.bg, border: `1px solid ${COLORS.border}`, textAlign: 'center' }}>
                            <Typography variant="caption" color={COLORS.success} sx={{ fontWeight: 900, display: 'block', mb: 0.5 }}>NEW ENTRIES</Typography>
                            <Typography variant="h5" fontWeight={900}>{stats.inserted.toLocaleString()}</Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={6}>
                        <Paper sx={{ p: 2, bgcolor: COLORS.bg, border: `1px solid ${COLORS.border}`, textAlign: 'center' }}>
                            <Typography variant="caption" color={COLORS.warning} sx={{ fontWeight: 900, display: 'block', mb: 0.5 }}>EXISTING (SKIPPED)</Typography>
                            <Typography variant="h5" fontWeight={900}>{stats.skipped.toLocaleString()}</Typography>
                        </Paper>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {progress === 100 && !isProcessing && (
                <Box>
                  <Paper sx={{ p: 3, bgcolor: 'rgba(74, 222, 128, 0.05)', border: `1px solid ${COLORS.success}`, borderRadius: 3, mb: 3 }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <CheckCircle sx={{ color: COLORS.success, fontSize: 40 }} />
                        <Box>
                            <Typography variant="h6" fontWeight={900} color={COLORS.success}>SYNC COMPLETED</Typography>
                            <Typography variant="body2" color={COLORS.textSecondary}>Dashboard has been updated with {stats.inserted} new plates.</Typography>
                        </Box>
                    </Stack>
                  </Paper>

                  <Typography variant="subtitle2" fontWeight={900} mb={1} color={COLORS.textSecondary}>CONFLICT SUMMARY ({detailedLogs.length})</Typography>
                  <Paper sx={{ bgcolor: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 2, maxHeight: 180, overflowY: 'auto', mb: 3 }}>
                    {detailedLogs.length > 0 ? (
                        <List dense>
                            {detailedLogs.slice(0, 50).map((log, idx) => (
                                <ListItem key={idx} divider={idx !== detailedLogs.length - 1}>
                                    <ListItemText 
                                        primary={<Typography variant="caption" fontWeight={800} color="white">{log.plate}</Typography>}
                                        secondary={<Typography variant="caption" color={COLORS.textSecondary}>MV: {log.mv}</Typography>}
                                    />
                                    <Typography variant="caption" color={COLORS.warning} fontWeight={900}>DUPLICATE</Typography>
                                </ListItem>
                            ))}
                            {detailedLogs.length > 50 && (
                                <ListItem><Typography variant="caption" color={COLORS.textSecondary}>...and {detailedLogs.length - 50} more items</Typography></ListItem>
                            )}
                        </List>
                    ) : (
                        <Box sx={{ p: 3, textAlign: 'center' }}>
                            <Info sx={{ color: COLORS.textSecondary, mb: 1 }} />
                            <Typography variant="caption" display="block" color={COLORS.textSecondary}>Perfect import! No conflicts found.</Typography>
                        </Box>
                    )}
                  </Paper>
                  
                  <Stack direction="row" spacing={2}>
                    <Button variant="outlined" startIcon={<FileDownload />} fullWidth onClick={downloadReport} sx={{ py: 1.5, borderColor: COLORS.border, color: 'white', fontWeight: 800 }}>REPORT</Button>
                    <Button variant="contained" fullWidth onClick={() => { resetState(); onClose(); }} sx={{ py: 1.5, bgcolor: COLORS.accent, fontWeight: 900 }}>CLOSE</Button>
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
