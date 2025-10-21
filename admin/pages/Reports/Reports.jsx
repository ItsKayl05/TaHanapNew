import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AdminAuthContext';
import Sidebar from '../../components/Sidebar/Sidebar';
import ReportsTable from '../../components/ReportsTable/ReportsTable';
import AdminModal from '../../components/Modal/AdminModal';
import { toast } from 'react-toastify';
import './Reports.css';
import { fetchReports, getReport, addNote, updateStatus, resolveReport, deleteReport } from '../../services/ReportService';

const DEFAULT_LIMIT = 20;

const Reports = () => {
  const [items,setItems] = useState([]);
  const [total,setTotal] = useState(0);
  const [page,setPage] = useState(1);
  const [loading,setLoading] = useState(false);
  const [filters,setFilters] = useState({ status:'', type:'', category:'', q:'' });
  const [selected,setSelected] = useState(null); // full report detail
  const [detailLoading,setDetailLoading] = useState(false);
  const [note,setNote] = useState('');
  const [actionLoading,setActionLoading] = useState(false);
  const [error,setError] = useState('');
  const [autoRefresh,setAutoRefresh] = useState(true);
  const lastRefreshRef = useRef(Date.now());
  const [showResolveModal,setShowResolveModal] = useState(false);
  const [resolution,setResolution] = useState({ action:'none', details:'' });

  // Proper admin token from context (fallback to legacy key if present)
  const { token: ctxToken } = useAuth();
  const token = ctxToken || localStorage.getItem('adminToken') || '';

  const load = useCallback(()=>{
    if(!token) { setError('No auth token found'); return; }
    setLoading(true); setError('');
    fetchReports({ token, page, limit: DEFAULT_LIMIT, ...filters })
      .then(r=> { setItems(r.items); setTotal(r.total); lastRefreshRef.current = Date.now(); })
  .catch(e=> { console.error(e); setError(e.message || 'Failed to fetch reports'); toast.error(e.message || 'Failed to fetch reports'); })
      .finally(()=> setLoading(false));
  },[token,page,filters]);

  useEffect(()=>{ load(); },[load]);

  // Auto refresh interval
  useEffect(()=>{
    if(!autoRefresh) return; if(!token) return;
    const id = setInterval(()=> {
      // avoid spamming if user is interacting with detail actions
      if(!loading && document.visibilityState === 'visible') {
        load();
      }
    }, 15000); // 15s
    return ()=> clearInterval(id);
  },[autoRefresh, load, loading, token]);

  // (Optional) listen for local storage broadcast from main app (same origin only)
  useEffect(()=>{
    const handler = (e) => {
      if(e.key === 'report_created' && autoRefresh) {
        load();
      }
    };
    window.addEventListener('storage', handler);
    return ()=> window.removeEventListener('storage', handler);
  },[autoRefresh, load]);

  const openDetail = async (row) => {
    setSelected(null);
    setDetailLoading(true);
    try {
      const full = await getReport({ id: row._id, token });
      setSelected(full);
    } catch(e){ console.error(e); toast.error('Failed to load report details'); }
    finally { setDetailLoading(false); }
  };

  const handleAddNote = async ()=>{
    if(!note.trim() || !selected) return;
    setActionLoading(true);
    try {
      const res = await addNote({ id:selected._id, note:note.trim(), token });
      setSelected(res.report);
      setNote('');
      toast.success('Note added');
    } catch(e){ console.error(e); toast.error('Failed to add note'); }
    finally { setActionLoading(false); }
  };

  const handleStatus = async (status)=>{
    if(!selected) return;
    setActionLoading(true);
    try {
      const res = await updateStatus({ id:selected._id, status, token });
      setSelected(res.report);
      setItems(prev=> prev.map(r=> r._id===res.report._id ? { ...r, status:res.report.status } : r));
      load();
      toast.info(`Status set to ${status}`);
    } catch(e){ console.error(e); toast.error('Status update failed'); }
    finally { setActionLoading(false); }
  };

  const handleResolve = async ()=>{
    if(!selected) return;
  setShowResolveModal(true);
  };

  const submitResolution = async ()=>{
    if(!selected) return;
    // Confirm destructive actions
    if(['permanent_ban','content_removed'].includes(resolution.action)) {
      const ok = window.confirm(`Confirm ${resolution.action.replace(/_/g,' ')}? This action may be irreversible.`);
      if(!ok) return;
    }
    setActionLoading(true);
    try {
      const res = await resolveReport({ id:selected._id, action: resolution.action, details: resolution.details.trim(), token });
      setSelected(res.report);
  setShowResolveModal(false);
      setResolution({ action:'none', details:'' });
      setItems(prev=> prev.map(r=> r._id===res.report._id ? { ...r, status:res.report.status } : r));
      load();
      toast.success('Resolution applied');
    } catch(e){ console.error(e); toast.error('Resolution failed'); }
    finally { setActionLoading(false); }
  };

  const quickAction = (a, presetDetails='') => {
    setResolution(r=> ({ ...r, action:a, details: r.details || presetDetails }));
  setShowResolveModal(true);
  };

  const handleDelete = async ()=>{
    if(!selected) return;
    if(!window.confirm('Delete this report?')) return;
    setActionLoading(true);
    try {
      await deleteReport({ id:selected._id, token });
      setSelected(null);
  setItems(prev=> prev.filter(r=> r._id !== selected._id));
      load();
  toast.warn('Report deleted');
    } catch(e){ console.error(e); }
    finally { setActionLoading(false); }
  };

  const pages = Math.ceil(total / DEFAULT_LIMIT) || 1;

  return (
    <div className="reports-container">
      <Sidebar />
      <div className="reports">
        <h2>Reports</h2>
        <p className="desc">Moderate user, property, and message reports. Filter, review details, add notes, and resolve cases.</p>
        <div className="top-row">
          <div className="left-tools">
            <button type="button" onClick={()=> load()} disabled={loading} title="Refresh now">↻ Refresh</button>
            <label className="auto-refresh-toggle" title="Toggle auto refresh (15s)">
              <input type="checkbox" checked={autoRefresh} onChange={()=> setAutoRefresh(a=>!a)} /> Auto Refresh
            </label>
            <span className="last-refresh">Last: {new Date(lastRefreshRef.current).toLocaleTimeString()}</span>
          </div>
          {error && <div className="error-banner">{error}</div>}
          {!error && !loading && <div className="debug-mini" title="Debug info">{items.length} items</div>}
        </div>
        <div className="filters-bar">
          <input placeholder="Search" value={filters.q} onChange={e=> setFilters(f=>({...f,q:e.target.value}))} />
          <select value={filters.status} onChange={e=> setFilters(f=>({...f,status:e.target.value}))}>
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="under_review">Under Review</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
          <select value={filters.type} onChange={e=> setFilters(f=>({...f,type:e.target.value}))}>
            <option value="">All Types</option>
            <option value="user">User</option>
            <option value="property">Property</option>
            <option value="message">Message</option>
          </select>
          <select value={filters.category} onChange={e=> setFilters(f=>({...f,category:e.target.value}))}>
            <option value="">All Categories</option>
            <option value="fraud">Fraud</option>
            <option value="spam">Spam</option>
            <option value="abuse">Abuse</option>
            <option value="inappropriate">Inappropriate</option>
            <option value="safety">Safety</option>
            <option value="other">Other</option>
          </select>
          <button type="button" onClick={()=> setPage(1)} disabled={loading}>Apply</button>
          <button type="button" onClick={()=> { setFilters({status:'',type:'',category:'',q:''}); setPage(1); }} disabled={loading}>Reset</button>
        </div>
        <ReportsTable data={items} loading={loading} onSelect={openDetail} />
        <div className="pagination">
          <button disabled={page<=1} onClick={()=> setPage(p=> p-1)}>Prev</button>
          <span>Page {page} / {pages}</span>
          <button disabled={page>=pages} onClick={()=> setPage(p=> p+1)}>Next</button>
        </div>
      </div>
      { (selected || detailLoading) && (
        <div className="report-detail-panel">
          <div className="panel-inner">
            {detailLoading && <div className="loading">Loading…</div>}
            {selected && !detailLoading && (
              <>
                <div className="panel-header">
                  <h3>Report Detail</h3>
                  <button className="close" onClick={()=> setSelected(null)}>×</button>
                </div>
                <div className="panel-body">
                  {error && <div className="inline-error">{error}</div>}
                  <div className="meta-grid">
                    <div><span className="label">ID</span><span>{selected._id}</span></div>
                    <div><span className="label">Type</span><span>{selected.type}</span></div>
                    <div><span className="label">Category</span><span>{selected.category}</span></div>
                    <div><span className="label">Status</span><span className={`status-chip ${selected.status}`}>{selected.status}</span></div>
                    <div><span className="label">Reporter</span><span>{selected.reporter?.username}</span></div>
                    <div><span className="label">Created</span><span>{new Date(selected.createdAt).toLocaleString()}</span></div>
                  </div>
                  {selected.description && <p className="desc-block">{selected.description}</p>}
                  {selected.adminNotes?.length > 0 && (
                    <div className="notes">
                      <h4>Admin Notes</h4>
                      <ul>
                        {selected.adminNotes.slice().reverse().map(n=> (
                          <li key={n._id || n.createdAt}><span className="date">{new Date(n.createdAt).toLocaleString()}</span><span className="text">{n.note}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}
          {selected.resolution?.resolvedAt && (
                    <div className="resolution-block">
                      <h4>Resolution</h4>
            <p><strong>Action:</strong> <span className={`res-action-badge act-${selected.resolution.action}`}>{selected.resolution.action.replace(/_/g,' ')}</span></p>
                      <p><strong>Details:</strong> {selected.resolution.details || '—'}</p>
                      <p><strong>Resolved:</strong> {new Date(selected.resolution.resolvedAt).toLocaleString()}</p>
                    </div>
                  )}
                  <div className="add-note-row">
                    <input value={note} onChange={e=> setNote(e.target.value)} placeholder="Add admin note" />
                    <button type="button" onClick={handleAddNote} disabled={actionLoading || !note.trim()}>Add</button>
                  </div>
                  <div className="actions-row">
                    <button onClick={()=> handleStatus('open')} disabled={actionLoading || selected.status==='open'}>Open</button>
                    <button onClick={()=> handleStatus('under_review')} disabled={actionLoading || selected.status==='under_review'}>Under Review</button>
                    {selected.status!=='resolved' && (
                      <button onClick={handleResolve} disabled={actionLoading}>Resolve</button>
                    )}
                    <button onClick={()=> handleStatus('dismissed')} disabled={actionLoading || selected.status==='dismissed'}>Dismiss</button>
                    <button className="danger" onClick={handleDelete} disabled={actionLoading}>Delete</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <AdminModal
        open={showResolveModal && selected && !selected.resolution?.resolvedAt}
        onClose={()=> { if(!actionLoading){ setShowResolveModal(false); setResolution({ action:'none', details:'' }); } }}
        title="Finalize Resolution"
        actions={(
          <>
            <button className="secondary" type="button" disabled={actionLoading} onClick={()=> { setShowResolveModal(false); setResolution({ action:'none', details:'' }); }}>Cancel</button>
            <button type="button" disabled={actionLoading} onClick={submitResolution}>{actionLoading? 'Saving...' : 'Apply Resolution'}</button>
          </>
        )}
      >
        <div className="resolve-actions-picker">
          {['none','warned','temporary_ban','permanent_ban','content_removed','other'].map(a=> (
            <button key={a} type="button" className={resolution.action===a? 'sel' : ''} onClick={()=> setResolution(r=> ({...r, action:a}))}>{a.replace(/_/g,' ')}</button>
          ))}
        </div>
        <textarea
          placeholder="Resolution details / rationale (optional but recommended)"
          value={resolution.details}
          onChange={e=> setResolution(r=> ({...r, details:e.target.value}))}
          rows={4}
        />
        <div className="resolve-quick-presets">
          <span className="label">Quick presets:</span>
          <button type="button" onClick={()=> quickAction('warned','User warned about policy violation.')}>Warn</button>
          <button type="button" onClick={()=> quickAction('temporary_ban','Temporarily banned for 7 days.')}>Temp Ban (7d)</button>
          <button type="button" onClick={()=> quickAction('permanent_ban','Permanent ban due to severe violation.')}>Permanent Ban</button>
          <button type="button" onClick={()=> quickAction('content_removed','Offending content removed.')}>Remove Content</button>
        </div>
      </AdminModal>
    </div>
  );
};

export default Reports;