import React, { useEffect, useState } from 'react';
import { Box, Typography, Divider, Modal, Backdrop, Fade } from '@mui/material';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Description from '../../components/Description';
import AuthorizationRequest from '../../components/authorization_request'; 

export default function Home() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Check URL for ?showAuth=true
  const showAuth = searchParams.get('showAuth') === 'true';
  const plateFromUrl = searchParams.get('plate') || '';

  // Function to close modal by clearing URL params
  const handleClose = () => {
    navigate('/', { replace: true });
  };

  return (
    <Box>
      {/* 1. ALWAYS SHOW DESCRIPTION ON THE PAGE */}
      <Box sx={{ mb: { xs: 6, md: 8 }, textAlign: 'center' }}>
        <Typography variant="h6" sx={{ color: '#3b82f6', fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase', mb: 1 }}>
          Tracking Process
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', maxWidth: '500px', mx: 'auto' }}>
          Easily Locate Your Plate.
        </Typography>
        <Divider sx={{ mt: 3, width: '40px', height: '3px', bgcolor: '#3b82f6', mx: 'auto', border: 'none' }} />
      </Box>
      
      <Description />

      {/* 2. THE MODAL (Authorization Form) */}
    <Modal
  open={showAuth}
  onClose={handleClose}
  closeAfterTransition
  // This slotProps section is the key to removing transparency
  slotProps={{
    backdrop: {
      sx: { 
        // Use a solid color (no 'alpha' or 'rgba')
        backgroundColor: '#020617', 
        opacity: '1 !important', // Forces 100% solid coverage
      }
    }
  }}
  sx={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    p: { xs: 0, md: 2 } // No padding on mobile for full-screen feel
  }}
>
  <Fade in={showAuth}>
    <Box sx={{ 
      width: '100%', 
      maxWidth: 'md', 
      maxHeight: '100vh', 
      overflowY: 'auto', 
      outline: 'none',
      bgcolor: '#020617', // Match backdrop to prevent flickering
      scrollbarWidth: 'thin',
      '&::-webkit-scrollbar': { width: '6px' },
      '&::-webkit-scrollbar-thumb': { bgcolor: '#3b82f6', borderRadius: '10px' }
    }}>
      <AuthorizationRequest prefilledPlate={plateFromUrl} />
    </Box>
  </Fade>
</Modal>
    </Box>
  );
}