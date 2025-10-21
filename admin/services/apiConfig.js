// Simplified admin API config: rely directly on Vite's import.meta.env replacement.
// Previous dynamic Function approach prevented Vite from statically injecting env vars.
// This resolves the persistent "No VITE_API_BASE_URL" warning even when .env is present.

const raw = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || '';
let base = (raw || '').trim();
if(!base) {
  if (typeof window !== 'undefined') {
    base = window.location.origin.replace(/\/$/, '');
    // Fallback dev heuristic
    const devPorts = ['5173','5174','3000','3001'];
    if (devPorts.includes(window.location.port)) {
      base = 'http://localhost:4000';
      if (import.meta.env.MODE === 'development') {
        // eslint-disable-next-line no-console
        console.info('[admin apiConfig] Using fallback API base http://localhost:4000');
      }
    }
  } else {
    base = 'http://localhost:4000';
  }
}
base = base.replace(/\/$/, '');
export const API_BASE = base;
export const API_URL = `${API_BASE}/api`;
export const UPLOADS_BASE = `${API_BASE}/uploads`;
export const buildApi = (path='') => `${API_URL}${path.startsWith('/') ? path : '/' + path}`;
export const buildUpload = (rel='') => rel?.startsWith('http') ? rel : `${UPLOADS_BASE}${rel.startsWith('/')? rel : '/' + rel}`;
export default { API_BASE, API_URL, UPLOADS_BASE, buildApi, buildUpload };
