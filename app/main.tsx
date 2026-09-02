import { createRoot } from 'react-dom/client';
import Home from './page';
import DemoDataPage from './demo-data/page';
import './globals.css';

// The main app keeps its existing view state. Demo import remains explicit.
const path = window.location.pathname.replace(/\/$/, '') || '/';
const content =
  path === '/demo-data' ? (
    <DemoDataPage />
  ) : path === '/' || path === '/index.html' ? (
    <Home />
  ) : (
    <main className="app-shell">
      <h1>页面不存在</h1>
      <a href="/">返回首页</a>
    </main>
  );

createRoot(document.getElementById('root')!).render(content);
