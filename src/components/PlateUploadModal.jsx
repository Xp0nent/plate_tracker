import { useState, useRef, useEffect } from 'react';
import { 
  Box, Typography, Button, Modal, Stack, IconButton, 
  LinearProgress, Paper, MenuItem, TextField, Fade, Grid, Divider
} from '@mui/material';
import { 
  CloudUpload, FilePresent, FileDownload, ErrorOutline, CheckCircle, Close, ListAlt
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
  boxShadow: '0 24px 48px rgba(0,0,0,0.6)', p: 4, borderRadius: 4, color: 'white', outline: 'none',
  maxHeight: '90vh', overflowY: 'auto'
};

const BATCH_SIZE = 500;

export default function PlateUploadModal({ open, onClose, offices = [], userRole, userBranchId, onComplete }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ totalRows: 0, inserted: 0, skipped: 0 });
  const [detailedLogs, setDetailedLogs] = useState([]); // New state for report
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
    const officeName = offices.find(o => o.id === uploadOfficeId)?.name || 'Unknown';
    
    let reportContent = `PLATE RECORD IMPORT REPORT\n`;
    reportContent += `Generated: ${timestamp}\n`;
    reportContent += `Target Office: ${officeName}\n`;
    reportContent += `-------------------------------------------\n`;
    reportContent += `Total Rows Processed: ${stats.totalRows}\n`;
    reportContent += `Successfully Inserted: ${stats.inserted}\n`;
    reportContent += `Duplicates Skipped: ${stats.skipped}\n`;
    reportContent += `-------------------------------------------\n\n`;
    reportContent += `DETAILED DUPLICATE LOG:\n`;
    
    if (detailedLogs.length === 0) {
      reportContent += `No duplicates found. All records were unique.\n`;
    } else {
      detailedLogs.forEach((item, index) => {
        reportContent += `${index + 1}. PLATE: ${item.plate} | MV FILE: ${item.mv}\n`;
      });
    }

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Import_Report_${new Date().getTime()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const uploadBatch = async (batch, statusText) => {
    try {
      const { data, error } = await supabase.rpc('fast_csv_import', { 
        items: batch,
        target_office_id: Number(uploadOfficeId),
        target_status: statusText
      });
      if (error) throw error;
      return data;
    } catch (err) {
      setDbError(err.message);
      throw err;
    }
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
      header: true, 
      skipEmptyLines: true,
      chunkSize: 1024 * 512,
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
            const res = await uploadBatch(batchData, statusText);
            localIns += res.inserted;
            localSkp += res.skipped;
            processedCount += chunk.length;

            if (res.duplicate_details) {
                allDuplicates = [...allDuplicates, ...res.duplicate_details];
            }

            setStats({ totalRows: filePreview.rows, inserted: localIns, skipped: localSkp });
            setProgress(Math.min((processedCount / filePreview.rows) * 100, 99));

          } catch (err) {
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
        if (onComplete) onComplete();
      }
    });
  };

  return (
    <Modal open={open} onClose={isProcessing ? null : onClose}>
      <Fade in={open}>
        <Box sx={MODAL_STYLE}>
          <Typography variant="overline" color={COLORS.accent} fontWeight={900}>PRO-TIER UPLOAD</Typography>
          <Typography variant="h5" fontWeight={900} mb={3}>PLATE DATA SYNC</Typography>
          
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
                  <TextField 
                    select label="TARGET OFFICE" fullWidth value={uploadOfficeId} 
                    onChange={(e) => setUploadOfficeId(e.target.value)} 
                    disabled={userRole !== 1}
                  >
                    {offices.map((o) => <MenuItem key={o.id} value={o.id}>{o.name.toUpperCase()}</MenuItem>)}
                  </TextField>

                  <TextField 
                    select label="PLATE STATUS" fullWidth value={batchStatus} 
                    onChange={(e) => setBatchStatus(Number(e.target.value))}
                  >
                    <MenuItem value={1}>RELEASED TO DEALER</MenuItem>
                    <MenuItem value={2}>FOR PICK UP AT LTO OFFICE</MenuItem>
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
                            <IconButton onClick={() => setSelectedFile(null)} size="small" sx={{ color: COLORS.danger }}>
                                <Close />
                            </IconButton>
                        </Stack>
                        <Button variant="contained" fullWidth size="large" onClick={startSync} sx={{ mt: 4, py: 2, fontWeight: 900, bgcolor: COLORS.accent }}>START ATOMIC SYNC</Button>
                    </Paper>
                  )}
                </Stack>
              )}

              {(isProcessing || (progress > 0 && progress < 100)) && (
                <Box py={2}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-end" mb={1}>
                     <Typography variant="body2" color={COLORS.textSecondary} fontWeight={700}>SYNCING DATA...</Typography>
                     <Typography variant="h4" fontWeight={900}>{Math.round(progress)}%</Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={progress} sx={{ height: 12, borderRadius: 6, mb: 4, bgcolor: COLORS.border, '& .MuiLinearProgress-bar': { bgcolor: COLORS.accent } }} />
                  
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                        <Paper sx={{ p: 2, bgcolor: COLORS.bg, border: `1px solid ${COLORS.border}`, textAlign: 'center' }}>
                            <Typography variant="caption" color={COLORS.success} fontWeight={900}>INSERTED</Typography>
                            <Typography variant="h5" fontWeight={900}>{stats.inserted.toLocaleString()}</Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={6}>
                        <Paper sx={{ p: 2, bgcolor: COLORS.bg, border: `1px solid ${COLORS.border}`, textAlign: 'center' }}>
                            <Typography variant="caption" color={COLORS.warning} fontWeight={900}>DUPLICATES</Typography>
                            <Typography variant="h5" fontWeight={900}>{stats.skipped.toLocaleString()}</Typography>
                        </Paper>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {progress === 100 && !isProcessing && (
                <Box textAlign="center" py={2}>
                  <CheckCircle sx={{ fontSize: 60, color: COLORS.success, mb: 2 }} />
                  <Typography variant="h5" fontWeight={900} mb={1}>IMPORT SUCCESSFUL</Typography>
                  <Typography variant="body2" color={COLORS.textSecondary} mb={4}>
                    Processed {stats.totalRows.toLocaleString()} rows.
                  </Typography>
                  
                  <Stack spacing={2}>
                    <Button 
                      variant="outlined" 
                      startIcon={<FileDownload />} 
                      fullWidth 
                      onClick={downloadReport}
                      sx={{ py: 1.5, borderColor: COLORS.border, color: 'white', fontWeight: 700 }}
                    >
                      DOWNLOAD DETAILED REPORT (.TXT)
                    </Button>
                    <Button variant="contained" fullWidth onClick={() => { resetState(); onClose(); }} sx={{ py: 1.5, bgcolor: COLORS.accent, fontWeight: 900 }}>
                      CLOSE WINDOW
                    </Button>
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
