import { buildApi } from '../../services/apiConfig';
import { getToken } from '../auth/getToken';

// Service for submitting reports from tenant/landlord UI
const ReportService = {
  async createReport({ type, targetUser, targetProperty, targetMessage, category, description }) {
    if(!type) throw new Error('Missing report type');
    if(type==='user' && !targetUser) throw new Error('Missing target user');
    if(type==='property' && !targetProperty) throw new Error('Missing target property');
    if(type==='message' && !targetMessage) throw new Error('Missing target message');
    if(!category) throw new Error('Select a category');
    if(!description || !description.trim()) throw new Error('Add a description');
    const token = getToken();
    if(!token) throw new Error('Not authenticated');
    const res = await fetch(buildApi('/reports'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type, targetUser, targetProperty, targetMessage, category, description })
    });
    if(!res.ok) {
      const data = await res.json().catch(()=>({}));
      throw new Error(data.message || 'Failed to submit report');
    }
    try {
      // Broadcast to other tabs (admin panel) that a report was created
      localStorage.setItem('report_created', Date.now().toString());
      // Quickly remove the key to allow future events with same key
      setTimeout(()=> { try { localStorage.removeItem('report_created'); } catch(_){} }, 250);
    } catch(_) { /* ignore cross-context issues */ }
    return res.json();
  }
};

export default ReportService;
