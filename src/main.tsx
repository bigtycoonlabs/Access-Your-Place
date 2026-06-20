import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeCapacitor } from './lib/capacitor';

// Initialize error tracking service early to capture all edge function errors
// This monkey-patches supabase.functions.invoke to automatically track failures
import './services/ErrorTrackingService';

// Initialize Capacitor for native platforms
initializeCapacitor().then(() => {
  console.log('[App] Capacitor initialized, rendering app...');
}).catch((err) => {
  console.warn('[App] Capacitor init warning:', err);
});

// Render the app
createRoot(document.getElementById("root")!).render(<App />);
