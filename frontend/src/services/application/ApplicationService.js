import axios from 'axios';
import { buildApi } from '../../services/apiConfig';

export const createApplication = async (propertyId, message='', options = {}) => {
  const token = localStorage.getItem('user_token');
  const payload = { propertyId, message, listingType: options.listingType };
  const res = await axios.post(buildApi('/applications'), payload, { headers: { Authorization: `Bearer ${token}` } });
  return res.data;
};

export const fetchMyApplications = async () => {
  const token = localStorage.getItem('user_token');
  const res = await axios.get(buildApi('/applications/me'), { headers: { Authorization: `Bearer ${token}` } });
  return res.data;
};

export const fetchApplicationsByProperty = async (propertyId) => {
  const token = localStorage.getItem('user_token');
  const res = await axios.get(buildApi(`/applications/property/${propertyId}`), { headers: { Authorization: `Bearer ${token}` } });
  // Debug: log raw response body to help diagnose production shapes
  try {
    console.debug('[debug] fetchApplicationsByProperty raw response:', res && res.data ? res.data : res);
  } catch (e) {
    console.debug('[debug] fetchApplicationsByProperty raw response (stringified):', JSON.stringify(res).slice(0, 2000));
  }
  return res.data;
};

export const approveApplication = async (id) => {
  const token = localStorage.getItem('user_token');
  const res = await axios.post(buildApi(`/applications/${id}/approve`), {}, { headers: { Authorization: `Bearer ${token}` } });
  return res.data;
};

export const rejectApplication = async (id) => {
  const token = localStorage.getItem('user_token');
  const res = await axios.post(buildApi(`/applications/${id}/reject`), {}, { headers: { Authorization: `Bearer ${token}` } });
  return res.data;
};
