// apiConfig.js - Fixed exports
const isDevelopment = import.meta.env.MODE === 'development';

// Determine API base URL
const getApiBase = () => {
  // Use explicit environment variable if set
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '');
  }

  // Development - always use localhost
  if (isDevelopment || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))) {
    return 'http://localhost:4000';
  }

  // Production - use your production URL
  return 'https://tahanap-backend-g6mx.onrender.com';
};

const API_BASE = getApiBase();
const API_URL = `${API_BASE}/api`;
const UPLOADS_BASE = `${API_BASE}/uploads`;

console.log(`[apiConfig] API Base: ${API_BASE}`);
if (typeof window !== 'undefined') {
  console.log(`[apiConfig] Current Host: ${window.location.host}`);
}

// Build API URL
const buildApi = (path = '') => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_URL}${normalizedPath}`;
};

// Build upload URL
const buildUpload = (rel = '') => {
  if (!rel) return '';
  
  if (rel.startsWith('http')) {
    return rel;
  }
  
  const normalizedRel = rel.startsWith('/') ? rel : `/${rel}`;
  return `${UPLOADS_BASE}${normalizedRel}`;
};

// Enhanced API request function
const apiRequest = async (endpoint, options = {}) => {
  const url = buildApi(endpoint);
  
  const config = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
    ...options,
  };

  // Add auth token if available
  const token = localStorage.getItem('user_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  try {
    console.log(`[api] Making request to: ${url}`);
    
    const response = await fetch(url, config);
    
    // Handle authentication issues
    if (response.status === 401) {
      localStorage.removeItem('user_token');
      localStorage.removeItem('user_role');
      localStorage.removeItem('user_id');
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText || 'Request failed' };
      }
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    return await response.json();
    
  } catch (error) {
    console.error(`[api] Request failed for ${endpoint}:`, error);
    
    // Provide helpful error messages
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      if (isDevelopment) {
        console.error(`[api] Development Tip: Make sure your backend is running on ${API_BASE}`);
        console.error(`[api] You can start it with: npm run dev`);
      }
      throw new Error('Cannot connect to server. Please check if the backend is running.');
    }
    
    throw error;
  }
};

// Utility functions
const normalizePayload = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  
  const arrayKeys = ['data', 'result', 'messages', 'applications', 'users', 'properties'];
  for (const key of arrayKeys) {
    if (payload[key] && Array.isArray(payload[key])) {
      return payload[key];
    }
  }
  
  return Object.values(payload).find(val => Array.isArray(val)) || [];
};

// Named exports - FIXED: Added all required exports
export { 
  API_BASE, 
  API_URL, 
  UPLOADS_BASE, 
  buildApi, 
  buildUpload,
  apiRequest,
  normalizePayload 
};

// Default export
export default { 
  API_BASE, 
  API_URL, 
  UPLOADS_BASE, 
  buildApi, 
  buildUpload,
  apiRequest,
  normalizePayload 
};