import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { registerSW } from 'virtual:pwa-register';
import './styles.css';

// Nouvelle version en ligne → la page se recharge toute seule.
// On revérifie à chaque retour dans l'app (l'appli Android reste souvent ouverte en arrière-plan).
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => undefined);
    });
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
