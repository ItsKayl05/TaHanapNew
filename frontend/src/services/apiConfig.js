// apiConfig.js - Fixed for your actual backend URL
const isDevelopment = import.meta.env.MODE === 'development';

// FIXED: Using your actual backend URL
const getApiBase = () => {
  // Check for explicit environment variable first
  const envBase = import.meta.env.VITE_API_BASE_URL?.trim();
  if (envBase) {
    console.log(`[apiConfig] Using VITE_API_BASE_URL: ${envBase}`);
    return envBase;
  }

  // Auto-detect based on current environment
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    
    // Development environments
    if (isDevelopment || hostname === 'localhost' || hostname === '127.0.0.1') {
      const devUrl = `http://localhost:4000`;
      console.log(`[apiConfig] Development mode - Using ${devUrl}`);
      return devUrl;
    }
    
    // Production - use your actual backend URL
    if (hostname.includes('tahanap.xyz')) {
      const prodUrl = 'https://tahanap-backend-g6mx.onrender.com';
      console.log(`[apiConfig] Production mode - Using ${prodUrl}`);
      return prodUrl;
    }
  }

  // Default fallback to your actual backend
  const defaultUrl = isDevelopment ? 'http://localhost:4000' : 'https://tahanap-backend-g6mx.onrender.com';
  console.log(`[apiConfig] Default mode - Using ${defaultUrl}`);
  return defaultUrl;
};

const API_BASE = getApiBase().replace(/\/$/, '');
export const API_URL = `${API_BASE}/api`;
export const UPLOADS_BASE = `${API_BASE}/uploads`;

export const buildApi = (path = '') => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_URL}${normalizedPath}`;
  console.log(`[apiConfig] Building API URL: ${url}`);
  return url;
};

export const buildUpload = (rel = '') => {
  if (!rel) return '';
  
  // Already absolute URL
  if (rel.startsWith('http')) {
    // Fix mixed content
    if (window.location.protocol === 'https:' && rel.startsWith('http:')) {
      return rel.replace('http:', 'https:');
    }
    return rel;
  }
  
  // Relative path - build full URL
  let uploadUrl = `${UPLOADS_BASE}${rel.startsWith('/') ? rel : `/${rel}`}`;
  
  // Fix mixed content
  if (window.location.protocol === 'https:' && uploadUrl.startsWith('http:')) {
    uploadUrl = uploadUrl.replace('http:', 'https:');
  }
  
  return uploadUrl;
};

import { toast } from 'react-toastify';

// Enhanced fetch function
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

    // Handle server errors
    if (!response.ok) {
      let errorMessage = 'An error occurred';
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        // If response is not JSON, use status text
        errorMessage = response.statusText || errorMessage;
      }

      // Show appropriate toast based on status code
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
        case 500:
          toast.error('Server error. Please try again later.');
          break;
        case 502:
        case 503:
          toast.error('Service temporarily unavailable. Please try again later.');
          break;
        default:
          toast.error(errorMessage);
      }
      throw new Error(errorMessage);
    }

    // Parse successful response
    const data = await response.json();
    return data;
    
  } catch (error) {
    console.error(`[api] Request failed for ${endpoint}:`, error);
    
    // Only show toast for non-authentication errors
    if (!error.message.includes('Session expired')) {
      toast.error('Network error. Please check your connection.');
    }
    
    throw error;
  }
};

// Utility function to normalize API responses
export const normalizePayload = (payload, preferredKeys = ['data', 'result', 'messages', 'applications']) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  
  for (const k of preferredKeys) {
    if (payload && Object.prototype.hasOwnProperty.call(payload, k) && Array.isArray(payload[k])) {
      return payload[k];
    }
  }
  
  const values = Object.values(payload).filter(v => Array.isArray(v));
  if (values.length) return values[0];
  
  return [];
};

// Expose for debugging
if (typeof window !== 'undefined' && isDevelopment) {
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
  apiRequest,
  normalizePayload
};