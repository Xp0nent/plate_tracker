import { useState, useEffect } from 'react';
import { 
  Box, Typography, Button, Modal, Stack, IconButton, 
  LinearProgress, Paper, MenuItem, TextField, Fade, Grid, Divider
} from '@mui/material';
import { 
  CloudUpload, FilePresent, FileDownload, ErrorOutline, 
  CheckCircle, Close, Storage, FactCheck, Speed
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
  boxShadow: '0 24px 64px rgba(0,0,0,0.9)', p: 4, borderRadius: 4, color: 'white', outline: 'none',
};

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

  useEffect(() => { if (userBranchId && open) setUploadOfficeId(userBranchId); }, [userBranchId, open]);

  const resetState = () => {
    setIsProcessing(false); setProgress(0); setDbError(null);
    setStats({ totalRows: 0, inserted: 0, skipped: 0 });
    setSelectedFile(null); setDetailedLogs([]);
  };

  const startSync = async () => {
    if (!selectedFile || !uploadOfficeId) return;
    setIsProcessing(true);
    let allDuplicates = [];
    let localIns = 0;
    let localSkp = 0;
    
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

          const { data, error } = await supabase.rpc('fast_csv_import', { 
            items: batchData, target_office_id: Number(uploadOfficeId), target_status: statusText
          });

          if (error) throw error;
          localIns += data.inserted;
          localSkp += data.skipped;
          if (data.duplicate_details) allDuplicates = [...allDuplicates, ...data.duplicate_details];

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
          <Stack direction="row" justifyContent="space-between" mb={3}>
            <Typography variant="h6" fontWeight={900}>SYSTEM DATA IMPORT</Typography>
            {!isProcessing && <IconButton onClick={onClose} sx={{ color: COLORS.textSecondary }}><Close /></IconButton>}
          </Stack>

          {dbError ? (
            <Paper sx={{ p: 4, bgcolor: '#450a0a', border: `1px solid ${COLORS.danger}`, textAlign: 'center' }}>
                <ErrorOutline sx={{ color: COLORS.danger, mb: 2 }} />
                <Typography variant="subtitle1" fontWeight={900}>IMPORT FAILED</Typography>
                <Typography variant="caption" sx={{ color: '#fca5a5', mb: 3, display: 'block' }}>{dbError}</Typography>
                <Button variant="contained" color="error" fullWidth onClick={resetState}>RETRY</Button>
            </Paper>
          ) : (
            <>
              {progress === 0 && !isProcessing && (
                <Stack spacing={2}>
                  <TextField select label="TARGET BRANCH" fullWidth value={uploadOfficeId} onChange={(e) => setUploadOfficeId(e.target.value)}>
                    {offices.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
                  </TextField>
                  {!selectedFile ? (
                    <Box sx={{ p: 6, borderRadius: 2, border: `1px dashed ${COLORS.border}`, textAlign: 'center', cursor: 'pointer' }} component="label">
                      <CloudUpload sx={{ color: COLORS.accent, mb: 1 }} />
                      <Typography variant="body2" fontWeight={700}>Select CSV Data Source</Typography>
                      <input type="file" accept=".csv" hidden onChange={(e) => {
                        const file = e.target.files[0];
                        setSelectedFile(file);
                        Papa.parse(file, { header: true, complete: (r) => setFilePreview({ name: file.name, rows: r.data.length }) });
                      }} />
                    </Box>
                  ) : (
                    <Paper sx={{ p: 2, bgcolor: COLORS.bg, border: `1px solid ${COLORS.accent}` }}>
                      <Typography variant="caption" color={COLORS.textSecondary}>SELECTED FILE</Typography>
                      <Typography variant="body2" fontWeight={900} mb={2}>{filePreview.name} ({filePreview.rows} rows)</Typography>
                      <Button variant="contained" fullWidth onClick={startSync} sx={{ bgcolor: COLORS.accent, fontWeight: 900 }}>EXECUTE UPLOAD</Button>
                    </Paper>
                  )}
                </Stack>
              )}

              {isProcessing && (
                <Box py={4} textAlign="center">
                  <Storage sx={{ color: COLORS.accent, mb: 2, fontSize: 40 }} />
                  <Typography variant="h6" fontWeight={900}>WRITING TO CLOUD</Typography>
                  <LinearProgress sx={{ mt: 3, height: 6, borderRadius: 3 }} />
                </Box>
              )}

              {progress === 100 && !isProcessing && (
                <Box>
                  <Box textAlign="center" mb={4}>
                    <CheckCircle sx={{ color: COLORS.success, fontSize: 50, mb: 1 }} />
                    <Typography variant="h5" fontWeight={900}>IMPORT COMPLETE</Typography>
                  </Box>

                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <Paper sx={{ p: 2, bgcolor: COLORS.bg, border: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <FactCheck sx={{ color: COLORS.success }} />
                                <Typography variant="body2" fontWeight={700}>Successfully Inserted</Typography>
                            </Stack>
                            <Typography variant="h6" fontWeight={900} color={COLORS.success}>{stats.inserted}</Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={12}>
                        <Paper sx={{ p: 2, bgcolor: COLORS.bg, border: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <WarningAmber sx={{ color: COLORS.warning }} />
                                <Typography variant="body2" fontWeight={700}>Duplicates Skipped</Typography>
                            </Stack>
                            <Typography variant="h6" fontWeight={900} color={COLORS.warning}>{stats.skipped}</Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={12}>
                        <Paper sx={{ p: 2, bgcolor: COLORS.bg, border: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Speed sx={{ color: COLORS.accent }} />
                                <Typography variant="body2" fontWeight={700}>Total Processed</Typography>
                            </Stack>
                            <Typography variant="h6" fontWeight={900}>{stats.totalRows}</Typography>
                        </Paper>
                    </Grid>
                  </Grid>

                  <Button variant="contained" fullWidth onClick={() => { resetState(); onClose(); }} sx={{ mt: 4, py: 1.5, bgcolor: COLORS.accent, fontWeight: 900 }}>CLOSE DASHBOARD</Button>
                </Box>
              )}
            </>
          )}
        </Box>
      </Fade>
    </Modal>
  );
}
