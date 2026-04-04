import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Styles — order matters
import './styles/tokens.css';
import './styles/globals.css';
import './styles/components.css';
import './styles/layout.css';

import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
