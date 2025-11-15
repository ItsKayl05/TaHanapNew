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
      // Production (or hosted) builds: use a known backend, or fallback to same origin
      // Hardcoded fallback for Render tahanap services
      if (hostname.includes('tahanap-admin') || hostname.includes('tahanap-frontend')) {
        base = 'https://api.tahanap.xyz';
        // eslint-disable-next-line no-console
        console.info('[admin apiConfig] Detected tahanap Render service, using hardcoded backend:', base);
      } else {
        // For other hosted domains: use the same origin
        // ⚠️ WARNING: If on a hosted domain (like onrender.com), this will use the frontend origin as the API base.
        // This is likely WRONG for most setups. Make sure VITE_API_BASE_URL is set in your Render environment!
        if (typeof window !== 'undefined' && window.location.hostname.includes('.')) {
          console.warn(
            '[admin apiConfig] ⚠️  VITE_API_BASE_URL not set on hosted domain (' + window.location.hostname + '). ' +
            'Using window.location.origin as API base, which is likely WRONG. ' +
            'Please set VITE_API_BASE_URL in your Render environment to your backend URL (e.g., https://api.tahanap.xyz).'
          );
        }
        base = window.location.origin.replace(/\/$/, '');
      }
    }
  } else {
    base = 'http://localhost:4000';
  }
}

base = base.replace(/\/$/, '');
// Helpful debug log in admin builds to know which API base we resolved to
// Log for all modes so prod issues are visible in Render logs
if (typeof window !== 'undefined' && import.meta.env.MODE === 'development') {
  console.info('[admin apiConfig] API_BASE resolved to:', base);
}
// Also log in production (less verbose) for troubleshooting
if (typeof window !== 'undefined' && import.meta.env.MODE === 'production') {
  if (!import.meta.env.VITE_API_BASE_URL) {
    console.warn('[admin apiConfig] Production mode without VITE_API_BASE_URL. Using:', base);
  }
}
export const API_BASE = base;
export const API_URL = `${API_BASE}/api`;
export const UPLOADS_BASE = `${API_BASE}/uploads`;
export const buildApi = (path='') => `${API_URL}${path.startsWith('/') ? path : '/' + path}`;
export const buildUpload = (rel='') => rel?.startsWith('http') ? rel : `${UPLOADS_BASE}${rel.startsWith('/')? rel : '/' + rel}`;
export default { API_BASE, API_URL, UPLOADS_BASE, buildApi, buildUpload };
