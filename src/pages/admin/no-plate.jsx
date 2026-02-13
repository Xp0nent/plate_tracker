import { useState, useEffect, useCallback } from 'react';
import { 
  Box, Typography, Button, Paper, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, 
  TextField, InputAdornment, Chip, Stack, TablePagination,
  LinearProgress, MenuItem, Select, FormControl, IconButton, Tooltip,
  Avatar, Checkbox, Snackbar, Alert 
} from '@mui/material';

import { 
  CloudUpload, Search, Edit, Storage, PostAdd, 
  CancelPresentation, Visibility, Refresh, CheckCircle,
  DirectionsCar
} from '@mui/icons-material';

import { supabase } from '../../lib/supabase'; 
import NoPlateUploadModal from '../../components/NoPlateUploadModal';
import NoPlateDetailsModal from '../../components/NoPlateDetailsModal'; 
import NoPlateEditModal from '../../components/NoPlateEditModal';

const COLORS = {
  bg: '#020617',
  paper: '#0f172a',
  border: '#1e293b',
  accent: '#3b82f6',
  danger: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
  textSecondary: '#94a3b8',
  tableHover: 'rgba(30, 41, 59, 0.8)'
};

export default function NoPlate() {
  const [plates, setPlates] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [stats, setStats] = useState({ total: 0, hasRequest: 0, noRequest: 0, approved: 0 });

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, msg: '', type: 'success' });

  const showMsg = (msg, type = 'success') => setSnackbar({ open: true, msg, type });

  const fetchStats = useCallback(async () => {
    try {
      const { count: total } = await supabase.from('no_plates').select('*', { count: 'exact', head: true });
      const { count: req } = await supabase.from('no_plates').select('*', { count: 'exact', head: true }).eq('status', 1);
      const { count: none } = await supabase.from('no_plates').select('*', { count: 'exact', head: true }).eq('status', 0);
      const { count: app } = await supabase.from('no_plates').select('*', { count: 'exact', head: true }).eq('status', 2);
      setStats({ total: total || 0, hasRequest: req || 0, noRequest: none || 0, approved: app || 0 });
    } catch (err) { console.error("Stats Sync Error"); }
  }, []);

  const fetchNoPlates = useCallback(async () => {
    setLoading(true);
    try {
      const from = page * rowsPerPage;
      const to = from + rowsPerPage - 1;
      let query = supabase.from('no_plates').select('*', { count: 'exact' });

      if (searchTerm) {
        query = query.or(`plate_number.ilike.%${searchTerm}%,mv_file.ilike.%${searchTerm}%`);
      }
      if (statusFilter !== 'all') {
        query = query.eq('status', parseInt(statusFilter, 10));
      }

      const { data, count, error } = await query.order('id', { ascending: false }).range(from, to);
      if (error) throw error;
      setPlates(data || []);
      setTotalCount(count || 0);
      fetchStats();
    } catch (err) { showMsg(err.message, "error"); } 
    finally { setLoading(false); }
  }, [page, rowsPerPage, searchTerm, statusFilter, fetchStats]);

  useEffect(() => {
    const handler = setTimeout(() => fetchNoPlates(), 400);
    return () => clearTimeout(handler);
  }, [fetchNoPlates]);

  const StatCard = ({ title, value, icon: Icon, color }) => (
    <Paper sx={{ 
      p: 2, flex: 1, minWidth: { xs: '100%', sm: '180px' },
      bgcolor: COLORS.paper, border: `1px solid ${COLORS.border}`, borderRadius: 2, 
      display: 'flex', alignItems: 'center', gap: 2
    }}>
      <Avatar sx={{ bgcolor: `${color}15`, color, width: 44, height: 44, borderRadius: 2 }}>
        <Icon sx={{ fontSize: 22 }} />
      </Avatar>
      <Box>
        <Typography variant="caption" sx={{ color: COLORS.textSecondary, fontWeight: 800, textTransform: 'uppercase', fontSize: '0.65rem' }}>{title}</Typography>
        <Typography variant="h5" sx={{ color: 'white', fontWeight: 900, lineHeight: 1 }}>{value.toLocaleString()}</Typography>
      </Box>
    </Paper>
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, minHeight: '100vh', bgcolor: COLORS.bg }}>
      
      {/* HEADER SECTION */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 4 }}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ p: 1, bgcolor: COLORS.danger, borderRadius: 1.5, display: 'flex' }}>
              <DirectionsCar sx={{ color: 'white', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={900} color="white" sx={{ letterSpacing: -0.5 }}>
                PLATE <span style={{ color: COLORS.danger }}>REGISTRY</span>
              </Typography>
            </Box>
          </Stack>
        </Box>
        <Stack direction="row" spacing={1.5}>
           <IconButton size="small" onClick={fetchNoPlates} sx={{ color: 'white', border: `1px solid ${COLORS.border}`, borderRadius: 1.5 }}>
             <Refresh fontSize="small" />
           </IconButton>
           <Button variant="contained" color="error" size="small" startIcon={<CloudUpload />} onClick={() => setIsUploadOpen(true)} sx={{ fontWeight: 900, px: 3, borderRadius: 1.5, height: 36 }}>
             IMPORT
           </Button>
        </Stack>
      </Stack>

      {/* ANALYTICS SECTION */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 4 }}>
        <StatCard title="Total" value={stats.total} icon={Storage} color={COLORS.accent} />
        <StatCard title="Review" value={stats.hasRequest} icon={PostAdd} color={COLORS.warning} />
        <StatCard title="Verified" value={stats.approved} icon={CheckCircle} color={COLORS.success} />
        <StatCard title="Pending" value={stats.noRequest} icon={CancelPresentation} color={COLORS.danger} />
      </Box>

      {/* SEARCH/FILTER BAR */}
      <Paper sx={{ p: 1.5, mb: 3, bgcolor: COLORS.paper, border: `1px solid ${COLORS.border}`, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 1.5, alignItems: 'center' }}>
          <Box sx={{ flex: 2, width: '100%' }}>
            <TextField fullWidth size="small" placeholder="Search Plate or MV File..." value={searchTerm} 
              onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
              sx={{ bgcolor: COLORS.bg, borderRadius: 1.5, '& .MuiOutlinedInput-root': { color: 'white', '& fieldset': { borderColor: COLORS.border } } }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search size="small" sx={{ color: COLORS.danger }} /></InputAdornment> }} 
            />
          </Box>
          <Box sx={{ flex: 1, width: '100%' }}>
            <FormControl fullWidth size="small">
              <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} 
                sx={{ bgcolor: COLORS.bg, color: 'white', borderRadius: 1.5, '& .MuiOutlinedInput-notchedOutline': { borderColor: COLORS.border } }}>
                <MenuItem value="all">Display All Statuses</MenuItem>
                <MenuItem value="1">FOR REVIEW</MenuItem>
                <MenuItem value="2">VERIFIED</MenuItem>
                <MenuItem value="0">PENDING</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>
      </Paper>

      {/* REGISTRY TABLE */}
      <TableContainer component={Paper} sx={{ bgcolor: COLORS.paper, border: `1px solid ${COLORS.border}`, borderRadius: 2, overflow: 'hidden' }}>
        {loading && <LinearProgress color="error" sx={{ height: 2 }} />}
        <Table size="medium">
          <TableHead sx={{ bgcolor: 'rgba(30, 41, 59, 0.5)' }}>
            <TableRow>
              <TableCell padding="checkbox" sx={{ pl: 2, borderBottom: `1px solid ${COLORS.border}`, py: 1.5 }}><Checkbox size="small" sx={{ color: COLORS.border }} /></TableCell>
              <TableCell sx={{ color: COLORS.textSecondary, fontWeight: 900, textTransform: 'uppercase', fontSize: '0.85rem', borderBottom: `1px solid ${COLORS.border}` }}>Sys ID</TableCell>
              <TableCell sx={{ color: COLORS.textSecondary, fontWeight: 900, textTransform: 'uppercase', fontSize: '0.85rem', borderBottom: `1px solid ${COLORS.border}` }}>Plate ID</TableCell>
              <TableCell sx={{ color: COLORS.textSecondary, fontWeight: 900, textTransform: 'uppercase', fontSize: '0.85rem', borderBottom: `1px solid ${COLORS.border}` }}>MV File Number</TableCell>
              <TableCell sx={{ color: COLORS.textSecondary, fontWeight: 900, textTransform: 'uppercase', fontSize: '0.85rem', borderBottom: `1px solid ${COLORS.border}` }}>Status</TableCell>
              <TableCell align="right" sx={{ color: COLORS.textSecondary, fontWeight: 900, textTransform: 'uppercase', fontSize: '0.85rem', pr: 2, borderBottom: `1px solid ${COLORS.border}` }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {plates.map((plate) => (
              <TableRow key={plate.id} hover sx={{ '&:hover': { bgcolor: COLORS.tableHover } }}>
                <TableCell padding="checkbox" sx={{ pl: 2, borderBottom: `1px solid ${COLORS.border}`, py: 0.8 }}><Checkbox size="small" sx={{ color: COLORS.border }} /></TableCell>
                <TableCell sx={{ color: '#64748b', fontFamily: 'monospace', py: 0.8, borderBottom: `1px solid ${COLORS.border}`, fontSize: '0.95rem' }}>
                  #{plate.id.toString().padStart(5, '0')}
                </TableCell>
                <TableCell sx={{ py: 0.8, borderBottom: `1px solid ${COLORS.border}` }}>
                   <Typography sx={{ fontWeight: 800, color: COLORS.danger, fontFamily: 'monospace', fontSize: '1.25rem' }}>
                     {plate.plate_number || '---'}
                   </Typography>
                </TableCell>
                <TableCell sx={{ color: '#cbd5e1', fontFamily: 'monospace', py: 0.8, borderBottom: `1px solid ${COLORS.border}`, fontSize: '1.1rem' }}>
                   {plate.mv_file || '---'}
                </TableCell>
                <TableCell sx={{ py: 0.8, borderBottom: `1px solid ${COLORS.border}` }}>
                  <Chip label={plate.status === 2 ? 'VERIFIED' : plate.status === 1 ? 'REVIEW' : 'PENDING'} 
                    sx={{ height: 26, fontWeight: 900, fontSize: '0.75rem', color: plate.status === 2 ? COLORS.success : plate.status === 1 ? COLORS.warning : COLORS.danger, border: '1.5px solid currentColor', bgcolor: 'transparent' }} />
                </TableCell>
                <TableCell align="right" sx={{ pr: 2, py: 0.8, borderBottom: `1px solid ${COLORS.border}` }}>
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    {plate.status === 1 && (
                      <Tooltip title="Review Uploaded Documents">
                        <IconButton size="medium" onClick={() => setDetailItem(plate)} sx={{ color: COLORS.warning }}>
                          <Visibility fontSize="inherit" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Edit Base Record">
                      <IconButton size="medium" onClick={() => setEditItem(plate)} sx={{ color: COLORS.accent }}>
                        <Edit fontSize="inherit" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination 
          component="div" 
          count={totalCount} 
          rowsPerPage={rowsPerPage} 
          page={page} 
          onPageChange={(e, p) => setPage(p)} 
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }} 
          sx={{ color: 'white', borderTop: `1px solid ${COLORS.border}`, '& .MuiTablePagination-toolbar': { minHeight: '48px' } }} 
        />
      </TableContainer>

      {/* MODAL COMPONENTS */}
      <NoPlateDetailsModal 
        plate={detailItem} 
        onClose={() => setDetailItem(null)} 
        onRefresh={fetchNoPlates} 
      />
      <NoPlateEditModal 
        plate={editItem} 
        onClose={() => setEditItem(null)} 
        onRefresh={fetchNoPlates} 
      />
      <NoPlateUploadModal 
        open={isUploadOpen} 
        onClose={() => setIsUploadOpen(false)} 
        onComplete={fetchNoPlates} 
      />
      
      {/* GLOBAL FEEDBACK */}
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({...snackbar, open: false})} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.type} variant="filled" sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: '1rem' }}>{snackbar.msg}</Alert>
      </Snackbar>
    </Box>
  );
}