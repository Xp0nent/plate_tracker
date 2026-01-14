import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  Box, Typography, Paper, Button, TextField, 
  Stack, IconButton, Snackbar, Alert, 
  Chip, Avatar, Modal, Fade, MenuItem, CircularProgress
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid'; 
import { supabase } from '../../lib/supabase';
import { 
  Edit, Delete, Search, Refresh, 
  PersonAdd, Shield, PinDrop, Warning
} from '@mui/icons-material';

const COLORS = {
  bg: '#020617', paper: '#0f172a', border: '#1e293b',
  accent: '#3b82f6', textSecondary: '#94a3b8', danger: '#ef4444'
};

const MODAL_STYLE = {
  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  width: { xs: '90%', sm: 450 }, bgcolor: COLORS.paper, border: `1px solid ${COLORS.border}`, 
  boxShadow: '0 24px 48px rgba(0,0,0,0.5)', p: 4, borderRadius: 4, color: 'white', outline: 'none'
};

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal States
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [snackbar, setSnackbar] = useState({ open: false, msg: '', type: 'success' });

  // 1. FETCH DATA & VIRTUAL JOIN
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch Offices and Profiles simultaneously
      const [offRes, profRes] = await Promise.all([
        supabase.from('offices').select('id, name').order('name'),
        supabase.from('profiles').select('id, first_name, last_name, role, branch_office').order('last_name')
      ]);

      if (offRes.error) throw offRes.error;
      if (profRes.error) throw profRes.error;

      // Create a Lookup Map for Office Names
      const officeMap = {};
      offRes.data.forEach(off => { officeMap[off.id] = off.name; });

      // Enrich user data with the office name string
      const enrichedUsers = profRes.data.map(user => ({
        ...user,
        ui_office_name: officeMap[user.branch_office] || 'UNASSIGNED'
      }));

      setOffices(offRes.data || []);
      setUsers(enrichedUsers || []);
    } catch (err) {
      setSnackbar({ open: true, msg: "FETCH ERROR: " + err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 2. UPDATE LOGIC
  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: selectedUser.first_name,
          last_name: selectedUser.last_name,
          role: selectedUser.role,
          branch_office: selectedUser.branch_office 
        })
        .eq('id', selectedUser.id);

      if (error) throw error;
      
      setSnackbar({ open: true, msg: 'USER UPDATED', type: 'success' });
      setEditOpen(false);
      fetchData();
    } catch (err) {
      setSnackbar({ open: true, msg: err.message, type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. DELETE LOGIC
  const handleDelete = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', selectedUser.id);
      if (error) throw error;

      setSnackbar({ open: true, msg: 'USER REMOVED', type: 'success' });
      setDeleteOpen(false);
      fetchData();
    } catch (err) {
      setSnackbar({ open: true, msg: err.message, type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. SEARCH LOGIC (Includes Office Name Search)
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const searchStr = `${u.first_name} ${u.last_name} ${u.ui_office_name}`.toLowerCase();
      return searchStr.includes(searchTerm.toLowerCase());
    });
  }, [users, searchTerm]);

  const columns = [
    { 
      field: 'name', headerName: 'USER NAME', flex: 1.5,
      renderCell: (p) => (
        <Stack direction="row" spacing={2} alignItems="center" sx={{ height: '100%' }}>
          <Avatar sx={{ bgcolor: COLORS.accent, width: 32, height: 32, fontSize: 12 }}>
            {p.row.first_name?.charAt(0)}{p.row.last_name?.charAt(0)}
          </Avatar>
          <Typography variant="body2" fontWeight={700} color="white">
            {p.row.first_name} {p.row.last_name}
          </Typography>
        </Stack>
      )
    },
    { 
      field: 'role', headerName: 'ROLE', width: 130,
      renderCell: (p) => (
        <Chip label={p.value === 1 ? 'ADMIN' : 'STAFF'} size="small" 
          sx={{ 
            color: p.value === 1 ? COLORS.accent : COLORS.textSecondary, 
            border: `1px solid ${p.value === 1 ? COLORS.accent : COLORS.border}`, 
            fontWeight: 800, fontSize: '10px' 
          }} 
        />
      )
    },
    { 
      field: 'ui_office_name', headerName: 'OFFICE BRANCH', flex: 1,
      renderCell: (p) => (
        <Stack direction="row" spacing={1} alignItems="center">
          <PinDrop sx={{ fontSize: 16, color: COLORS.accent }} />
          <Typography variant="body2" color="white">{p.value}</Typography>
        </Stack>
      )
    },
    {
      field: 'actions', headerName: 'ACTIONS', width: 100, sortable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" sx={{ color: COLORS.accent }} onClick={() => { setSelectedUser(params.row); setEditOpen(true); }}><Edit fontSize="small" /></IconButton>
          <IconButton size="small" sx={{ color: COLORS.danger }} onClick={() => { setSelectedUser(params.row); setDeleteOpen(true); }}><Delete fontSize="small" /></IconButton>
        </Stack>
      )
    }
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" fontWeight={900} color="white">User Management</Typography>
        <Stack direction="row" spacing={2}>
          <Button onClick={fetchData} variant="outlined" startIcon={<Refresh />} sx={{ color: 'white', borderColor: COLORS.border }}>REFRESH</Button>
          <Button variant="contained" startIcon={<PersonAdd />} sx={{ bgcolor: COLORS.accent, fontWeight: 700 }}>NEW USER</Button>
        </Stack>
      </Stack>

      <Paper sx={{ mb: 3, p: 2, bgcolor: COLORS.paper, border: `1px solid ${COLORS.border}`, borderRadius: 3 }}>
        <TextField fullWidth placeholder="Search by name or office..." size="small" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ '& .MuiOutlinedInput-root': { color: 'white', '& fieldset': { borderColor: COLORS.border } } }}
          InputProps={{ startAdornment: <Search sx={{ mr: 1, color: COLORS.textSecondary }} /> }}
        />
      </Paper>

      <Paper sx={{ height: 600, bgcolor: COLORS.paper, border: `1px solid ${COLORS.border}`, borderRadius: 4, overflow: 'hidden' }}>
        <DataGrid 
          rows={filteredUsers} 
          columns={columns} 
          loading={loading} 
          getRowId={(row) => row.id} 
          disableRowSelectionOnClick
          sx={{ 
            border: 'none', color: 'white', 
            '& .MuiDataGrid-cell': { borderBottom: `1px solid ${COLORS.border}` },
            '& .MuiDataGrid-columnHeaders': { bgcolor: 'rgba(255,255,255,0.02)', borderBottom: `1px solid ${COLORS.border}` }
          }} 
        />
      </Paper>

      {/* EDIT MODAL */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)}>
        <Fade in={editOpen}>
          <Box sx={MODAL_STYLE}>
            <Typography variant="h6" fontWeight={800} mb={3}>Update Profile</Typography>
            {selectedUser && (
              <form onSubmit={handleUpdate}>
                <Stack spacing={3}>
                  <TextField label="FIRST NAME" fullWidth value={selectedUser.first_name || ''} onChange={e => setSelectedUser({...selectedUser, first_name: e.target.value})} 
                    sx={{ input: { color: 'white' }, '& label': { color: COLORS.textSecondary } }} />
                  
                  <TextField label="LAST NAME" fullWidth value={selectedUser.last_name || ''} onChange={e => setSelectedUser({...selectedUser, last_name: e.target.value})} 
                    sx={{ input: { color: 'white' }, '& label': { color: COLORS.textSecondary } }} />

                  <TextField select label="ROLE" fullWidth value={selectedUser.role ?? 0} onChange={e => setSelectedUser({...selectedUser, role: e.target.value})}
                    sx={{ '& .MuiSelect-select': { color: 'white' }, '& label': { color: COLORS.textSecondary } }}>
                    <MenuItem value={1}>ADMIN</MenuItem>
                    <MenuItem value={0}>STAFF</MenuItem>
                  </TextField>

                  <TextField select label="OFFICE BRANCH" fullWidth value={selectedUser.branch_office || ''} 
                    onChange={e => setSelectedUser({...selectedUser, branch_office: e.target.value})}
                    sx={{ '& .MuiSelect-select': { color: 'white' }, '& label': { color: COLORS.textSecondary } }}>
                    <MenuItem value=""><em>No Branch Assigned</em></MenuItem>
                    {offices.map((off) => (
                      <MenuItem key={off.id} value={off.id}>{off.name}</MenuItem>
                    ))}
                  </TextField>

                  <Button type="submit" variant="contained" fullWidth disabled={isProcessing} sx={{ py: 1.5, fontWeight: 700 }}>
                    {isProcessing ? <CircularProgress size={24} /> : 'SAVE CHANGES'}
                  </Button>
                </Stack>
              </form>
            )}
          </Box>
        </Fade>
      </Modal>

      {/* DELETE MODAL */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <Fade in={deleteOpen}>
          <Box sx={MODAL_STYLE}>
            <Stack spacing={3} alignItems="center" textAlign="center">
              <Warning sx={{ fontSize: 60, color: COLORS.danger }} />
              <Typography variant="h5" fontWeight={800}>Confirm Delete</Typography>
              <Typography color={COLORS.textSecondary}>Remove {selectedUser?.first_name} from the system?</Typography>
              <Stack direction="row" spacing={2} width="100%">
                <Button fullWidth variant="outlined" onClick={() => setDeleteOpen(false)} sx={{ color: 'white', borderColor: COLORS.border }}>CANCEL</Button>
                <Button fullWidth variant="contained" color="error" onClick={handleDelete} disabled={isProcessing}>CONFIRM</Button>
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