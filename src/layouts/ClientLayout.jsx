import { Box, Container, Typography } from '@mui/material';
import { Outlet } from 'react-router-dom';
import SearchForm from '../components/SearchForm';

export default function ClientLayout() {
  return (
    <Box sx={{ width: '100%', minHeight: '100vh', bgcolor: '#020617', display: 'flex', flexDirection: 'column' }}>
      
      {/* SECTION 1: HERO & SEARCH AREA */}
      <Box 
        component="section"
        sx={{ 
          width: '100%', 
          // Changed from fixed height to min-height to allow expansion for results
          minHeight: '100vh', 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
          py: { xs: 8, md: 12 }, // Added padding for expansion space
        }}
      >
        {/* BACKGROUND LAYER */}
        <Box 
          component="img"
          src="/hero.jpg" 
          sx={{ 
            position: 'absolute',
            inset: 0,
            width: '100%', 
            height: '100%', 
            objectFit: 'cover', 
            filter: 'blur(2px) brightness(0.35)', 
            transform: 'scale(1.05)',
            zIndex: 0
          }}
        />

        {/* VIGNETTE OVERLAY */}
        <Box 
          sx={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(circle, rgba(2,6,23,0) 0%, rgba(2,6,23,0.9) 100%)',
            zIndex: 1
          }}
        />
        
        {/* MAIN BRANDING CONTENT */}
        <Box sx={{ position: 'relative', zIndex: 2, textAlign: 'center', width: '100%', maxWidth: '1200px', px: 3 }}>
          
          {/* LOGO & TITLE GROUP */}
          <Box 
            sx={{ 
              display: 'flex', 
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: 'center', 
              justifyContent: 'center',
              gap: { xs: 2, md: 3 },
              mb: 3 
            }}
          >
            <Typography variant="h1" sx={{ fontWeight: 800, color: 'white', fontSize: { xs: '2.5rem', md: '3.8rem' }, letterSpacing: '-0.02em', lineHeight: 1 }}>
              PLATE
            </Typography>

            <Box 
              component="img"
              src="/logo.png"
              sx={{ 
                height: { xs: 60, md: 80 }, 
                width: 'auto',
                filter: 'drop-shadow(0 0 15px rgba(59, 130, 246, 0.3))',
                borderRadius: '50%',
                bgcolor: 'rgba(255,255,255,0.95)',
                p: 0.4,
              }}
            />

            <Typography variant="h1" sx={{ fontWeight: 800, color: '#3b82f6', fontSize: { xs: '2.5rem', md: '3.8rem' }, letterSpacing: '-0.02em', lineHeight: 1 }}>
              TRACKER
            </Typography>
          </Box>

          {/* SUBTITLE GROUP */}
          <Box sx={{ mb: 6 }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 800, letterSpacing: '0.4em', fontSize: { xs: '0.65rem', md: '0.75rem' }, textTransform: 'uppercase', mb: 0.5 }}>
              Land Transportation Office
            </Typography>
            <Typography sx={{ color: '#3b82f6', fontWeight: 800, letterSpacing: '0.8em', fontSize: { xs: '0.75rem', md: '0.9rem' }, textTransform: 'uppercase', mr: '-0.8em' }}>
              Region V
            </Typography>
          </Box>

          {/* SEARCH FORM CONTAINER - Widened slightly to fit the uniform results better */}
          <Box sx={{ width: '100%', maxWidth: '650px', mx: 'auto' }}>
            <SearchForm />
          </Box>
        </Box>

        {/* SCROLL HINT (Hidden on very short screens or when results expand) */}
        <Box sx={{ 
          position: 'absolute', 
          bottom: 30, 
          left: '50%', 
          transform: 'translateX(-50%)', 
          display: { xs: 'none', lg: 'flex' }, 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: 1, 
          opacity: 0.2, 
          zIndex: 2 
        }}>
          <Typography sx={{ color: 'white', fontSize: '0.6rem', letterSpacing: '2px', textTransform: 'uppercase' }}>Verify</Typography>
          <Box sx={{ width: '1px', height: '30px', background: 'linear-gradient(to bottom, white, transparent)' }} />
        </Box>
      </Box>

      {/* SECTION 2: ADDITIONAL CONTENT AREA */}
      <Box sx={{ py: { xs: 8, md: 10 }, bgcolor: '#020617', flexGrow: 1 }}>
        <Container maxWidth="md">
          <Outlet />
        </Container>
      </Box>

      {/* FOOTER */}
      <Box 
        component="footer" 
        sx={{ 
          py: 4, 
          bgcolor: '#010410', 
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          textAlign: 'center'
        }}
      >
        <Container maxWidth="lg">
          <Typography sx={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', fontSize: '0.7rem', fontWeight: 700 }}>
            © {new Date().getFullYear()} LTO REGION V • OFFICIAL PLATE TRACKER PORTAL
          </Typography>
        </Container>
      </Box>

    </Box>
  );
}