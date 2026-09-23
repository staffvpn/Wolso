import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { bootstrapTelegram } from './lib/telegram';
import { applyThemeAttribute, getStoredTheme } from './lib/theme';

// Before anything renders, so there's no flash of the other theme.
applyThemeAttribute(getStoredTheme());
bootstrapTelegram();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
