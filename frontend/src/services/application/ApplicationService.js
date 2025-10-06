import axios from 'axios';
import { buildApi } from '../../services/apiConfig';

export const createApplication = async (propertyId, message='') => {
  const token = localStorage.getItem('user_token');
  const res = await axios.post(buildApi('/applications'), { propertyId, message }, { headers: { Authorization: `Bearer ${token}` } });
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
