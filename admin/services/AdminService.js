// AdminService.js
import axios from 'axios';
import { API_BASE, API_URL } from './apiConfig.js';
import { toast } from 'react-toastify';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 10000, // 10 second timeout
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('adminToken');
      // Redirect to existing login route
      window.location.href = '/admin';
    }
    return Promise.reject(error);
  }
);

const getUsers = async () => {
  try {
    // Explicit token header ensures admin-only endpoint succeeds even if interceptor missed
    const token = localStorage.getItem('adminToken');
  const response = await api.get(`${API_URL.replace(API_BASE,'')}/users`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching users:', error.response?.data || error.message);
    throw error;
  }
};

// Fetch all properties (admin overview)
const getProperties = async () => {
  try {
    const token = localStorage.getItem('adminToken');
  const response = await api.get(`${API_URL.replace(API_BASE,'')}/properties`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching properties:', error.response?.data || error.message);
    throw error;
  }
};

// Update property status (approve/reject/archive/pending)
const updatePropertyStatus = async (id, status) => {
  try {
    const token = localStorage.getItem('adminToken');
  const response = await api.put(`${API_URL.replace(API_BASE,'')}/properties/${id}/status`, { status }, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return response.data;
  } catch (error) {
    console.error('Error updating property status:', error.response?.data || error.message);
    throw error;
  }
};

// Delete property (admin override)
const deleteProperty = async (id) => {
  try {
    const token = localStorage.getItem('adminToken');
  const response = await api.delete(`${API_URL.replace(API_BASE,'')}/properties/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return response.data;
  } catch (error) {
    console.error('Error deleting property:', error.response?.data || error.message);
    throw error;
  }
};

const banUser = async (userId, token) => {
  try {
  const response = await api.put(`${API_URL.replace(API_BASE,'')}/users/${userId}/ban`, {}, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error banning user:', error);
    throw error;
  }
};

const unbanUser = async (userId, token) => {
  try {
  const response = await api.put(`${API_URL.replace(API_BASE,'')}/users/${userId}/unban`, {}, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error unbanning user:', error);
    throw error;
  }
};

const deleteUser = async (userId, token) => {
  try {
  const response = await api.delete(`${API_URL.replace(API_BASE,'')}/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

const adminService = {
  getUsers,
  getProperties,
  updatePropertyStatus,
  deleteProperty,
  banUser,
  unbanUser,
  deleteUser,
};

export default adminService;