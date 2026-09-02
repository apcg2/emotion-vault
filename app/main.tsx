import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Home from './page';
import DemoDataPage from './demo-data/page';
import './globals.css';

function App() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const changed = () => setHash(window.location.hash);
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  // Hash navigation works after moving/renaming the HTML, without a web server.
  return hash === '#demo-data' ||
    (!hash && window.location.pathname === '/demo-data') ? (
    <DemoDataPage />
  ) : (
    <Home />
  );
}

createRoot(document.getElementById('root')!).render(<App />);
