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

import { toast } from 'react-toastify';

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
  const token = localStorage.getItem('user_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, config);
    
    // Handle authentication issues
    if (response.status === 401) {
      localStorage.removeItem('user_token');
      localStorage.removeItem('user_role');
      localStorage.removeItem('user_id');
      toast.error('Session expired. Please log in again.');
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    // Handle server maintenance and errors
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      if (response.status === 503 || response.status === 502) {
        toast.error('Server is under maintenance. Please try again later.');
        throw new Error('Server maintenance');
      }
      toast.error('Unexpected server error. Please try again.');
      throw new Error('Server error');
    }

    // Parse response and handle errors
    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.message || data.msg || data.error || 'An error occurred';
      
      switch (response.status) {
        case 403:
          toast.error(`Access denied: ${errorMessage}`);
          break;
        case 404:
          toast.error(`Not found: ${errorMessage}`);
          break;
        case 413:
          toast.error('File too large. Please choose a smaller file.');
          break;
        case 429:
          toast.error('Too many requests. Please wait a moment.');
          break;
        case 400:
          toast.error(errorMessage);
          break;
        default:
          toast.error(errorMessage);
      }
      throw new Error(errorMessage);
    }

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

// Normalize API payloads to common shapes.
// Accepts objects like: array, { data: [...] }, { result: [...] }, { messages: [...] }, { applications: [...] }
export const normalizePayload = (payload, preferredKeys = ['data', 'result', 'messages', 'applications']) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  // If payload is object with the properties we're looking for
  for (const k of preferredKeys) {
    if (payload && Object.prototype.hasOwnProperty.call(payload, k) && Array.isArray(payload[k])) {
      return payload[k];
    }
  }
  // If payload has a top-level property that itself is an array (e.g., payload.applications)
  const values = Object.values(payload).filter(v => Array.isArray(v));
  if (values.length) return values[0];
  // Nothing matched — return empty array (caller can handle object forms separately if needed)
  return [];
};