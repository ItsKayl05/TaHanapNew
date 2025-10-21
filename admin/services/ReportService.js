// Admin Report Service
// Wrapper functions for interacting with /api/reports endpoints

import { buildApi } from './apiConfig';
const REPORTS_ROOT = '/reports';

export async function fetchReports({ token, page=1, limit=20, status, type, category, q }={}) {
  const params = new URLSearchParams();
  if(status) params.append('status', status);
  if(type) params.append('type', type);
  if(category) params.append('category', category);
  if(q) params.append('q', q);
  params.append('page', page);
  params.append('limit', limit);
  const res = await fetch(`${buildApi(REPORTS_ROOT)}?${params.toString()}`, { headers: { 'Authorization': `Bearer ${token}` }});
  if(!res.ok) throw new Error('Failed to load reports');
  return res.json();
}

export async function getReport({ id, token }) {
  const res = await fetch(`${buildApi(`${REPORTS_ROOT}/${id}`)}`, { headers: { 'Authorization': `Bearer ${token}` }});
  if(!res.ok) throw new Error('Failed to fetch report');
  return res.json();
}

export async function addNote({ id, note, token }) {
  const res = await fetch(`${buildApi(`${REPORTS_ROOT}/${id}/notes`)}`, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ note }) });
  if(!res.ok) throw new Error('Failed to add note');
  return res.json();
}

export async function updateStatus({ id, status, token }) {
  const res = await fetch(`${buildApi(`${REPORTS_ROOT}/${id}/status`)}`, { method:'PATCH', headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ status }) });
  if(!res.ok) throw new Error('Failed to update status');
  return res.json();
}

export async function resolveReport({ id, action, details, token }) {
  const res = await fetch(`${buildApi(`${REPORTS_ROOT}/${id}/resolve`)}`, { method:'PATCH', headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ action, details }) });
  if(!res.ok) throw new Error('Failed to resolve report');
  return res.json();
}

export async function deleteReport({ id, token }) {
  const res = await fetch(`${buildApi(`${REPORTS_ROOT}/${id}`)}`, { method:'DELETE', headers:{ 'Authorization': `Bearer ${token}` }});
  if(!res.ok) throw new Error('Failed to delete report');
  return res.json();
}
