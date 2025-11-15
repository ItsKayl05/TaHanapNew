// Admin API config with subdomain support
// When on localhost dev ports or subdomains, use localhost:4000 for backend API

const raw = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || '';
let base = (raw || '').trim();

if (!base) {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const port = window.location.port;
    const devPorts = ['5173', '5174', '3000', '3001', '8080'];
    
    // If on localhost dev port OR on a subdomain (.local, .test, etc) OR in development
    if (devPorts.includes(port) || hostname.includes('.') && !hostname.includes('localhost') || import.meta.env.MODE === 'development') {
      base = 'http://localhost:4000';
      if (import.meta.env.MODE === 'development') {
        // eslint-disable-next-line no-console
        console.info('[admin apiConfig] Using backend API at http://localhost:4000');
      }
    } else {
      // Production: use same origin
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
