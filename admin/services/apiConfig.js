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

    // Prefer the local backend only for true dev scenarios
    if (isLocalhost || isDevPort || isLocalDomain || import.meta.env.MODE === 'development') {
      base = 'http://localhost:4000';
      if (import.meta.env.MODE === 'development') {
        console.info('[admin apiConfig] Using backend API at http://localhost:4000');
      }
    } else {
      // Production builds - use the correct backend API
      if (hostname.includes('tahanap-admin') || hostname.includes('tahanap-frontend')) {
        base = 'https://api.tahanap.xyz';
        console.info('[admin apiConfig] Detected tahanap Render service, using backend:', base);
      } else {
        // For other production domains, use the same origin but warn if it might be wrong
        base = window.location.origin.replace(/\/$/, '');
        if (!import.meta.env.VITE_API_BASE_URL) {
          console.warn(
            '[admin apiConfig] ⚠️  VITE_API_BASE_URL not set on hosted domain (' + window.location.hostname + '). ' +
            'Using: ' + base
          );
        }
      }
    }
  } else {
    base = 'http://localhost:4000';
  }
}

base = base.replace(/\/$/, '');

// Log for troubleshooting
if (typeof window !== 'undefined') {
  if (import.meta.env.MODE === 'development') {
    console.info('[admin apiConfig] API_BASE resolved to:', base);
  } else if (!import.meta.env.VITE_API_BASE_URL) {
    console.warn('[admin apiConfig] Production mode without VITE_API_BASE_URL. Using:', base);
  }
}

export const API_BASE = base;
export const API_URL = `${API_BASE}/api`;
export const UPLOADS_BASE = `${API_BASE}/uploads`;
export const buildApi = (path='') => `${API_URL}${path.startsWith('/') ? path : '/' + path}`;
export const buildUpload = (rel='') => rel?.startsWith('http') ? rel : `${UPLOADS_BASE}${rel.startsWith('/')? rel : '/' + rel}`;
export default { API_BASE, API_URL, UPLOADS_BASE, buildApi, buildUpload };