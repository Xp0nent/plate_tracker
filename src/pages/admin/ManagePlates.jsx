import { useEffect, useState, useCallback, useMemo, useDeferredValue } from 'react';
import { 
  Box, Typography, Paper, Button, Chip, TextField, 
  Modal, Stack, MenuItem, IconButton, Snackbar, Alert, 
  Fade, CircularProgress, Tooltip, Divider
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid'; 
import { supabase } from '../../lib/supabase'; 
import { 
  Edit, Delete, Search, Refresh, 
  Assessment, AssignmentTurnedIn, Warning, 
  CloudUpload, Business
} from '@mui/icons-material';

import PlateUploadModal from '../../components/PlateUploadModal';

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
    '& input': { textTransform: 'uppercase' },
    '&.Mui-disabled': {
      color: COLORS.textSecondary,
      WebkitTextFillColor: COLORS.textSecondary,
      '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }
    }
  },
  '& .MuiInputLabel-root': { color: COLORS.textSecondary },
  '& .MuiSelect-icon': { color: COLORS.textSecondary },
  '& .MuiInputLabel-root.Mui-disabled': { color: 'rgba(255,255,255,0.3)' }
};

const getStatusLabel = (status) => {
  const s = Number(status);
  if (s === 1) return 'FOR PICKUP';
  if (s === 0) return 'RELEASED TO DEALER';
  return 'UNKNOWN';
};

const getStatusColor = (status) => {
  const s = Number(status);
  if (s === 0) return COLORS.danger; 
  if (s === 1) return COLORS.success; 
  return COLORS.textSecondary;
};

export default function ManagePlates() {
  const [rows, setRows] = useState([]);
  const [offices, setOffices] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  
  const [localSearch, setLocalSearch] = useState(''); 
  const deferredSearch = useDeferredValue(localSearch);
  const [selectedOffice, setSelectedOffice] = useState('ALL');
  const [paginationModel, setPaginationModel] = useState({ pageSize: 25, page: 0 });
  
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editData, setEditData] = useState({ id: '', plate_number: '', mv_file: '', dealer: '', status: '', office_id: '' });
  const [editError, setEditError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, msg: '', type: 'success' });

  const userRole = Number(sessionStorage.getItem('role'));
  const userBranchId = sessionStorage.getItem('branch_office'); 

  const fetchOffices = useCallback(async () => {
    const { data } = await supabase.from('offices').select('id, name').order('name');
    if (data) setOffices(data);
  }, []);

  const fetchPlates = useCallback(async () => {
    setLoading(true);
    try {
      const from = paginationModel.page * paginationModel.pageSize;
      const to = from + paginationModel.pageSize - 1;
      
      let query = supabase
        .from('plates')
        .select(`*, offices:office_id ( id, name )`, { count: 'exact' })
        .range(from, to)
        .order('created_at', { ascending: false });
      
      if (userRole === 1 && selectedOffice !== 'ALL') {
          query = query.eq('office_id', selectedOffice);
      } else if (userRole !== 1) {
          query = query.eq('office_id', Number(userBranchId));
      }
      
      if (deferredSearch) {
        query = query.or(`plate_number.ilike.%${deferredSearch}%,mv_file.ilike.%${deferredSearch}%,dealer.ilike.%${deferredSearch}%`);
      }
      
      const { data, count, error } = await query;
      if (error) throw error;
      setRows(data || []);
      setTotalRows(count || 0);
    } catch (err) {
      setSnackbar({ open: true, msg: "FETCH ERROR: " + err.message, type: 'error' });
    } finally { setLoading(false); }
  }, [paginationModel, deferredSearch, selectedOffice, userRole, userBranchId]);

  useEffect(() => { fetchOffices(); }, [fetchOffices]);
  useEffect(() => { fetchPlates(); }, [fetchPlates]);

  const handleUpdate = async () => {
    setIsUpdating(true);
    setEditError('');
    
    const cleanPlate = editData.plate_number?.toUpperCase().trim();
    const cleanMV = editData.mv_file?.toUpperCase().trim();

    try {
      // 1. Check for duplicates (excluding current record ID)
      const { data: existing, error: checkError } = await supabase
        .from('plates')
        .select('plate_number, mv_file')
        .or(`plate_number.eq.${cleanPlate},mv_file.eq.${cleanMV}`)
        .not('id', 'eq', editData.id);

      if (checkError) throw checkError;

      if (existing && existing.length > 0) {
        const isPlateDup = existing.some(r => r.plate_number === cleanPlate);
        const isMVDup = existing.some(r => r.mv_file === cleanMV);
        
        if (isPlateDup && isMVDup) setEditError(`DUPLICATE FOUND: BOTH PLATE AND MV FILE ALREADY EXIST.`);
        else if (isPlateDup) setEditError(`DUPLICATE FOUND: PLATE NUMBER ${cleanPlate} ALREADY EXISTS.`);
        else if (isMVDup) setEditError(`DUPLICATE FOUND: MV FILE ${cleanMV} ALREADY EXISTS.`);
        
        setIsUpdating(false);
        return;
      }

      // 2. Perform Update
      const { id, offices, created_at, ...updates } = editData;
      const { error: updateError } = await supabase
        .from('plates')
        .update({
          ...updates,
          plate_number: cleanPlate,
          mv_file: cleanMV,
          office_id: Number(updates.office_id)
        })
        .eq('id', id);

      if (updateError) throw updateError;

      setEditOpen(false); 
      fetchPlates(); 
      setSnackbar({ open: true, msg: 'RECORD UPDATED SUCCESSFULLY', type: 'success' }); 

    } catch (err) {
      setEditError(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const columns = useMemo(() => [
    { field: 'plate_number', headerName: 'PLATE NUMBER', flex: 1, renderCell: (p) => <Typography variant="body2" sx={{ fontWeight: 700, color: COLORS.accent }}>{p.value}</Typography> },
    { field: 'mv_file', headerName: 'MV FILE', flex: 1 },
    { field: 'dealer', headerName: 'DEALER', flex: 1 },
    { field: 'office_name', headerName: 'OFFICE', flex: 1, valueGetter: (_, row) => row.offices?.name || 'UNASSIGNED' },
    { 
      field: 'status', 
      headerName: 'STATUS', 
      width: 180, 
      renderCell: (p) => (
        <Chip 
          label={getStatusLabel(p.value)} 
          size="small" 
          variant="outlined" 
          sx={{ 
            color: getStatusColor(p.value), 
            borderColor: getStatusColor(p.value), 
            fontWeight: 800, 
            fontSize: '0.65rem' 
          }} 
        />
      )
    },
    { field: 'actions', headerName: 'ACTIONS', width: 100, sortable: false, renderCell: (params) => (
        <Stack direction="row">
          <IconButton size="small" onClick={() => { setEditError(''); setEditData({ ...params.row }); setEditOpen(true); }} sx={{ color: COLORS.accent }}><Edit fontSize="small" /></IconButton>
          {userRole === 1 && <IconButton size="small" onClick={() => { setItemToDelete(params.row); setDeleteOpen(true); }} sx={{ color: COLORS.danger }}><Delete fontSize="small" /></IconButton>}
        </Stack>
      )
    }
  ], [userRole]);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, minHeight: '100vh', bgcolor: COLORS.bg }}>
      {/* Header Area */}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} mb={4}>
        <Box>
          <Typography variant="h4" fontWeight={900} color="white" sx={{ letterSpacing: '-0.02em' }}>Inventory</Typography>
          <Typography 
            variant="body2" 
            component="div" 
            color={COLORS.textSecondary} 
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: COLORS.success }} />
            {userRole === 1 ? 'Administrator Management' : 'Branch Staff Access'}
          </Typography>
        </Box>
        
        <Stack direction="row" spacing={2} alignItems="center">
          <IconButton 
            onClick={fetchPlates} 
            sx={{ border: `1px solid ${COLORS.border}`, color: 'white', borderRadius: 2, height: 48, width: 48 }}
          >
            <Refresh />
          </IconButton>
          
          <Button 
            variant="contained" 
            disableElevation
            startIcon={<CloudUpload />} 
            onClick={() => setUploadOpen(true)}
            sx={{ 
              height: 48, px: 3, bgcolor: COLORS.accent, fontWeight: 800, borderRadius: 2.5,
              textTransform: 'none', fontSize: '0.95rem', boxShadow: `0 8px 20px -6px ${COLORS.accent}`,
              '&:hover': { bgcolor: '#2563eb', transform: 'translateY(-1px)', boxShadow: `0 12px 24px -8px ${COLORS.accent}` },
              transition: 'all 0.2s ease-in-out'
            }}
          >
            Import Data
          </Button>
        </Stack>
      </Stack>

      {/* Stats Section */}
      <Stack direction="row" spacing={3} mb={4}>
        <Paper sx={{ flex: 1, p: 2.5, bgcolor: COLORS.paper, border: `1px solid ${COLORS.border}`, borderRadius: 4 }}>
          <Stack direction="row" alignItems="center" spacing={2.5}>
            <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(59, 130, 246, 0.12)', display: 'flex' }}><Assessment sx={{ color: COLORS.accent }} /></Box>
            <Box>
              <Typography variant="caption" component="div" sx={{ color: COLORS.textSecondary, fontWeight: 700, letterSpacing: 1 }}>TOTAL RECORDS</Typography>
              <Typography variant="h5" fontWeight={900} color="white">{totalRows.toLocaleString()}</Typography>
            </Box>
          </Stack>
        </Paper>
        <Paper sx={{ flex: 1, p: 2.5, bgcolor: COLORS.paper, border: `1px solid ${COLORS.border}`, borderRadius: 4 }}>
          <Stack direction="row" alignItems="center" spacing={2.5}>
            <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(34, 197, 94, 0.12)', display: 'flex' }}><AssignmentTurnedIn sx={{ color: COLORS.success }} /></Box>
            <Box>
              <Typography variant="caption" component="div" sx={{ color: COLORS.textSecondary, fontWeight: 700, letterSpacing: 1 }}>SYSTEM STATUS</Typography>
              <Typography variant="h5" fontWeight={900} color="white">ONLINE</Typography>
            </Box>
          </Stack>
        </Paper>
      </Stack>

      {/* Filters Area */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mb={3}>
        <TextField 
          placeholder="Search plate, MV file, or dealer..." 
          fullWidth size="small" 
          value={localSearch} 
          onChange={(e) => setLocalSearch(e.target.value.toUpperCase())} 
          sx={{ ...TEXT_FIELD_STYLE, bgcolor: COLORS.paper, flex: 2 }} 
          InputProps={{ startAdornment: <Search sx={{ mr: 1, color: COLORS.textSecondary }} /> }} 
        />
        {userRole === 1 && (
          <TextField 
            select fullWidth size="small" 
            value={selectedOffice} 
            onChange={(e) => setSelectedOffice(e.target.value)} 
            sx={{ ...TEXT_FIELD_STYLE, bgcolor: COLORS.paper, flex: 1 }}
          >
            <MenuItem value="ALL">ALL OFFICES</MenuItem>
            {offices.map((off) => <MenuItem key={off.id} value={off.id}>{off.name.toUpperCase()}</MenuItem>)}
          </TextField>
        )}
      </Stack>

      {/* Main Grid Container */}
      <Paper sx={{ height: 650, bgcolor: COLORS.paper, border: `1px solid ${COLORS.border}`, borderRadius: 4, overflow: 'hidden' }}>
        <DataGrid 
          rows={rows} columns={columns} rowCount={totalRows} loading={loading} 
          paginationMode="server" paginationModel={paginationModel} onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 25, 50]} 
          sx={{ 
            border: 'none', color: 'white',
            '& .MuiDataGrid-cell': { borderBottom: `1px solid ${COLORS.border}`, fontSize: '0.875rem' },
            '& .MuiDataGrid-columnHeaders': { bgcolor: 'rgba(255,255,255,0.03)', borderBottom: `1px solid ${COLORS.border}`, fontWeight: 800 },
            '& .MuiTablePagination-root': { color: COLORS.textSecondary },
            '& .MuiDataGrid-footerContainer': { borderTop: `1px solid ${COLORS.border}` }
          }} 
        />
      </Paper>

      {/* Upload Modal */}
      <PlateUploadModal 
        open={uploadOpen} 
        onClose={() => setUploadOpen(false)} 
        offices={offices}
        userRole={userRole}
        userBranchId={userBranchId}
        onComplete={fetchPlates}
      />

      {/* Edit Modal */}
      <Modal open={editOpen} onClose={() => !isUpdating && setEditOpen(false)}>
        <Fade in={editOpen}>
          <Box sx={MODAL_STYLE}>
            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
              <Edit sx={{ color: COLORS.accent }} />
              <Typography variant="h6" fontWeight={900}>EDIT PLATE RECORD</Typography>
            </Stack>
            
            {editError && (
              <Alert severity="error" sx={{ mb: 2, bgcolor: 'rgba(248, 113, 113, 0.1)', color: COLORS.danger, border: `1px solid ${COLORS.danger}`, fontWeight: 700 }}>
                {editError}
              </Alert>
            )}

            <Divider sx={{ borderColor: COLORS.border, mb: 3 }} />

            <Stack spacing={2.5}>
              <TextField label="PLATE NUMBER" fullWidth value={editData.plate_number} onChange={e => {setEditError(''); setEditData({...editData, plate_number: e.target.value})}} sx={TEXT_FIELD_STYLE} />
              <TextField label="MV FILE" fullWidth value={editData.mv_file} onChange={e => {setEditError(''); setEditData({...editData, mv_file: e.target.value})}} sx={TEXT_FIELD_STYLE} />
              <TextField label="DEALER" fullWidth value={editData.dealer} onChange={e => setEditData({...editData, dealer: e.target.value})} sx={TEXT_FIELD_STYLE} />
              
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField 
                  select 
                  label="ASSIGNED OFFICE" 
                  fullWidth 
                  value={editData.office_id || ''} 
                  onChange={e => setEditData({...editData, office_id: e.target.value})} 
                  disabled={userRole !== 1} 
                  sx={TEXT_FIELD_STYLE}
                  helperText={userRole !== 1 ? "Only administrators can transfer records." : ""}
                  FormHelperTextProps={{ sx: { color: COLORS.textSecondary, fontSize: '0.7rem' } }}
                >
                  {offices.map((off) => (
                    <MenuItem key={off.id} value={off.id}>{off.name.toUpperCase()}</MenuItem>
                  ))}
                </TextField>

                <TextField 
                  select 
                  label="STATUS" 
                  fullWidth 
                  value={Number(editData.status)} 
                  onChange={e => setEditData({...editData, status: Number(e.target.value)})} 
                  sx={TEXT_FIELD_STYLE}
                >
                  <MenuItem value={1}>FOR PICKUP</MenuItem>
                  <MenuItem value={0}>RELEASED TO DEALER</MenuItem>
                </TextField>
              </Stack>

              <Button 
                variant="contained" 
                fullWidth 
                disabled={isUpdating}
                sx={{ py: 1.5, mt: 2, fontWeight: 900, borderRadius: 2, bgcolor: COLORS.accent }} 
                onClick={handleUpdate}
              >
                {isUpdating ? <CircularProgress size={24} color="inherit" /> : 'SAVE CHANGES'}
              </Button>
            </Stack>
          </Box>
        </Fade>
      </Modal>

      {/* Delete Modal */}
      <Modal open={deleteOpen} onClose={() => !isDeleting && setDeleteOpen(false)}>
        <Fade in={deleteOpen}>
          <Box sx={{ ...MODAL_STYLE, maxWidth: 400 }}>
            <Stack spacing={3} alignItems="center">
              <Warning sx={{ fontSize: 50, color: COLORS.danger }} />
              <Box textAlign="center">
                <Typography variant="h6" fontWeight={800} component="div">Confirm Delete</Typography>
                <Typography variant="body2" color={COLORS.textSecondary}>
                  Delete record for {itemToDelete?.plate_number}? This action cannot be undone.
                </Typography>
              </Box>
              <Stack direction="row" spacing={2} width="100%">
                <Button fullWidth variant="outlined" onClick={() => setDeleteOpen(false)} sx={{ color: 'white', borderColor: COLORS.border, borderRadius: 2 }}>CANCEL</Button>
                <Button 
                  fullWidth variant="contained" color="error" disabled={isDeleting}
                  onClick={async () => {
                    setIsDeleting(true);
                    const { error } = await supabase.from('plates').delete().eq('id', itemToDelete.id);
                    if (!error) { setDeleteOpen(false); fetchPlates(); setSnackbar({ open: true, msg: 'DELETED', type: 'info' }); }
                    setIsDeleting(false);
                  }}
                  sx={{ borderRadius: 2 }}
                >
                  {isDeleting ? <CircularProgress size={24} /> : 'DELETE'}
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Fade>
      </Modal>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({...snackbar, open: false})}>
        <Alert severity={snackbar.type} variant="filled" sx={{ fontWeight: 700 }}>{snackbar.msg}</Alert>
      </Snackbar>
    </Box>
  );
}