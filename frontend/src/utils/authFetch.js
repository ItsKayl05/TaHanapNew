// Centralized authenticated fetch with automatic 401 handling
export async function authFetch(url, options = {}) {
  const token = localStorage.getItem('user_token');
  const headers = {
    ...(options.headers || {}),
    'Authorization': token ? `Bearer ${token}` : ''
  };
  // Default JSON accept
  if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    try {
      const data = await res.json();
      console.warn('Auth 401', data);
    } catch(_) {}
    localStorage.removeItem('user_token');
    // Bubble a custom error so caller can redirect
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  return res;
}
