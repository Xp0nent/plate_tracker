import { Box, Typography, Divider } from '@mui/material';
import Description from '../../components/Description';

export default function Home() {
  return (
    <Box>
      {/* HEADER GROUP */}
      <Box sx={{ mb: { xs: 6, md: 8 }, textAlign: 'center' }}>
        <Typography 
          variant="h6" 
          component="h2" 
          sx={{ 
            color: '#3b82f6', // Matching your brand blue
            fontWeight: 800, 
            letterSpacing: '0.3em', // Professional "spaced" look
            fontSize: { xs: '0.8rem', md: '1rem' },
            textTransform: 'uppercase',
            mb: 1
          }}
        >
          Tracking Process
        </Typography>

        <Typography 
          variant="body2" 
          sx={{ 
            color: 'rgba(255, 255, 255, 0.5)', 
            maxWidth: '500px', 
            mx: 'auto',
            lineHeight: 1.6
          }}
        >
         Easily Locate Your Plate.
        </Typography>

        {/* ACCENT LINE */}
        <Divider 
          sx={{ 
            mt: 3, 
            width: '40px', 
            height: '3px', 
            bgcolor: '#3b82f6', 
            mx: 'auto',
            borderRadius: '2px',
            border: 'none'
          }} 
        />
      </Box>
       
      {/* CONTENT AREA */}
      <Description />
    </Box>
  );
}