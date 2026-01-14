import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Box, Drawer, AppBar, Toolbar, List, ListItem, 
  ListItemButton, ListItemIcon, ListItemText, Typography, 
  Button, Divider, Stack, CircularProgress
} from '@mui/material';
import { 
  Dashboard as DashIcon, 
  Storage as DatabaseIcon, 
  Logout as LogoutIcon, 
  Shield,
  People as PeopleIcon,
  Storefront as BranchIcon 
} from '@mui/icons-material';

const drawerWidth = 260;

export default function AdminLayout() {
  const navigate = useNavigate();
  const [officeName, setOfficeName] = useState('Loading...');
  const [loading, setLoading] = useState(true);

  const adminName = sessionStorage.getItem('admin_name') || 'Admin';
  const roleId = sessionStorage.getItem('role'); 
  const branchId = sessionStorage.getItem('branch_office'); 
  
  const roleLabel = roleId === '1' ? 'Super Admin' : 'Standard Admin';

  // --- LOOKUP LOGIC: Get Office Name from Offices Table using branchId ---
  useEffect(() => {
    const fetchOfficeName = async () => {
      if (!branchId) {
        setOfficeName('No Branch');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('offices')
          .select('name')
          .eq('id', branchId)
          .single();

        if (error) throw error;
        setOfficeName(data?.name || 'Unknown Branch');
      } catch (err) {
        console.error("Error fetching office name:", err);
        setOfficeName(`Branch #${branchId}`);
      } finally {
        setLoading(false);
      }
    };

    fetchOfficeName();
  }, [branchId]);

  const handleLogout = () => {
    sessionStorage.clear(); 
    navigate('/admin/login', { replace: true });
  };

  return (
    <Box sx={{ display: 'flex' }}>
      {/* 1. TOP HEADER BAR */}
      <AppBar 
        position="fixed" 
        sx={{ 
          zIndex: (theme) => theme.zIndex.drawer + 1, 
          bgcolor: '#0f172a', 
          borderBottom: '1px solid rgba(255,255,255,0.1)', 
          backgroundImage: 'none' 
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Shield color="primary" />
            <Typography variant="h6" fontWeight="900" sx={{ letterSpacing: 1 }}>
              LTO ADMIN
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="body2" sx={{ color: 'white', fontWeight: 'bold' }}>
                {adminName.toUpperCase()}
              </Typography>
              <Typography variant="caption" sx={{ color: roleId === '1' ? '#3b82f6' : '#94a3b8', fontWeight: 'bold' }}>
                {roleLabel}
              </Typography>
            </Box>

            <Button color="error" variant="outlined" size="small" startIcon={<LogoutIcon />} onClick={handleLogout}>
              Logout
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* 2. PERSISTENT SIDEBAR */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { 
            width: drawerWidth, 
            boxSizing: 'border-box', 
            bgcolor: '#020617', 
            borderRight: '1px solid rgba(255,255,255,0.1)' 
          },
        }}
      >
        <Toolbar /> 
        
        {/* OFFICE DISPLAY (SHOWS NAME INSTEAD OF ID) */}
        <Box sx={{ px: 3, py: 2, mt: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <BranchIcon sx={{ color: '#3b82f6', fontSize: 20 }} />
            <Box>
              <Typography variant="caption" sx={{ color: '#475569', fontWeight: 900, display: 'block' }}>
                OFFICE
              </Typography>
              <Typography variant="body2" sx={{ color: 'white', fontWeight: 800, textTransform: 'uppercase' }}>
                {loading ? <CircularProgress size={12} color="inherit" /> : officeName}
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Divider sx={{ mx: 2, bgcolor: 'rgba(255,255,255,0.05)' }} />

        <Box sx={{ overflow: 'auto', mt: 1 }}>
          <List>
            {/* ADMINISTRATION (ABOVE DASHBOARD) */}
            {roleId === '1' && (
              <>
                <Typography variant="caption" sx={{ color: '#475569', fontWeight: 800, ml: 3, mb: 1, mt: 2, display: 'block', letterSpacing: 1 }}>
                  ADMINISTRATION
                </Typography>
                <ListItem disablePadding component={Link} to="/admin/users" sx={{ color: 'white' }}>
                  <ListItemButton>
                    <ListItemIcon><PeopleIcon color="primary" /></ListItemIcon>
                    <ListItemText primary="USER CONTROL" primaryTypographyProps={{ fontSize: '13px', fontWeight: '700' }} />
                  </ListItemButton>
                </ListItem>
                <Divider sx={{ my: 2, bgcolor: 'rgba(255,255,255,0.05)' }} />
              </>
            )}

            {/* MAIN NAVIGATION */}
            <Typography variant="caption" sx={{ color: '#475569', fontWeight: 800, ml: 3, mb: 1, display: 'block', letterSpacing: 1 }}>
              MENU
            </Typography>

            <ListItem disablePadding component={Link} to="/admin" sx={{ color: 'white' }}>
              <ListItemButton>
                <ListItemIcon><DashIcon color="primary" /></ListItemIcon>
                <ListItemText primary="DASHBOARD" primaryTypographyProps={{ fontSize: '13px', fontWeight: '700' }} />
              </ListItemButton>
            </ListItem>
            
            <ListItem disablePadding component={Link} to="/admin/manage" sx={{ color: 'white' }}>
              <ListItemButton>
                <ListItemIcon><DatabaseIcon color="primary" /></ListItemIcon>
                <ListItemText primary="PLATE DATABASE" primaryTypographyProps={{ fontSize: '13px', fontWeight: '700' }} />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 4, minHeight: '100vh', bgcolor: '#020617' }}>
        <Toolbar /> 
        <Outlet /> 
      </Box>
    </Box>
  );
}