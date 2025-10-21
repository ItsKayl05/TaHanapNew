// Centralized landlord property-related API calls
import { buildApi } from '../apiConfig';

// Helper to attach auth header with error handling
function getAuthHeaders() {
  const token = localStorage.getItem('user_token');
  if (!token) {
    throw new Error('Authentication required. Please login first.');
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

export async function fetchMyProperties(signal) {
  try {
    // Get auth headers (will throw if no token)
    // For GET requests, avoid setting Content-Type to prevent unnecessary preflight.
    const token = localStorage.getItem('user_token');
    if (!token) throw new Error('Authentication required. Please login first.');
    const headers = {
      Authorization: `Bearer ${token}`
    };

    // Log for debugging (redacted token)
    console.log('🔒 Making authenticated request to', buildApi('/properties/my-properties'));

    const response = await fetch(buildApi('/properties/my-properties'), {
      method: 'GET',
      headers,
      signal
      // intentionally do not include credentials or Content-Type for GET
    });

    if (!response.ok) {
      // Try to get detailed error message
      const errorData = await response.json().catch(() => ({}));
      console.error('API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        data: errorData
      });

      if (response.status === 401 || errorData.message?.includes('Not authorized')) {
        // Clear token and redirect to login
        localStorage.removeItem('user_token');
        window.location.href = '/login';
        throw new Error('Your session has expired. Please login again.');
      }
      
      if (response.status === 403) {
        throw new Error('You do not have permission to access this resource.');
      }
      
      if (response.status === 404) {
        return []; // Return empty array if no properties found
      }
      
      throw new Error(
        errorData.message || 
        errorData.error || 
        `Failed to load properties (Status: ${response.status})`
      );
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      console.warn('Unexpected response format:', data);
      return [];
    }
    return data;
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'CanceledError') {
      // Treat abort as cleanup. Keep it quiet (debug/info) to avoid noisy toasts.
      console.debug('fetchMyProperties aborted:', err.message || err.name);
      return [];
    }
    if (err.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your connection.');
    }
    console.error('Error fetching properties:', err);
    throw err;
  }
}

export async function deleteProperty(id) {
  try {
    // Get auth headers (will throw if no token)
    const headers = getAuthHeaders();

    const response = await fetch(buildApi(`/properties/${id}`), {
      method: 'DELETE',
      headers,
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || `Failed to delete property (${response.status})`);
    }

    return await response.json();
  } catch (err) {
    throw new Error(err.message || 'Failed to delete property');
  }
}

export async function setAvailability(id, payload) {
  try {
    const response = await fetch(buildApi(`/properties/${id}/availability`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || `Failed to update availability (${response.status})`);
    }

    return await response.json();
  } catch (err) {
    throw new Error(err.message || 'Failed to update availability');
  }
}

export async function updateProperty(propertyId, formData) {
  try {
    const response = await fetch(buildApi(`/properties/${propertyId}`), {
      method: 'PUT',
      headers: {
        ...authHeaders()
        // Don't set Content-Type for FormData - let browser set it with boundary
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || errorData.details || `Failed to update property (${response.status})`);
    }

    return await response.json();
  } catch (err) {
    throw new Error(err.message || 'Failed to update property');
  }
}

export async function createProperty(formData) {
  try {
    const response = await fetch(buildApi('/properties'), {
      method: 'POST',
      headers: {
        ...authHeaders()
        // Don't set Content-Type for FormData - let browser set it with boundary
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || errorData.details || `Failed to create property (${response.status})`);
    }

    return await response.json();
  } catch (err) {
    throw new Error(err.message || 'Failed to create property');
  }
}

export async function getPropertyById(id) {
  try {
    const response = await fetch(buildApi(`/properties/${id}`), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || `Failed to load property (${response.status})`);
    }

    return await response.json();
  } catch (err) {
    throw new Error(err.message || 'Failed to load property');
  }
}