import { useState, useEffect } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, Button, 
  Box, Typography, CircularProgress, Stack, Alert, IconButton,
  Paper, Skeleton, Divider
} from '@mui/material';
import { 
  Policy, Close, CheckCircle, DeleteForever, 
  ImageNotSupported, Badge, Email, Phone, DriveEta, Description
} from '@mui/icons-material';
import { supabase } from '../lib/supabase';

export default function NoPlateDetailsModal({ plate, onClose, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [imgLoading, setImgLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [request, setRequest] = useState(null);
  const [urls, setUrls] = useState({ owner_id: '', or: '', cr: '', deed: '' });
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (plate) {
      fetchAuthData();
    } else {
      setRequest(null);
      setUrls({ owner_id: '', or: '', cr: '', deed: '' });
    }
  }, [plate]);

  const getSecureLink = async (path) => {
    if (!path || path === 'null' || path === '') return '';
    try {
      const filePath = path.includes('auth_request/') ? path.split('auth_request/').pop() : path;
      const { data, error } = await supabase.storage
        .from('auth_request')
        .createSignedUrl(filePath, 3600);
      if (error) throw error;
      return data?.signedUrl || '';
    } catch (err) { 
      console.error("Storage Error:", err.message);
      return ''; 
    }
  };

  const fetchAuthData = async () => {
    setLoading(true);
    setImgLoading(true);
    try {
      const { data, error } = await supabase
        .from('authorization_requests')
        .select('*')
        .eq('plate_number', plate.id.toString()) 
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setRequest(data);
        const [id, or, cr, deed] = await Promise.all([
          getSecureLink(data.owner_id_url),
          getSecureLink(data.or_url),
          getSecureLink(data.cr_url),
          getSecureLink(data.deed_of_sale_url)
        ]);
        
        setUrls({ owner_id: id, or, cr, deed });
      } else {
        setRequest(null);
      }
    } catch (err) { 
      console.error("Link Logic Error:", err.message); 
    } finally { 
      setLoading(false); 
      setImgLoading(false);
    }
  };

  const handleAction = async (type) => {
    const isApprove = type === 'approve';
    const message = isApprove 
      ? "Verify plate and archive request?" 
      : "Reject documents? This will permanently delete the uploaded images and the request data.";
    
    if (!window.confirm(message)) return;
    
    setActionLoading(true);
    try {
      if (isApprove) {
        // APPROVE LOGIC
        const { error: plateErr } = await supabase.from('no_plates').update({ status: 2 }).eq('id', plate.id);
        if (plateErr) throw plateErr;

        const { error: authErr } = await supabase.from('authorization_requests').delete().eq('id', request.id);
        if (authErr) throw authErr;

      } else {
        // REJECT & DELETE FILES LOGIC
        // 1. Identify the folder name (usually the plate number sanitized)
        // We extract the folder from one of the existing file paths in the DB
        const samplePath = request.owner_id_url; 
        const folderPath = samplePath.split('/')[0]; // Gets the "ABC_123" part

        if (folderPath) {
          // 2. List all files in that folder
          const { data: files, error: listError } = await supabase.storage
            .from('auth_request')
            .list(folderPath);

          if (listError) console.error("Could not list files for deletion:", listError);

          if (files && files.length > 0) {
            // 3. Map files to their full paths and delete
            const filesToDelete = files.map((file) => `${folderPath}/${file.name}`);
            const { error: deleteStorageError } = await supabase.storage
              .from('auth_request')
              .remove(filesToDelete);
            
            if (deleteStorageError) throw deleteStorageError;
          }
        }

        // 4. Update main plate status back to 0 (Unverified/Available)
        const { error: plateErr } = await supabase.from('no_plates').update({ status: 0 }).eq('id', plate.id);
        if (plateErr) throw plateErr;

        // 5. Delete the database record
        const { error: authErr } = await supabase.from('authorization_requests').delete().eq('id', request.id);
        if (authErr) throw authErr;
      }

      onRefresh();
      onClose();
    } catch (err) { 
      console.error("Action Error:", err);
      alert("Error: " + err.message); 
    } finally { 
      setActionLoading(false); 
    }
  };

  if (!plate) return null;

  return (
    <>
      <Dialog 
        open={!!plate} 
        onClose={() => !actionLoading && onClose()} 
        maxWidth="md" 
        fullWidth 
        PaperProps={{ sx: { bgcolor: '#020617', color: 'white', border: '1px solid #1e293b', borderRadius: 3 } }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Policy sx={{ color: '#3b82f6', fontSize: 28 }} />
            <Typography variant="h5" fontWeight={900} sx={{ letterSpacing: -0.5 }}>DOCUMENT VERIFICATION</Typography>
          </Stack>
          <IconButton onClick={onClose} sx={{ color: 'white' }}><Close /></IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 4 }}>
          {loading ? (
            <Stack alignItems="center" py={8}><CircularProgress color="primary" /></Stack>
          ) : request ? (
            <Box>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 4 }}>
                <Box sx={{ flex: 1 }}>
                  <Paper sx={{ p: 2.5, height: '100%', bgcolor: '#0f172a', border: '1px solid #1e293b', borderRadius: 2 }}>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <DriveEta sx={{ fontSize: 14 }} /> PLATE NUMBER
                        </Typography>
                        <Typography variant="h4" fontWeight={900} color="#ef4444" sx={{ fontFamily: 'monospace' }}>
                          {plate.plate_number}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Description sx={{ fontSize: 14 }} /> MV FILE NUMBER
                        </Typography>
                        <Typography variant="h6" fontWeight={700} sx={{ color: 'white', opacity: 0.9 }}>
                          {plate.mv_file || 'N/A'}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                </Box>

                <Box sx={{ flex: 1 }}>
                  <Paper sx={{ p: 2.5, height: '100%', bgcolor: '#0f172a', border: '1px solid #1e293b', borderRadius: 2 }}>
                    <Stack spacing={1.5}>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Badge sx={{ fontSize: 14 }} /> FULL NAME
                        </Typography>
                        <Typography variant="h6" fontWeight={800} color="white">{request.full_name}</Typography>
                      </Box>
                      <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />
                      <Stack direction="row" spacing={3}>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Phone sx={{ fontSize: 14 }} /> CONTACT
                          </Typography>
                          <Typography variant="body2" fontWeight={700}>{request.contact_number || '---'}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Email sx={{ fontSize: 14 }} /> EMAIL
                          </Typography>
                          <Typography variant="body2" fontWeight={700}>{request.email || '---'}</Typography>
                        </Box>
                      </Stack>
                    </Stack>
                  </Paper>
                </Box>
              </Box>
              
              <Typography variant="overline" sx={{ color: '#3b82f6', fontWeight: 900, mb: 1, display: 'block', letterSpacing: 1 }}>SUBMITTED EVIDENCE</Typography>
              
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, flexWrap: 'wrap', gap: 2 }}>
                {[
                  { label: 'Government ID', url: urls.owner_id },
                  { label: 'Official Receipt', url: urls.or },
                  { label: 'Certificate (CR)', url: urls.cr },
                  { label: 'Deed of Sale', url: urls.deed }
                ].map((doc, i) => (
                  <Box key={i} sx={{ width: { xs: '100%', sm: '23%' }, flexGrow: 1 }}>
                    <Box 
                      onClick={() => doc.url && setPreview(doc.url)} 
                      sx={{ 
                        height: 140, bgcolor: '#0f172a', border: '2px solid #1e293b', borderRadius: 2.5, 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        cursor: doc.url ? 'pointer' : 'default', overflow: 'hidden', 
                        transition: '0.2s', '&:hover': doc.url ? { borderColor: '#3b82f6', transform: 'translateY(-4px)' } : {} 
                      }}
                    >
                      {imgLoading ? (
                        <Skeleton variant="rectangular" width="100%" height="100%" sx={{ bgcolor: '#1e293b' }} />
                      ) : doc.url ? (
                        <img src={doc.url} alt={doc.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <ImageNotSupported sx={{ color: '#1e293b', fontSize: 32 }} />
                      )}
                    </Box>
                    <Typography variant="caption" align="center" display="block" sx={{ mt: 1, fontWeight: 700, color: '#64748b' }}>{doc.label}</Typography>
                  </Box>
                ))}
              </Box>

            </Box>
          ) : (
            <Alert severity="warning" variant="outlined" sx={{ border: '1px solid #f59e0b', color: '#f59e0b', fontWeight: 700 }}>
              No authorization documents have been uploaded for Registry ID #{plate?.id} yet.
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 4, borderTop: '1px solid #1e293b', gap: 1 }}>
          <Button onClick={onClose} sx={{ color: 'white', fontWeight: 700 }}>CANCEL</Button>
          {request && (
            <Stack direction="row" spacing={2}>
              <Button 
                variant="outlined" 
                color="error" 
                startIcon={<DeleteForever />} 
                onClick={() => handleAction('reject')} 
                disabled={actionLoading}
                sx={{ borderRadius: 2, fontWeight: 800, borderSize: 2 }}
              >
                {actionLoading ? "PROCESSING..." : "REJECT & DELETE"}
              </Button>
              <Button 
                variant="contained" 
                color="primary" 
                startIcon={<CheckCircle />} 
                onClick={() => handleAction('approve')} 
                disabled={actionLoading}
                sx={{ borderRadius: 2, px: 4, fontWeight: 900, bgcolor: '#3b82f6' }}
              >
                {actionLoading ? "PROCESSING..." : "APPROVE & VERIFY"}
              </Button>
            </Stack>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth="lg">
        <Box sx={{ position: 'relative', bgcolor: 'black', p: 1 }}>
          <IconButton 
            onClick={() => setPreview(null)} 
            sx={{ position: 'absolute', right: 15, top: 15, bgcolor: '#ef4444', color: 'white', '&:hover': { bgcolor: '#dc2626' }, zIndex: 10 }}
          >
            <Close />
          </IconButton>
          <img src={preview} alt="Document Preview" style={{ maxWidth: '100%', maxHeight: '92vh', display: 'block', borderRadius: '4px' }} />
        </Box>
      </Dialog>
    </>
  );
}