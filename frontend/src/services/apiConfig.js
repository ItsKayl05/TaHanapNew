// Simplified API config for Vite frontend.
// Priority: VITE_API_BASE_URL -> same-origin -> http://localhost:4000 fallback (dev ports)
const envBase = import.meta.env.VITE_API_BASE_URL?.trim();
let base = envBase || '';
if(!base) {
  if (typeof window !== 'undefined') {
    const devPorts = ['5173','5174','3000','3001'];
    const { origin, port } = window.location;
    if (devPorts.includes(port)) {
      base = 'http://localhost:4000';
      if (import.meta.env.MODE === 'development') {
        // eslint-disable-next-line no-console
        console.info('[apiConfig] Using fallback API base http://localhost:4000 (no VITE_API_BASE_URL)');
      }
    } else {
      base = origin;
    }
  } else {
    base = 'http://localhost:4000';
  }
}
base = base.replace(/\/$/, '');
export const API_BASE = base;
export const API_URL = base.endsWith('/api') ? base : `${base}/api`;
export const UPLOADS_BASE = `${base}/uploads`;
export const buildApi = (path='') => `${API_URL}${path.startsWith('/') ? path : '/' + path}`;
export const buildUpload = (rel='') => rel?.startsWith('http') ? rel : `${UPLOADS_BASE}${rel.startsWith('/') ? rel : '/' + rel}`;
// Optional: expose for debugging
if (typeof window !== 'undefined') window.__APP_API_BASE__ = API_BASE;
export default { API_BASE, API_URL, UPLOADS_BASE, buildApi, buildUpload };
