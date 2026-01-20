import { useEffect, useState } from 'react';
import { Box, Grid, Paper, Typography, CircularProgress, Button, Divider } from '@mui/material';
import { supabase } from '../../lib/supabase';
import { DirectionsCar, FactCheck, Group, Add, LocalShipping } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [counts, setCounts] = useState({ total: 0, pickup: 0, released: 0, users: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  const adminName = sessionStorage.getItem('admin_name');
  const userRole = Number(sessionStorage.getItem('role')); 
  const userBranchId = sessionStorage.getItem('branch_office'); 

  useEffect(() => {
    async function getStats() {
      try {
        setLoading(true);
        
        // --- 1. Total Plates Count ---
        let totalQuery = supabase
          .from('plates')
          .select('*', { count: 'exact', head: true });

        if (userRole !== 1 && userBranchId) {
          totalQuery = totalQuery.eq('office_id', Number(userBranchId));
        }
        const { count: total } = await totalQuery;

        // --- 2. For Pick-up Count (Status 1) ---
        let pickupQuery = supabase
          .from('plates')
          .select('*', { count: 'exact', head: true })
          .eq('status', 1); // Logic for Status 1

        if (userRole !== 1 && userBranchId) {
          pickupQuery = pickupQuery.eq('office_id', Number(userBranchId));
        }
        const { count: pickup } = await pickupQuery;

        // --- 3. Released to Dealer Count (Status 0) ---
        let releasedQuery = supabase
          .from('plates')
          .select('*', { count: 'exact', head: true })
          .eq('status', 0); // Logic for Status 0

        if (userRole !== 1 && userBranchId) {
          releasedQuery = releasedQuery.eq('office_id', Number(userBranchId));
        }
        const { count: released } = await releasedQuery;

        // --- 4. Registered Staff Count ---
        let staffCount = 0;
        if (userRole === 1) {
          const { count: users } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });
          staffCount = users;
        }

        setCounts({
          total: total || 0,
          pickup: pickup || 0,
          released: released || 0,
          users: staffCount || 0
        });
      } catch (err) {
        console.error("Dashboard Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    }
    getStats();
  }, [userRole, userBranchId]);

  const StatBox = ({ title, val, icon, color }) => (
    <Paper sx={{ p: 3, bgcolor: '#0f172a', color: 'white', borderBottom: `4px solid ${color}`, height: '100%', borderRadius: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="overline" sx={{ opacity: 0.7, fontWeight: 'bold' }}>{title}</Typography>
          <Typography variant="h3" fontWeight="900">
            {loading ? <CircularProgress size={30} sx={{ color: color }} /> : val.toLocaleString()}
          </Typography>
        </Box>
        {icon}
      </Box>
    </Paper>
  );

  return (
    <Box sx={{ p: 1 }}>
      {/* HEADER SECTION */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="900" color="white" gutterBottom>
          LTO PLATE TRACKER SYSTEM
        </Typography>
        <Typography variant="body1" sx={{ color: '#94a3b8' }}>
          Welcome back, <strong>{adminName?.toUpperCase()}</strong>. 
          Currently logged in as {userRole === 1 ? 'Super Administrator' : 'Staff Personnel'}.
        </Typography>
      </Box>

      {/* STAT CARDS */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={userRole === 1 ? 3 : 4}>
          <StatBox 
            title="Total Inventory" 
            val={counts.total} 
            icon={<DirectionsCar sx={{ fontSize: 45, color: '#3b82f6' }} />} 
            color="#3b82f6" 
          />
        </Grid>
        
        <Grid item xs={12} md={userRole === 1 ? 3 : 4}>
          <StatBox 
            title="For Pick-up" 
            val={counts.pickup} 
            icon={<FactCheck sx={{ fontSize: 45, color: '#10b981' }} />} 
            color="#10b981" 
          />
        </Grid>

        <Grid item xs={12} md={userRole === 1 ? 3 : 4}>
          <StatBox 
            title="Released to Dealer" 
            val={counts.released} 
            icon={<LocalShipping sx={{ fontSize: 45, color: '#f59e0b' }} />} 
            color="#f59e0b" 
          />
        </Grid>

        {userRole === 1 && (
          <Grid item xs={12} md={3}>
            <StatBox 
              title="System Users" 
              val={counts.users} 
              icon={<Group sx={{ fontSize: 45, color: '#8b5cf6' }} />} 
              color="#8b5cf6" 
            />
          </Grid>
        )}
      </Grid>

      {/* QUICK ACTIONS SECTION */}
      <Typography variant="h6" color="white" fontWeight="bold" sx={{ mb: 2 }}>QUICK ACTIONS</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <Button 
            fullWidth 
            variant="contained" 
            startIcon={<Add />} 
            onClick={() => navigate('/admin/manage')}
            sx={{ py: 2, bgcolor: '#3b82f6', fontWeight: 'bold', '&:hover': { bgcolor: '#2563eb' } }}
          >
            Manage Inventory
          </Button>
        </Grid>
      </Grid>

      <Divider sx={{ my: 4, borderColor: '#1e293b' }} />
    </Box>
  );
}