import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import App from './App';
import './index.css';

// --- Console Protection (Self-XSS Warning) ---
const styleWarning = "color: red; font-family: sans-serif; font-size: 4em; font-weight: bolder; text-shadow: #000 1px 1px;";
const styleMessage = "font-family: sans-serif; font-size: 1.2em; font-weight: bold; color: black;";

console.log("%cStop!", styleWarning);
console.log(
  "%cThis is a browser feature intended for developers.",
  styleMessage
);

// Handling the "unload" violation by using the modern visibilitychange event
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    // This is the modern way to handle logic when a user leaves the page
  }
});

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
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);