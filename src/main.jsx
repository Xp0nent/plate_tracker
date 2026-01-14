import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'; // 1. Import this
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import App from './App';
import './index.css';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#3b82f6' },
    background: { default: '#020617', paper: '#0f172a' },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <BrowserRouter> {/* 2. Wrap App here */}
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);