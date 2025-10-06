import { buildApi } from './apiConfig';

export const fetchLandlordDashboard = async () => {
  const token = localStorage.getItem('user_token');
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(buildApi('/users/landlord-dashboard'), {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load landlord data');
  return data;
};

export const hasPendingVerification = (data) => {
  if (!data) return false;
  const { landlordVerified, idDocuments = [] } = data;
  if (landlordVerified) return false;
  return idDocuments.some(d => d.status === 'pending');
};
