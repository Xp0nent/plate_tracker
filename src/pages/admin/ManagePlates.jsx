import { useEffect, useState, useCallback, useMemo, useDeferredValue } from 'react';
import { 
  Box, Typography, Paper, Button, Chip, TextField, 
  Modal, Stack, MenuItem, IconButton, Snackbar, Alert, 
  Fade, CircularProgress, LinearProgress, Divider
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid'; 
import { supabase } from '../../lib/supabase';
import { 
  Edit, Delete, Search, Refresh, Close,
  Assessment, AssignmentTurnedIn, CloudUpload, Business, Warning, CheckCircle, FileDownload, Description
} from '@mui/icons-material';
import Papa from 'papaparse';

// --- Theme & Styles ---
const COLORS = {
  bg: '#020617', paper: '#0f172a', border: '#1e293b',
  accent: '#3b82f6', textMain: '#f8fafc', textSecondary: '#94a3b8',
  danger: '#f87171', warning: '#f59e0b', success: '#4ade80', info: '#a855f7'
};

const MODAL_STYLE = {
  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  width: { xs: '95%', sm: 650 }, bgcolor: COLORS.paper, border: `1px solid ${COLORS.border}`, 
  boxShadow: '0 24px 48px rgba(0,0,0,0.5)', p: 4, borderRadius: 4, color: 'white', outline: 'none',
  maxHeight: '90vh', overflowY: 'auto'
};

const TEXT_FIELD_STYLE = {
  '& .MuiOutlinedInput-root': {
    color: 'white', borderRadius: 2,
    '& fieldset': { borderColor: COLORS.border },
    '&:hover fieldset': { borderColor: COLORS.accent },
    '&.Mui-focused fieldset': { borderColor: COLORS.accent },
    '& input': { textTransform: 'uppercase' } 
  },
  '& .MuiInputLabel-root': { color: COLORS.textSecondary },
  '& .MuiSelect-icon': { color: COLORS.textSecondary }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'Available': return COLORS.success;
    case 'Released': return COLORS.danger;
    case 'PICK-UP OFFICE': return COLORS.warning;
    case 'RELEASE TO OFFICE': return COLORS.info;
    default: return COLORS.textSecondary;
  }
};

export default function ManagePlates() {
  // --- Basic States ---
  const [rows, setRows] = useState([]);
  const [offices, setOffices] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [localSearch, setLocalSearch] = useState(''); 
  const deferredSearch = useDeferredValue(localSearch);
  const [querySearch, setQuerySearch] = useState('');
  const [selectedOffice, setSelectedOffice] = useState('ALL');
  const [paginationModel, setPaginationModel] = useState({ pageSize: 10, page: 0 });
  
  // Modals & Feedback
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editData, setEditData] = useState({ id: '', plate_number: '', mv_file: '', dealer: '', status: '', office_id: '' });
  const [snackbar, setSnackbar] = useState({ open: false, msg: '', type: 'success' });

  // --- UPLOAD & ANALYSIS STATES ---
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false); 
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisDone, setAnalysisDone] = useState(false);
  const [csvData, setCsvData] = useState([]); 
  const [existingPlatesSet, setExistingPlatesSet] = useState(new Set()); 
  const [existingMvSet, setExistingMvSet] = useState(new Set());
  const [internalRepeats, setInternalRepeats] = useState([]); 

  const [uploadOfficeId, setUploadOfficeId] = useState('');
  const [batchStatus, setBatchStatus] = useState('Available');

  const userRole = Number(sessionStorage.getItem('role'));
  const userBranchId = sessionStorage.getItem('branch_office'); 

  // --- Calculations ---
  const dbDuplicates = useMemo(() => {
    return csvData
      .filter(row => existingPlatesSet.has(row.plate_number) || existingMvSet.has(row.mv_file))
      .map(row => ({ 
        plate: row.plate_number, 
        mv: row.mv_file, 
        row: row.originalRow, 
        reason: 'Already in Database' 
      }));
  }, [csvData, existingPlatesSet, existingMvSet]);

  const allDuplicates = useMemo(() => [...internalRepeats, ...dbDuplicates], [internalRepeats, dbDuplicates]);

  const skippedInDbCount = dbDuplicates.length;
  const readyToUploadCount = csvData.filter(row => !existingPlatesSet.has(row.plate_number) && !existingMvSet.has(row.mv_file)).length;

  // --- Helper Functions ---
  const downloadErrorReport = () => {
    if (allDuplicates.length === 0) return;
    let content = "UPLOAD ERROR REPORT DUE TO DUPLICATED DATA, KINDLY CHECK PLATE OR MV FILE\n";
    content += "==============================\n\n";
    allDuplicates.forEach(d => {
      content += `ROW ${d.row}: [Plate: ${d.plate}] [MV: ${d.mv}] - REASON: ${d.reason}\n`;
    });
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `upload_errors_${new Date().getTime()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const fetchOffices = useCallback(async () => {
    const { data, error } = await supabase.from('offices').select('id, name').order('name');
    if (!error && data) setOffices(data);
  }, []);

  const fetchPlates = useCallback(async () => {
    setLoading(true);
    try {
      const from = paginationModel.page * paginationModel.pageSize;
      const to = from + paginationModel.pageSize - 1;
      let query = supabase.from('plates').select(`*, offices:office_id ( id, name )`, { count: 'exact' }).range(from, to).order('created_at', { ascending: false });
      
      if (userRole === 1 && selectedOffice !== 'ALL') {
          query = query.eq('office_id', selectedOffice);
      } else if (userRole !== 1) {
          if (userBranchId) query = query.eq('office_id', Number(userBranchId));
          else { setRows([]); setLoading(false); return; }
      }
      
      if (querySearch) {
        query = query.or(`plate_number.ilike.%${querySearch}%,mv_file.ilike.%${querySearch}%,dealer.ilike.%${querySearch}%`);
      }
      
      const { data, count, error } = await query;
      if (error) throw error;
      setRows(data || []);
      setTotalRows(count || 0);
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, msg: "FETCH ERROR", type: 'error' });
    } finally { setLoading(false); }
  }, [paginationModel, querySearch, selectedOffice, userRole, userBranchId]);

  // --- Effects ---
  useEffect(() => { if (userBranchId) setUploadOfficeId(userBranchId); }, [userBranchId]);
  useEffect(() => { fetchOffices(); }, [fetchOffices]);
  useEffect(() => { fetchPlates(); }, [fetchPlates]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuerySearch(deferredSearch);
      setPaginationModel(prev => ({ ...prev, page: 0 })); 
    }, 400); 
    return () => clearTimeout(timer);
  }, [deferredSearch]);

  // --- Logic Handlers ---
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAnalyzing(true); setAnalysisDone(false); setIsFinished(false); setUploadProgress(0);

    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (results) => {
        const rawData = results.data;
        const cleanRows = [];
        const platesInFile = new Set();
        const mvInFile = new Set();
        const duplicatesInFile = [];

        rawData.forEach((row, index) => {
          const p = String(row.plate_number || '').toUpperCase().trim();
          const m = String(row.mv_file || '').toUpperCase().trim();
          if (p && m) {
            if (platesInFile.has(p) || mvInFile.has(m)) {
              duplicatesInFile.push({ plate: p, mv: m, row: index + 2, reason: 'Duplicate in CSV' });
            } else {
              platesInFile.add(p); mvInFile.add(m);
              cleanRows.push({
                plate_number: p, mv_file: m, originalRow: index + 2,
                dealer: String(row.dealer || '').toUpperCase().trim()
              });
            }
          }
        });

        setCsvData(cleanRows); setInternalRepeats(duplicatesInFile);
        const platesToCheck = Array.from(platesInFile);
        const mvToCheck = Array.from(mvInFile);
        const foundP = new Set(); const foundM = new Set();

        try {
          const BATCH_SIZE = 500;
          for (let i = 0; i < platesToCheck.length; i += BATCH_SIZE) {
            const { data } = await supabase.from('plates').select('plate_number').in('plate_number', platesToCheck.slice(i, i + BATCH_SIZE));
            if (data) data.forEach(d => foundP.add(d.plate_number));
          }
          for (let i = 0; i < mvToCheck.length; i += BATCH_SIZE) {
            const { data } = await supabase.from('plates').select('mv_file').in('mv_file', mvToCheck.slice(i, i + BATCH_SIZE));
            if (data) data.forEach(d => foundM.add(d.mv_file));
          }
          setExistingPlatesSet(foundP); setExistingMvSet(foundM); setAnalysisDone(true);
        } catch (err) {
          setSnackbar({ open: true, msg: "ANALYSIS FAILED", type: 'error' });
        } finally { setAnalyzing(false); }
      }
    });
  };

  const executeUpload = async () => {
    if (userRole === 1 && !uploadOfficeId) {
        setSnackbar({ open: true, msg: "PLEASE SELECT AN OFFICE FIRST", type: 'error' });
        return;
    }
    setUploading(true);
    const finalOfficeId = userRole === 1 ? uploadOfficeId : Number(userBranchId);
    const toUpload = csvData
      .filter(row => !existingPlatesSet.has(row.plate_number) && !existingMvSet.has(row.mv_file))
      .map(row => ({ 
        plate_number: row.plate_number,
        mv_file: row.mv_file,
        dealer: row.dealer,
        office_id: finalOfficeId,
        status: batchStatus 
      }));

    if (toUpload.length === 0) { setUploading(false); setIsFinished(true); return; }

    const BATCH_SIZE = 500;
    for (let i = 0; i < toUpload.length; i += BATCH_SIZE) {
      const batch = toUpload.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('plates').insert(batch);
      if (error) { setUploading(false); return; }
      setUploadProgress(Math.min(((i + batch.length) / toUpload.length) * 100, 100));
    }
    setUploading(false); setIsFinished(true); fetchPlates();
    setSnackbar({ open: true, msg: "UPLOAD SUCCESSFUL", type: 'success' });
  };

  const resetUpload = () => {
    setUploadOpen(false);
    setTimeout(() => {
        setConfirmExit(false); setAnalyzing(false); setAnalysisDone(false);
        setCsvData([]); setExistingPlatesSet(new Set()); setExistingMvSet(new Set()); setInternalRepeats([]);
        setUploading(false); setUploadProgress(0); setIsFinished(false);
    }, 300);
  };

  const downloadTemplate = () => {
    const headers = "plate_number,mv_file,dealer\nABC1234,123456789,TOYOTA";
    const blob = new Blob([headers], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = "inventory_template.csv";
    link.click();
  };

  const columns = useMemo(() => [
    { field: 'plate_number', headerName: 'PLATE NUMBER', flex: 1, renderCell: (p) => <Typography variant="body2" sx={{ fontWeight: 700, color: COLORS.accent }}>{p.value}</Typography> },
    { field: 'offices', headerName: 'OFFICE', flex: 1.2, valueGetter: (_, row) => row.offices?.name || 'UNASSIGNED' },
    { field: 'mv_file', headerName: 'MV FILE', flex: 1 },
    { field: 'dealer', headerName: 'DEALER', flex: 1 },
    { field: 'status', headerName: 'STATUS', width: 160, renderCell: (p) => (
        <Chip label={p.value.toUpperCase()} size="small" variant="outlined" sx={{ color: getStatusColor(p.value), borderColor: getStatusColor(p.value), fontWeight: 800, fontSize: '0.65rem' }} />
    )},
    { field: 'actions', headerName: 'ACTIONS', width: 110, sortable: false, renderCell: (params) => (
        <Stack direction="row" spacing={1}>
          <IconButton size="small" onClick={() => { setEditData({ ...params.row }); setEditOpen(true); }} sx={{ color: COLORS.accent }}><Edit fontSize="small" /></IconButton>
          {userRole === 1 && <IconButton size="small" onClick={() => { setItemToDelete(params.row); setDeleteOpen(true); }} sx={{ color: COLORS.danger }}><Delete fontSize="small" /></IconButton>}
        </Stack>
      )
    }
  ], [userRole]);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, minHeight: '100vh', bgcolor: COLORS.bg }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ color: 'white' }}>Inventory Management</Typography>
          <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>System Role: {userRole === 1 ? 'ADMINISTRATOR' : 'STAFF'}</Typography>
        </Box>
        <Stack direction="row" spacing={2}>
           <IconButton onClick={fetchPlates} sx={{ border: `1px solid ${COLORS.border}`, color: 'white' }}><Refresh /></IconButton>
           <Button variant="contained" startIcon={<CloudUpload />} onClick={() => setUploadOpen(true)} sx={{ bgcolor: COLORS.accent, fontWeight: 700, px: 3, borderRadius: 2 }}>UPLOAD CSV</Button>
        </Stack>
      </Stack>

      {/* Stats Cards */}
      <Stack direction="row" spacing={3} mb={4}>
        <Paper sx={{ flex: 1, p: 2, bgcolor: COLORS.paper, border: `1px solid ${COLORS.border}`, borderRadius: 3 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(59, 130, 246, 0.1)' }}><Assessment sx={{ color: COLORS.accent }} /></Box>
            <Box><Typography variant="caption" sx={{ color: COLORS.textSecondary, fontWeight: 700 }}>TOTAL PLATES</Typography><Typography variant="h6" fontWeight={800} color="white">{totalRows.toLocaleString()}</Typography></Box>
          </Stack>
        </Paper>
        <Paper sx={{ flex: 1, p: 2, bgcolor: COLORS.paper, border: `1px solid ${COLORS.border}`, borderRadius: 3 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(34, 197, 94, 0.1)' }}><AssignmentTurnedIn sx={{ color: COLORS.success }} /></Box>
            <Box><Typography variant="caption" sx={{ color: COLORS.textSecondary, fontWeight: 700 }}>DB STATUS</Typography><Typography variant="h6" fontWeight={800} color="white">LIVE</Typography></Box>
          </Stack>
        </Paper>
      </Stack>

      {/* Search & Filters */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mb={3}>
        <Paper sx={{ flex: userRole === 1 ? 2 : 1, p: 2, bgcolor: COLORS.paper, border: `1px solid ${COLORS.border}`, borderRadius: 3 }}>
          <TextField fullWidth placeholder="SEARCH DATABASE..." size="small" value={localSearch} onChange={(e) => setLocalSearch(e.target.value.toUpperCase())} sx={TEXT_FIELD_STYLE} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: COLORS.textSecondary }} /> }} />
        </Paper>
        {userRole === 1 && (
            <Paper sx={{ flex: 1, p: 2, bgcolor: COLORS.paper, border: `1px solid ${COLORS.border}`, borderRadius: 3 }}>
                <TextField select fullWidth size="small" value={selectedOffice} onChange={(e) => setSelectedOffice(e.target.value)} sx={TEXT_FIELD_STYLE} InputProps={{ startAdornment: <Business sx={{ mr: 1, color: COLORS.textSecondary }} /> }}>
                    <MenuItem value="ALL">ALL OFFICES</MenuItem>
                    {offices.map((off) => <MenuItem key={off.id} value={off.id}>{off.name.toUpperCase()}</MenuItem>)}
                </TextField>
            </Paper>
        )}
      </Stack>

      {/* Main Grid */}
      <Paper sx={{ height: 600, bgcolor: COLORS.paper, border: `1px solid ${COLORS.border}`, borderRadius: 4, overflow: 'hidden' }}>
        <DataGrid 
          rows={rows} columns={columns} rowCount={totalRows} loading={loading} 
          paginationMode="server" paginationModel={paginationModel} onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 25, 50, 100]} 
          sx={{ border: 'none', color: 'white', '& .MuiDataGrid-footerContainer': { borderTop: `1px solid ${COLORS.border}` }, '& .MuiTablePagination-root': { color: 'white' } }} 
        />
      </Paper>

      {/* --- SMART UPLOAD MODAL --- */}
      <Modal open={uploadOpen} onClose={(e, r) => (r !== 'backdropClick' && !uploading) && resetUpload()}>
        <Fade in={uploadOpen}>
          <Box sx={{ ...MODAL_STYLE, position: 'relative' }}>
            <IconButton onClick={() => {
                if (isFinished || (!uploading && !analysisDone)) return resetUpload();
                if (!confirmExit) { setConfirmExit(true); setTimeout(() => setConfirmExit(false), 3000); } 
                else resetUpload();
              }}
              sx={{ position: 'absolute', right: 12, top: 12, color: confirmExit ? COLORS.danger : COLORS.textSecondary }}
            >
              {confirmExit ? <Typography variant="caption" sx={{ fontWeight: 800, pr: 1 }}>EXIT?</Typography> : null}
              <Close />
            </IconButton>

            <Typography variant="h6" fontWeight={800} mb={1}>IMPORT INVENTORY</Typography>
            <Typography variant="body2" color={COLORS.textSecondary} mb={4}>CSV file must contain these data (Plate Number, MV File, Dealer)</Typography>
            
            {!analyzing && !analysisDone && (
              <Box textAlign="center" py={4}>
                 <Stack spacing={3}>
                    {userRole === 1 && (
                        <TextField select label="TARGET OFFICE" fullWidth value={uploadOfficeId} onChange={(e) => setUploadOfficeId(e.target.value)} sx={TEXT_FIELD_STYLE}>
                            {offices.map((off) => <MenuItem key={off.id} value={off.id}>{off.name.toUpperCase()}</MenuItem>)}
                        </TextField>
                    )}
                    <Box sx={{ p: 4, width: '100%', borderRadius: 3, border: `2px dashed ${COLORS.border}`, bgcolor: 'rgba(255,255,255,0.02)' }}>
                      <CloudUpload sx={{ fontSize: 48, color: COLORS.accent, mb: 2 }} />
                      <Typography variant="body2" mb={3} color={COLORS.textSecondary}>Only .csv files are supported</Typography>
                      <Stack direction="row" spacing={2} justifyContent="center">
                        <Button variant="contained" component="label" sx={{ fontWeight: 800, px: 3, bgcolor: COLORS.accent }}>
                            SELECT CSV
                            <input type="file" accept=".csv" hidden onChange={handleFileSelect} />
                        </Button>
                        <Button variant="outlined" startIcon={<FileDownload />} onClick={downloadTemplate} sx={{ color: 'white', borderColor: COLORS.border }}>
                            TEMPLATE
                        </Button>
                      </Stack>
                    </Box>
                 </Stack>
              </Box>
            )}

            {analyzing && (
              <Box py={8} textAlign="center">
                <CircularProgress size={60} sx={{ mb: 3 }} />
                <Typography variant="h6" fontWeight={800}>SCANNING FOR DUPLICATES...</Typography>
              </Box>
            )}

            {analysisDone && !uploading && !isFinished && (
              <Box>
                {allDuplicates.length > 0 && (
                  <Button fullWidth variant="outlined" color="warning" startIcon={<Description />} onClick={downloadErrorReport} sx={{ mb: 2, fontWeight: 700, borderStyle: 'dashed' }}>
                    DOWNLOAD ERROR LOG ({allDuplicates.length} SKIPPED)
                  </Button>
                )}
                
                <Stack direction="row" spacing={2} mb={3}>
                  <Paper sx={{ flex: 1, p: 2, bgcolor: COLORS.bg, border: `1px solid ${COLORS.border}`, textAlign: 'center' }}>
                    <Typography variant="caption" color={COLORS.textSecondary} display="block">IN FILE</Typography>
                    <Typography variant="h5" fontWeight={800}>{csvData.length + internalRepeats.length}</Typography>
                  </Paper>
                  <Paper sx={{ flex: 1, p: 2, bgcolor: 'rgba(245, 158, 11, 0.05)', border: `1px solid ${COLORS.warning}`, textAlign: 'center' }}>
                    <Typography variant="caption" color={COLORS.warning} display="block">ERROR - SKIPPED</Typography>
                    <Typography variant="h5" fontWeight={800} color={COLORS.warning}>{allDuplicates.length}</Typography>
                  </Paper>
                  <Paper sx={{ flex: 1, p: 2, bgcolor: 'rgba(74, 222, 128, 0.05)', border: `1px solid ${COLORS.success}`, textAlign: 'center' }}>
                    <Typography variant="caption" color={COLORS.success} display="block">READY</Typography>
                    <Typography variant="h5" fontWeight={800} color={COLORS.success}>{readyToUploadCount}</Typography>
                  </Paper>
                </Stack>

                <Stack spacing={2}>
                    <TextField select label="STATUS" fullWidth value={batchStatus} onChange={(e) => setBatchStatus(e.target.value)} sx={TEXT_FIELD_STYLE}>
                      <MenuItem value="AVAILABLE TO PICK UP AT LTO OFFICE">AVAILABLE TO PICK UP AT LTO OFFICE</MenuItem>
                      <MenuItem value="RELEASED TO DEALER">RELEASED TO DEALER</MenuItem>
                    </TextField>

                    <Button fullWidth variant="contained" size="large" disabled={readyToUploadCount === 0 || (userRole === 1 && !uploadOfficeId)} onClick={executeUpload} sx={{ py: 2, fontWeight: 900, bgcolor: COLORS.accent }}>
                        PROCEED WITH IMPORT
                    </Button>
                    <Button fullWidth onClick={resetUpload} sx={{ color: COLORS.textSecondary }}>CANCEL</Button>
                </Stack>
              </Box>
            )}

            {uploading && (
               <Box py={6}>
                 <Typography variant="h6" color="white" mb={2} fontWeight={800} textAlign="center">IMPORTING... {Math.round(uploadProgress)}%</Typography>
                 <LinearProgress variant="determinate" value={uploadProgress} sx={{ height: 12, borderRadius: 6 }} />
               </Box>
            )}

            {isFinished && (
               <Box textAlign="center" py={6}>
                  <CheckCircle sx={{ fontSize: 80, color: COLORS.success, mb: 2 }} />
                  <Typography variant="h5" fontWeight={800}>PROCESS COMPLETE</Typography>
                  <Button variant="outlined" fullWidth onClick={resetUpload} sx={{ mt: 4, color: 'white', borderColor: COLORS.border }}>CLOSE</Button>
               </Box>
            )}
          </Box>
        </Fade>
      </Modal>

      {/* EDIT MODAL */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)}>
        <Fade in={editOpen}>
          <Box sx={MODAL_STYLE}>
            <Typography variant="h6" fontWeight={800} mb={3}>EDIT RECORD</Typography>
            <Stack spacing={3}>
                <TextField label="PLATE NUMBER" fullWidth value={editData.plate_number} onChange={e => setEditData({...editData, plate_number: e.target.value})} sx={TEXT_FIELD_STYLE} />
                <TextField label="MV FILE" fullWidth value={editData.mv_file} onChange={e => setEditData({...editData, mv_file: e.target.value})} sx={TEXT_FIELD_STYLE} />
                <TextField label="DEALER" fullWidth value={editData.dealer} onChange={e => setEditData({...editData, dealer: e.target.value})} sx={TEXT_FIELD_STYLE} />
                <TextField select label="OFFICE" fullWidth value={editData.office_id} onChange={e => setEditData({...editData, office_id: e.target.value})} sx={TEXT_FIELD_STYLE} disabled={userRole !== 1}>
                  {offices.map((off) => <MenuItem key={off.id} value={off.id}>{off.name.toUpperCase()}</MenuItem>)}
                </TextField>
                <TextField select label="STATUS" fullWidth value={editData.status} onChange={e => setEditData({...editData, status: e.target.value})} sx={TEXT_FIELD_STYLE}>
                   <MenuItem value="AVAILABLE TO PICK UP AT LTO OFFICE">AVAILABLE TO PICK UP AT LTO OFFICE</MenuItem>
                      <MenuItem value="RELEASED TO DEALER">RELEASED TO DEALER</MenuItem>
                </TextField>
                <Button variant="contained" fullWidth sx={{ py: 1.5, fontWeight: 700 }} onClick={async () => {
                   const { id, offices, created_at, ...updates } = editData;
                   const { error } = await supabase.from('plates').update({
                     ...updates,
                     plate_number: editData.plate_number.toUpperCase().trim(),
                     mv_file: editData.mv_file.toUpperCase().trim()
                   }).eq('id', id);
                   if (!error) { setEditOpen(false); fetchPlates(); setSnackbar({ open: true, msg: 'UPDATED', type: 'success' }); }
                }}>SAVE CHANGES</Button>
            </Stack>
          </Box>
        </Fade>
      </Modal>

      {/* DELETE MODAL */}
      <Modal open={deleteOpen} onClose={() => !isDeleting && setDeleteOpen(false)}>
        <Fade in={deleteOpen}>
          <Box sx={{ ...MODAL_STYLE, border: `1px solid ${COLORS.danger}` }}>
            <Stack spacing={3} alignItems="center">
              <Warning sx={{ fontSize: 40, color: COLORS.danger }} />
              <Typography variant="h6" fontWeight={800}>Delete {itemToDelete?.plate_number}?</Typography>
              <Stack direction="row" spacing={2} width="100%">
                <Button fullWidth variant="outlined" onClick={() => setDeleteOpen(false)} sx={{ color: 'white', borderColor: COLORS.border }}>CANCEL</Button>
                <Button fullWidth variant="contained" color="error" disabled={isDeleting} onClick={async () => {
                   setIsDeleting(true);
                   const { error } = await supabase.from('plates').delete().eq('id', itemToDelete.id);
                   if (!error) { setDeleteOpen(false); fetchPlates(); }
                   setIsDeleting(false);
                }}>{isDeleting ? <CircularProgress size={24} /> : 'DELETE'}</Button>
              </Stack>
            </Stack>
          </Box>
        </Fade>
      </Modal>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({...snackbar, open: false})}>
        <Alert severity={snackbar.type} variant="filled">{snackbar.msg}</Alert>
      </Snackbar>
    </Box>
  );
}