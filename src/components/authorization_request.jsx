import React, { useState, useEffect } from 'react';
import { 
  Box, Container, Typography, Paper, Divider, TextField, 
  Grid, Button, Tooltip, IconButton, CircularProgress 
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from '@mui/icons-material/Close';
import AssignmentIcon from '@mui/icons-material/Assignment';
import BadgeIcon from '@mui/icons-material/Badge';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { supabase } from '../supabaseClient'; 
import { decryptData } from '../utils/crypto'; // Import the decryption helper

export default function AuthorizationRequest() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // URL PARSING - We now look for 'token' instead of 'id'
  const queryParams = new URLSearchParams(location.search);
  const token = queryParams.get('token');

  // STATE FOR VERIFICATION
  const [verifying, setVerifying] = useState(true);
  const [verifiedId, setVerifiedId] = useState(null); // Store the decrypted ID
  const [verifiedPlate, setVerifiedPlate] = useState('');
  const [dbError, setDbError] = useState(null);

  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    contactNumber: '',
    email: '',
  });

  const [files, setFiles] = useState({
    ownerID: null,
    or: null,
    cr: null,
    deedOfSale: null
  });

  // SECURE VERIFICATION: Decrypt token then check Database
  useEffect(() => {
    const verifySecureToken = async () => {
      if (!token) {
        setDbError("Invalid access. Security token is missing.");
        setVerifying(false);
        return;
      }

      // 1. Decrypt the token to get the actual ID
      const decrypted = decryptData(token);
      
      if (!decrypted || !decrypted.id) {
        setDbError("Invalid or corrupted security token.");
        setVerifying(false);
        return;
      }

      // 2. Verify the decrypted ID against the Database
      try {
        const { data, error } = await supabase
          .from('no_plates')
          .select('plate_number, mv_file')
          .eq('id', decrypted.id)
          .single();

        if (error || !data) {
          throw new Error("Plate record not found in our system.");
        }

        // Token is valid AND record exists
        setVerifiedId(decrypted.id);
        setVerifiedPlate(data.plate_number || data.mv_file);
      } catch (err) {
        setDbError(err.message);
      } finally {
        setVerifying(false);
      }
    };

    verifySecureToken();
  }, [token]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (name, file) => {
    setFiles({ ...files, [name]: file });
  };

  const handleCancel = () => {
    navigate('/', { replace: true });
  };

  const uploadToStorage = async (bucket, folder, file, typeLabel) => {
    if (!file) return null;
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${typeLabel}_${Date.now()}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (err) {
      throw new Error(`Storage Error (${typeLabel}): ${err.message}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!files.ownerID || !files.or || !files.cr) {
      alert("Please upload the required ID, OR, and CR documents.");
      return;
    }

    setLoading(true);

    try {
      const bucketName = 'auth_request'; 
      const folderName = verifiedPlate.trim().replace(/\s+/g, '_');

      // Upload files to Supabase Storage
      const [idUrl, orUrl, crUrl, deedUrl] = await Promise.all([
        uploadToStorage(bucketName, folderName, files.ownerID, 'OWNER_ID'),
        uploadToStorage(bucketName, folderName, files.or, 'OR_DOC'),
        uploadToStorage(bucketName, folderName, files.cr, 'CR_DOC'),
        uploadToStorage(bucketName, folderName, files.deedOfSale, 'DEED_OF_SALE')
      ]);

      // Insert record using the VERIFIED ID (from decrypted token)
      const { error: insertError } = await supabase
        .from('authorization_requests')
        .insert([{
          plate_number: verifiedId, 
          full_name: formData.fullName,
          contact_number: formData.contactNumber,
          email: formData.email,
          owner_id_url: idUrl,
          or_url: orUrl,
          cr_url: crUrl,
          deed_of_sale_url: deedUrl,
          status: 1 
        }]);

      if (insertError) throw new Error(`Database Error: ${insertError.message}`);

      // Update the status in the main table to "Under Review"
      const { error: updateError } = await supabase
        .from('no_plates')
        .update({ status: 1 })
        .eq('id', verifiedId);

      if (updateError) throw new Error(`Update Error: ${updateError.message}`);

      setIsSuccess(true);
    } catch (error) {
      console.error("Submission Error:", error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    '& .MuiOutlinedInput-root': {
      color: 'white',
      bgcolor: '#1e293b', 
      borderRadius: 2,
      '& fieldset': { borderColor: '#334155' },
      '&:hover fieldset': { borderColor: '#3b82f6' },
      '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
    },
    '& .MuiInputLabel-root': { color: '#94a3b8', fontSize: '0.9rem' },
  };

  // 1. Loading State (Decryption & DB Verification in progress)
  if (verifying) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#020617', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress sx={{ color: '#3b82f6', mb: 2 }} />
        <Typography sx={{ color: '#94a3b8', fontWeight: 700 }}>SECURELY VERIFYING RECORD...</Typography>
      </Box>
    );
  }

  // 2. Error State (Tampered token or non-existent record)
  if (dbError) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Paper sx={{ p: 4, bgcolor: '#0f172a', textAlign: 'center', borderRadius: 4, border: '1px solid #ef4444', maxWidth: 400 }}>
          <WarningAmberIcon sx={{ color: '#ef4444', fontSize: '4rem', mb: 2 }} />
          <Typography variant="h6" sx={{ color: 'white', mb: 1 }}>ACCESS DENIED</Typography>
          <Typography sx={{ color: '#94a3b8', mb: 3 }}>{dbError}</Typography>
          <Button variant="contained" onClick={() => navigate('/')} fullWidth>RETURN TO SEARCH</Button>
        </Paper>
      </Box>
    );
  }

  // 3. Success State
  if (isSuccess) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Paper 
            elevation={0} 
            sx={{ 
                p: { xs: 4, md: 6 }, 
                bgcolor: '#0f172a', 
                borderRadius: 8, 
                textAlign: 'center', 
                border: '1px solid #1e293b',
                maxWidth: 550,
                width: '100%',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
            }}
        >
          <CheckCircleOutlineIcon sx={{ fontSize: '5rem', color: '#4ade80', mb: 3 }} />
          <Typography variant="h4" sx={{ color: 'white', fontWeight: 900, mb: 1, letterSpacing: '-0.02em' }}>
            SUBMISSION SUCCESSFUL
          </Typography>
          <Divider sx={{ my: 3, borderColor: '#1e293b', width: '60%', mx: 'auto' }} />
          <Typography sx={{ color: '#f1f5f9', fontSize: '1.1rem', mb: 2, lineHeight: 1.6 }}>
            Thank you for submitting your request for plate <strong style={{ color: '#3b82f6' }}>{verifiedPlate}</strong>.
          </Typography>
                    <Typography sx={{ color: '#f1f5f9', fontSize: '1.1rem', mb: 2, lineHeight: 1.6 }}>
                      Our team will verify the provided details. Once approve we will email the official authorization to use improvise plate to your email.
          </Typography>

          <Button 
            fullWidth variant="contained" size="large" onClick={() => navigate('/', { replace: true })}
            sx={{ py: 2, borderRadius: 3, fontWeight: 900, bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' } }}
          >
            RETURN TO HOME
          </Button>
        </Paper>
      </Box>
    );
  }

  // 4. Main Form UI
  return (
    <Box sx={{ width: '100%', minHeight: '100vh', bgcolor: '#020617' }}>
      <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button 
            disabled={loading}
            onClick={handleCancel}
            startIcon={<ArrowBackIosNewIcon sx={{ fontSize: '0.8rem !important' }} />}
            sx={{ color: '#94a3b8', fontWeight: 700, textTransform: 'none', '&:hover': { color: 'white' } }}
          >
            Cancel Request
          </Button>
          <IconButton disabled={loading} onClick={handleCancel} sx={{ color: '#475569', '&:hover': { color: '#ef4444' } }}>
            <CloseIcon />
          </IconButton>
        </Box>

        <Paper 
          component="form"
          onSubmit={handleSubmit}
          elevation={0}
          sx={{ 
            p: { xs: 3, md: 6 }, 
            bgcolor: '#0f172a', 
            borderRadius: 5, 
            border: '1px solid #1e293b',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
          }}
        >
          <Box sx={{ mb: 5 }}>
            <Typography variant="h4" sx={{ fontWeight: 900, color: 'white', mb: 1 }}>
              AUTHORIZATION <span style={{ color: '#3b82f6' }}>REQUEST</span>
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <FingerprintIcon sx={{ color: '#64748b', fontSize: '1.1rem' }} />
              <Typography sx={{ color: '#64748b', fontSize: '0.95rem' }}>Plate Reference:</Typography>
              <Typography sx={{ 
                bgcolor: '#1e293b', color: '#3b82f6', px: 1.5, py: 0.5, 
                borderRadius: 1, fontFamily: 'monospace', fontWeight: 700, border: '1px solid #334155'
              }}>
                {verifiedPlate}
              </Typography>
            </Box>
          </Box>

          <Grid container spacing={4}>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Typography variant="subtitle2" sx={{ color: '#3b82f6', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  01. Owner Details
                </Typography>
                <Divider sx={{ flexGrow: 1, borderColor: '#1e293b' }} />
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField fullWidth label="Full Name (as per OR/CR)" name="fullName" required sx={inputStyle} onChange={handleChange} disabled={loading} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Contact Number" name="contactNumber" required sx={inputStyle} onChange={handleChange} disabled={loading} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Email Address" name="email" type="email" required sx={inputStyle} onChange={handleChange} disabled={loading} />
                </Grid>
              </Grid>
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Typography variant="subtitle2" sx={{ color: '#3b82f6', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  02. Required Documents
                </Typography>
                <Divider sx={{ flexGrow: 1, borderColor: '#1e293b' }} />
                <Tooltip title="Clear photos are required for verification.">
                  <InfoIcon sx={{ color: '#475569', fontSize: '1.2rem' }} />
                </Tooltip>
              </Box>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <UploadBox 
                    title="Registered Owner's ID" 
                    sub="Gov Issued ID" 
                    icon={<BadgeIcon sx={{ color: '#3b82f6', fontSize: '2.2rem', mb: 1 }} />}
                    onFileSelect={(file) => handleFileChange('ownerID', file)}
                    disabled={loading}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <UploadBox title="Official Receipt (OR)" sub="Payment proof" onFileSelect={(file) => handleFileChange('or', file)} disabled={loading} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <UploadBox title="Cert. of Reg. (CR)" sub="Ownership proof" onFileSelect={(file) => handleFileChange('cr', file)} disabled={loading} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <UploadBox 
                    title="Deed of Sale" 
                    sub="Optional" 
                    icon={<AssignmentIcon sx={{ color: '#3b82f6', fontSize: '2.2rem', mb: 1 }} />}
                    onFileSelect={(file) => handleFileChange('deedOfSale', file)}
                    disabled={loading}
                  />
                </Grid>
              </Grid>
            </Grid>

            <Grid item xs={12} sx={{ mt: 2 }}>
              <Button 
                fullWidth type="submit" variant="contained" size="large" disabled={loading}
                sx={{ py: 2.5, borderRadius: 3, fontWeight: 900, bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' } }}
              >
                {loading ? <CircularProgress size={24} sx={{ color: 'white' }} /> : "Submit Authorization Request"}
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Container>
    </Box>
  );
}

// Sub-component for File Uploads
function UploadBox({ title, sub, icon, onFileSelect, disabled }) {
  const [fileName, setFileName] = useState('');
  const handleFileChangeLocal = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileName(file.name);
      onFileSelect(file);
    }
  };

  return (
    <Box 
      component="label"
      sx={{ 
        p: 3, height: '100%', border: '2px dashed',
        borderColor: fileName ? '#4ade80' : '#334155', 
        borderRadius: 4, textAlign: 'center', bgcolor: '#020617',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.2s ease',
        '&:hover': { borderColor: disabled ? '#334155' : '#3b82f6', bgcolor: disabled ? '#020617' : '#1e293b' }
      }}
    >
      <input type="file" hidden onChange={handleFileChangeLocal} accept="image/*,.pdf" disabled={disabled} />
      {fileName ? (
        <Box sx={{ color: '#4ade80' }}>
          <CloudUploadIcon sx={{ fontSize: '2.2rem', mb: 1 }} />
          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>FILE READY</Typography>
          <Typography sx={{ fontSize: '0.7rem', opacity: 0.8, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fileName}
          </Typography>
        </Box>
      ) : (
        <>
          {icon ? icon : <CloudUploadIcon sx={{ color: '#3b82f6', fontSize: '2.2rem', mb: 1 }} />}
          <Typography sx={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>{title}</Typography>
          <Typography sx={{ color: '#64748b', fontSize: '0.7rem', mt: 0.5 }}>{sub}</Typography>
        </>
      )}
    </Box>
  );
}