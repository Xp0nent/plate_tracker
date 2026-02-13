import { useState, useEffect } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, Button, 
  TextField, Stack, Typography, IconButton 
} from '@mui/material';
import { Save, ManageAccounts, Close } from '@mui/icons-material';
import { supabase } from '../lib/supabase';

export default function NoPlateEditModal({ plate, onClose, onRefresh }) {
  const [form, setForm] = useState({ plate_number: '', mv_file: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (plate) {
      setForm({
        plate_number: plate.plate_number || '',
        mv_file: plate.mv_file || '',
      });
    }
  }, [plate]);

  const handleSave = async () => {
    if (!form.plate_number) return alert("Plate ID is required");
    setLoading(true);
    try {
      const { error } = await supabase
        .from('no_plates')
        .update({
          plate_number: form.plate_number.toUpperCase().trim(),
          mv_file: form.mv_file.toUpperCase().trim(),
        })
        .eq('id', plate.id);

      if (error) throw error;
      onRefresh();
      onClose();
    } catch (err) { 
      alert("Update failed: " + err.message); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <Dialog 
      open={!!plate} 
      onClose={onClose} 
      PaperProps={{ 
        sx: { 
          bgcolor: '#020617', 
          color: 'white', 
          border: '1px solid #1e293b', 
          borderRadius: 3 
        } 
      }}
    >
      <DialogTitle sx={{ borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <ManageAccounts color="error" />
          <Typography variant="h6" fontWeight={900}>REGISTRY EDITOR</Typography>
        </Stack>
        <IconButton onClick={onClose} sx={{ color: 'white' }}><Close /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3, mt: 1, minWidth: 380 }}>
        <Stack spacing={3}>
          <Typography variant="body2" color="gray">
            Update core identification data for System ID: <b>#{plate?.id}</b>
          </Typography>
          
          <TextField 
            label="Plate Number" 
            fullWidth 
            value={form.plate_number} 
            onChange={(e) => setForm({...form, plate_number: e.target.value})} 
            sx={{ 
              mt: 1, 
              input: { color: 'white', fontFamily: 'monospace', fontWeight: 700 }, 
              '& .MuiInputLabel-root': { color: '#94a3b8' }, 
              '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#1e293b' } } 
            }} 
          />

          <TextField 
            label="MV File Number" 
            fullWidth 
            value={form.mv_file} 
            onChange={(e) => setForm({...form, mv_file: e.target.value})} 
            sx={{ 
              input: { color: 'white' }, 
              '& .MuiInputLabel-root': { color: '#94a3b8' }, 
              '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#1e293b' } } 
            }} 
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: '1px solid #1e293b' }}>
        <Button onClick={onClose} sx={{ color: 'white' }}>CANCEL</Button>
        <Button 
          variant="contained" 
          color="error" 
          onClick={handleSave} 
          disabled={loading} 
          startIcon={<Save />} 
          sx={{ fontWeight: 900, px: 3 }}
        >
          SAVE CHANGES
        </Button>
      </DialogActions>
    </Dialog>
  );
}