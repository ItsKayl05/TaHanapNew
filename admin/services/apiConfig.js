// Admin API config with subdomain support
// When on localhost dev ports or subdomains, use localhost:4000 for backend API

const raw = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || '';
let base = (raw || '').trim();

if (!base) {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const port = window.location.port;
    const devPorts = ['5173', '5174', '3000', '3001', '8080'];
    
    // Decide if we should use the local backend during development
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isDevPort = devPorts.includes(port);
    const isLocalDomain = hostname.endsWith('.local') || hostname.endsWith('.test');

    // Prefer the local backend only for true dev scenarios (localhost, local ports or .local/.test domains)
    // Avoid treating hosted domains (like onrender.com / netlify.app) as local dev.
    if (isLocalhost || isDevPort || isLocalDomain || import.meta.env.MODE === 'development') {
      base = 'http://localhost:4000';
      if (import.meta.env.MODE === 'development') {
        // eslint-disable-next-line no-console
        console.info('[admin apiConfig] Using backend API at http://localhost:4000');
      }
    } else {
      // Production (or hosted) builds: use the same origin unless user provided VITE_API_BASE_URL
      base = window.location.origin.replace(/\/$/, '');
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
