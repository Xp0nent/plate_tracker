import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Box, Typography, Button, Modal, Stack, IconButton, 
  LinearProgress, Paper, MenuItem, TextField, Fade, Grid, Alert,
  CircularProgress // Added missing import
} from '@mui/material';
import { 
  CloudUpload, Close, WarningAmber, FileDownload, Storage, Speed
} from '@mui/icons-material';
import { supabase } from '../lib/supabase'; 

const COLORS = {
  bg: '#020617', paper: '#0f172a', border: '#1e293b',
  accent: '#3b82f6', textSecondary: '#94a3b8',
  cardBg: '#111827', success: '#4ade80', warning: '#f59e0b'
};

const MODAL_STYLE = {
  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  width: { xs: '95%', sm: 650 }, maxHeight: '95vh',
  bgcolor: COLORS.paper, border: `1px solid ${COLORS.border}`, 
  p: 4, borderRadius: 4, color: 'white', outline: 'none', overflowY: 'auto',
  boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
};

export default function PlateUploadModal({ open, onClose, onComplete }) {
  const [offices, setOffices] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dbError, setDbError] = useState(null);
  const [uploadOfficeId, setUploadOfficeId] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeJobId, setActiveJobId] = useState(null);
  const [stats, setStats] = useState({ saved: 0, systemDups: 0 });

  const userRole = useMemo(() => Number(sessionStorage.getItem('role')), []);
  const userBranchId = useMemo(() => sessionStorage.getItem('branch_office'), []);

  // --- 1. Initial Data Loading ---
  useEffect(() => {
    if (open) {
      const fetchOffices = async () => {
        const { data } = await supabase.from('offices').select('id, name').order('name');
        if (data) setOffices(data);
      };
      fetchOffices();
    }
  }, [open]);

  useEffect(() => {
    if (!open || !offices.length) return;
    if (userRole !== 1) {
      setUploadOfficeId(userBranchId);
    } else {
      const found = offices.find(o => String(o.id) === String(userBranchId));
      setUploadOfficeId(found ? String(found.id) : String(offices[0].id));
    }
  }, [open, offices, userRole, userBranchId]);

  // --- 2. Realtime Listener ---
  useEffect(() => {
    if (!activeJobId) return;

    // Listener for Progress (import_jobs table)
    const jobChannel = supabase
      .channel(`job-${activeJobId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'import_jobs', 
        filter: `id=eq.${activeJobId}` 
      }, (payload) => {
        const { processed_rows, total_rows, status } = payload.new;
        
        if (total_rows > 0) {
          const calcProgress = (processed_rows / total_rows) * 100;
          setProgress(calcProgress);
        }

        if (status === 'COMPLETED') {
           setProgress(100);
           setIsProcessing(false);
           onComplete?.();
        }
      })
      .subscribe();

    // Listener for Conflicts (audit logs table)
    const auditChannel = supabase
      .channel(`audit-${activeJobId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'import_audit_logs',
        filter: `job_id=eq.${activeJobId}`
      }, async () => {
        // Fetch the count of conflicts live
        const { count } = await supabase
          .from('import_audit_logs')
          .select('*', { count: 'exact', head: true })
          .eq('job_id', activeJobId);
        
        setStats(prev => ({ ...prev, systemDups: count || 0 }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(jobChannel);
      supabase.removeChannel(auditChannel);
    };
  }, [activeJobId, onComplete]);

  // --- 3. Execution ---
  const startStreamSync = async () => {
    if (!uploadOfficeId) { setDbError('Select an office first'); return; }
    if (!selectedFile) { setDbError('Select a CSV file'); return; }

    setIsProcessing(true);
    setDbError(null);
    setProgress(0);
    setStats({ saved: 0, systemDups: 0 });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-heavy-csv`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'x-office-id': uploadOfficeId,
          'x-user-id': session?.user?.id,
          'Content-Type': 'text/csv'
        },
        body: selectedFile 
      });

      if (!response.ok) {
        const errorMsg = await response.text();
        throw new Error(errorMsg || 'Edge Function failed');
      }

      const result = await response.json();
      setActiveJobId(result.jobId);

    } catch (err) {
      setDbError(`Sync Interrupted: ${err.message}`);
      setIsProcessing(false);
    }
  };

  const downloadAuditReport = async () => {
    if (!activeJobId) return;
    const { data } = await supabase
      .from('import_audit_logs')
      .select('plate_number, mv_file, row_number, conflict_type')
      .eq('job_id', activeJobId);

    const logs = data.map(r => `[${r.conflict_type}] Row ${r.row_number}: Plate ${r.plate_number} | MV ${r.mv_file}`).join('\n');
    const blob = new Blob([`AUDIT REPORT\nJOB: ${activeJobId}\n\n` + logs], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit_report.txt`;
    link.click();
  };

  return (
    <Modal open={open} onClose={isProcessing ? undefined : onClose}>
      <Fade in={open}>
        <Box sx={MODAL_STYLE}>
          <Stack direction="row" justifyContent="space-between" mb={4}>
            <Box>
                <Typography variant="h5" fontWeight={900}>ENTERPRISE SYNC ENGINE</Typography>
                <Typography variant="caption" color={COLORS.accent} fontWeight={800}>LIVE CSV STREAMING</Typography>
            </Box>
            {!isProcessing && <IconButton onClick={onClose} sx={{ color: 'white' }}><Close /></IconButton>}
          </Stack>

          {dbError && <Alert severity="error" variant="filled" sx={{ mb: 3 }}>{dbError}</Alert>}

          {!activeJobId ? (
            <Stack spacing={3}>
              <TextField select label="BRANCH OFFICE" fullWidth disabled={userRole !== 1} value={uploadOfficeId} onChange={(e) => setUploadOfficeId(e.target.value)} variant="filled" sx={{ bgcolor: COLORS.bg, borderRadius: 2 }}>
                {offices.map((off) => (<MenuItem key={off.id} value={String(off.id)}>{off.name}</MenuItem>))}
              </TextField>

              <Box sx={{ p: 6, border: `2px dashed ${COLORS.border}`, textAlign: 'center', cursor: 'pointer', borderRadius: 4, '&:hover': { borderColor: COLORS.accent } }} component="label">
                <CloudUpload sx={{ fontSize: 48, color: COLORS.accent, mb: 1 }} />
                <Typography variant="h6" fontWeight={800}>{selectedFile ? selectedFile.name : 'SOURCE CSV'}</Typography>
                <Typography variant="caption" color="gray">{selectedFile ? `${(selectedFile.size/1024/1024).toFixed(2)} MB` : 'Drop CSV file here'}</Typography>
                <input type="file" accept=".csv" hidden onChange={(e) => setSelectedFile(e.target.files[0])} />
              </Box>

              <Button 
                variant="contained" 
                fullWidth 
                onClick={startStreamSync} 
                disabled={isProcessing || !selectedFile} 
                sx={{ py: 2, fontWeight: 900, position: 'relative' }}
              >
                {isProcessing ? (
                  <>
                    <CircularProgress size={24} sx={{ color: 'white', mr: 2 }} />
                    INITIALIZING...
                  </>
                ) : (
                  'START SYNC'
                )}
              </Button>
            </Stack>
          ) : (
            <Stack spacing={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h2" fontWeight={900} color={COLORS.accent}>{Math.round(progress)}%</Typography>
                <LinearProgress variant="determinate" value={progress} sx={{ height: 12, borderRadius: 6, bgcolor: COLORS.bg }} />
                <Typography variant="caption" color="gray" mt={1} display="block">
                  {progress === 100 ? "Sync Complete" : "Processing blocks in database..."}
                </Typography>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, bgcolor: COLORS.cardBg, textAlign: 'center', border: `1px solid ${COLORS.border}` }}>
                    <Typography variant="caption" color="gray">CONFLICTS</Typography>
                    <Typography variant="h5" fontWeight={900} color={stats.systemDups > 0 ? COLORS.warning : 'white'}>
                      {stats.systemDups}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, bgcolor: COLORS.cardBg, textAlign: 'center', border: `1px solid ${COLORS.border}` }}>
                    <Typography variant="caption" color="gray">STATUS</Typography>
                    <Typography variant="h6" fontWeight={900} color={progress === 100 ? COLORS.success : COLORS.warning}>
                      {progress === 100 ? 'SUCCESS' : 'ACTIVE'}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {progress === 100 && (
                <Stack spacing={2}>
                  <Button variant="outlined" startIcon={<FileDownload />} fullWidth onClick={downloadAuditReport} sx={{ color: 'white', borderColor: COLORS.border }}>
                    DOWNLOAD AUDIT LOG
                  </Button>
                  <Button variant="contained" fullWidth onClick={onClose} sx={{ py: 2, fontWeight: 900, bgcolor: COLORS.success }}>
                    CLOSE
                  </Button>
                </Stack>
              )}
            </Stack>
          )}
        </Box>
      </Fade>
    </Modal>
  );
}