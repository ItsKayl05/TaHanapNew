// Fixed API config for Vite frontend - specifically for your production backend
const envBase = import.meta.env.VITE_API_BASE_URL?.trim();
let base = envBase || '';

if (!base) {
  if (typeof window !== 'undefined') {
    const devPorts = ['5173', '5174', '3000', '3001'];
    const { origin, port, hostname } = window.location;
    
    // Development mode - use localhost
    if (devPorts.includes(port) || hostname === 'localhost' || hostname === '127.0.0.1') {
      base = 'http://localhost:4000';
      if (import.meta.env.MODE === 'development') {
        console.info('[apiConfig] Development mode - Using http://localhost:4000');
      }
    } else {
      // Production mode - use your actual backend
      base = 'https://tahanap-backend.onrender.com';
      console.info('[apiConfig] Production mode - Using https://tahanap-backend.onrender.com');
    }
  } else {
    base = 'http://localhost:4000';
  }
}

base = base.replace(/\/$/, '');
export const API_BASE = base;
export const API_URL = base.endsWith('/api') ? base : `${base}/api`;
export const UPLOADS_BASE = `${base}/uploads`;

export const buildApi = (path = '') => {
  const url = `${API_URL}${path.startsWith('/') ? path : '/' + path}`;
  console.log(`[apiConfig] Building API URL: ${url}`);
  return url;
};

export const buildUpload = (rel = '') => {
  if (!rel) return '';
  
  if (rel?.startsWith('http')) {
    // Fix mixed content - force HTTPS if we're on HTTPS
    if (window.location.protocol === 'https:' && rel.startsWith('http:')) {
      return rel.replace('http:', 'https:');
    }
    return rel;
  }
  
  let uploadUrl = `${UPLOADS_BASE}${rel.startsWith('/') ? rel : '/' + rel}`;
  
  // Fix mixed content warnings
  if (window.location.protocol === 'https:' && uploadUrl.startsWith('http:')) {
    uploadUrl = uploadUrl.replace('http:', 'https:');
  }
  
  return uploadUrl;
};

// Enhanced fetch function with better error handling
export const apiRequest = async (endpoint, options = {}) => {
  const url = buildApi(endpoint);
  
  const config = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  // Add auth token if available
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  try {
    console.log(`[api] Making request to: ${config.method} ${url}`);
    
    const response = await fetch(url, config);
    console.log(`[api] Response status: ${response.status}`);
    
    // Handle HTML responses (server errors)
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      const htmlText = await response.text();
      console.error('[api] Server returned HTML error page');
      throw new Error(`Server returned HTML error (Status: ${response.status}). Backend might be down.`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log(`[api] Request successful`);
    return data;
    
  } catch (error) {
    console.error(`[api] Request failed:`, error);
    throw error;
  }
};

// Expose for debugging
if (typeof window !== 'undefined') {
  window.__APP_API_CONFIG__ = {
    API_BASE,
    API_URL,
    UPLOADS_BASE,
    currentUrl: window.location.href,
    buildApi: (path) => buildApi(path)
  };
}

export default { 
  API_BASE, 
  API_URL, 
  UPLOADS_BASE, 
  buildApi, 
  buildUpload,
  apiRequest 
};