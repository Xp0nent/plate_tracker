import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';

export default function Description() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Define reusable styles to keep JSX clean
  const containerStyle = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
    zIndex: 2
  };

  const imageBoxStyle = {
    position: 'relative',
    zIndex: 10,
    padding: '6px',
    borderRadius: '50%',
    bgcolor: '#0f172a', // slate-900
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  };

  const imageStyle = {
    height: isMobile ? 80 : 144,
    width: isMobile ? 80 : 144,
    objectFit: 'cover',
    borderRadius: '50%',
    border: '2px solid #020617', // slate-950
  };

  const titleStyle = {
    mt: 3,
    color: '#3b82f6', // blue-400
    fontWeight: 900,
    letterSpacing: '0.2em',
    fontSize: { xs: '10px', lg: '11px' },
    textTransform: 'uppercase',
  };

  const descStyle = {
    mt: 1.5,
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: { xs: '9px', lg: '10px' },
    lineHeight: 1.6,
    maxWidth: '160px',
    textTransform: 'uppercase',
    fontWeight: 500,
  };

  return (
    <Box 
      sx={{ 
        position: 'relative', 
        width: '100%', 
        py: { xs: 8, lg: 12 }, 
        bgcolor: 'rgba(2, 6, 23, 0.2)', // slate-950/20
        backdropFilter: 'blur(24px)', 
        borderRadius: '3rem', 
        border: '1px solid rgba(255, 255, 255, 0.05)', 
        boxShadow: 24, 
        overflow: 'hidden' 
      }}
    >
      
      {/* STATIC HORIZONTAL CONNECTORS (SVG) */}
      {!isMobile && (
        <Box 
          sx={{ 
            position: 'absolute', 
            inset: 0, 
            pointerEvents: 'none', 
            zIndex: 0 
          }}
        >
          <svg width="100%" height="100%" fill="none">
            <line 
              x1="15%" y1="40%" x2="85%" y2="40%" 
              stroke="#3b82f6" 
              strokeWidth="1" 
              strokeDasharray="8 12" 
              opacity="0.2"
            />
          </svg>
        </Box>
      )}

      <Box 
        sx={{ 
          position: 'relative', 
          zIndex: 10, 
          display: 'flex', 
          flexDirection: { xs: 'column', md: 'row' }, 
          alignItems: { xs: 'center', md: 'flex-start' }, 
          justifyContent: 'space-between', 
          px: 4, 
          gap: { xs: 8, md: 1 } 
        }}
      >
        
        {/* STAGE 01 */}
        <Box sx={containerStyle}>
          <Box sx={imageBoxStyle}>
            <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(59, 130, 246, 0.05)', borderRadius: '50%', filter: 'blur(20px)' }} />
            <Box component="img" src="/1.png" alt="1" sx={imageStyle} />
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={titleStyle}>01. LTO PERSONNEL</Typography>
            <Typography sx={descStyle}>ENCODES THE DATA OF THE PLATES INTO THE SYSTEM.</Typography>
          </Box>
        </Box>

        {/* STAGE 02 */}
        <Box sx={containerStyle}>
          <Box sx={imageBoxStyle}>
            <Box component="img" src="/2.png" alt="2" sx={imageStyle} />
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ ...titleStyle, color: 'rgba(255, 255, 255, 0.7)' }}>02. LTO OFFICE</Typography>
            <Typography sx={descStyle}>Indicates which LTO office currently holds the plate.</Typography>
          </Box>
        </Box>

        {/* STAGE 03 */}
        <Box sx={containerStyle}>
          <Box sx={imageBoxStyle}>
            <Box component="img" src="/3.png" alt="3" sx={imageStyle} />
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ ...titleStyle, color: 'rgba(255, 255, 255, 0.7)' }}>03. DEALER</Typography>
            <Typography sx={descStyle}>See the current location of the plate and which dealer it was released to.</Typography>
          </Box>
        </Box>

        {/* STAGE 04 */}
        <Box sx={containerStyle}>
          <Box sx={{ ...imageBoxStyle, borderColor: 'rgba(59, 130, 246, 0.4)' }}>
            <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%', filter: 'blur(30px)' }} />
            <Box component="img" src="/4.png" alt="4" sx={imageStyle} />
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ ...titleStyle, color: '#fff' }}>04. LOCATION RECORD</Typography>
            <Typography 
              sx={{ 
                ...descStyle, 
                color: 'rgba(147, 197, 253, 0.6)', // blue-300/60
                fontWeight: 700 
              }}
            >
              PLATE LOCATION STATUS SHOWN ON SYSTEM.
            </Typography>
          </Box>
        </Box>

      </Box>
    </Box>
  );
}