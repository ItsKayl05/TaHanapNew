import React, { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Sidebar from "../../components/Sidebar/Sidebar.jsx";
import { buildApi, buildUpload } from "../../services/apiConfig.js";
import ConfirmDialog from "../../components/ConfirmDialog/ConfirmDialog.jsx";
import "./LandlordVerification.css";

const LandlordVerification = () => {
    const [landlords, setLandlords] = useState([]);
    const [filter, setFilter] = useState("");
    const [loading, setLoading] = useState(false);
    const [acting, setActing] = useState(null); // landlord id currently saving
    const [deletingDoc, setDeletingDoc] = useState(null);
    const [confirmDoc, setConfirmDoc] = useState(null); // { landlordId, docId }
    const [rejectTarget, setRejectTarget] = useState(null); // { landlordId, docId }
    const [rejectReason, setRejectReason] = useState('');

    const fetchLandlordsForVerification = useCallback(async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem("adminToken");
            const response = await fetch(buildApi('/users/landlords-for-verification'), {
                method: "GET",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) {
                setLandlords(data || []);
            } else {
                toast.error(data.message || "Fetch error");
            }
        } catch {
            toast.error("Error fetching landlords for verification");
        } finally { setLoading(false); }
    }, []);

    useEffect(()=>{ fetchLandlordsForVerification(); }, [fetchLandlordsForVerification]);

    const acceptDocument = async (landlordId, docId) => {
        try {
            setActing(landlordId);
            const token = localStorage.getItem("adminToken");
            const landlord = landlords.find(l => l._id === landlordId);
            if (!landlord) return;
            const approvals = (landlord.idDocuments || []).map(d => ({
                docId: d._id,
                status: d._id === docId ? 'accepted' : d.status // keep existing others
            }));
            const response = await fetch(buildApi('/users/verify-landlord-id'), {
                method: 'POST',
                headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
                body: JSON.stringify({ userId: landlordId, approvals })
            });
            const data = await response.json();
            if (response.ok) {
                toast.success('ID accepted');
                if (data.landlordVerified) {
                    setLandlords(prev => prev.filter(l => l._id !== landlordId));
                } else {
                    setLandlords(prev => prev.map(l => l._id === landlordId ? { ...l, landlordVerified: data.landlordVerified, idDocuments: data.idDocuments } : l));
                }
            } else {
                toast.error(data.message || 'Accept failed');
            }
        } catch { toast.error('Error accepting document'); }
        finally { setActing(null); }
    };

    const rejectDocument = async (landlordId, docId, reason) => {
        if (!reason || !reason.trim()) { toast.error('Enter rejection reason'); return; }
        try {
            setActing(landlordId);
            const token = localStorage.getItem('adminToken');
            const landlord = landlords.find(l => l._id === landlordId);
            const approvals = (landlord.idDocuments||[]).map(d => ({
                docId: d._id,
                status: d._id === docId ? 'rejected' : d.status,
                rejectionReason: d._id === docId ? reason : undefined
            }));
            const resp = await fetch(buildApi('/users/verify-landlord-id'), {
                method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({ userId: landlordId, approvals })
            });
            const data = await resp.json();
            if (resp.ok) {
                toast.info('Document rejected');
                setLandlords(prev => prev.map(l => l._id === landlordId ? { ...l, landlordVerified: data.landlordVerified, idDocuments: data.idDocuments } : l));
            } else { toast.error(data.message || 'Reject failed'); }
        } catch { toast.error('Error rejecting document'); }
        finally { setActing(null); }
    };

    const filteredLandlords = landlords.filter(l => {
        const term = filter.toLowerCase();
        return ((l.fullName||'').toLowerCase().includes(term) || (l.email||'').toLowerCase().includes(term));
    });

    return (
        <div className="admin-layout">
            <Sidebar />
            <main className="content">
                <div className="page-header simple">
                    <h2>Landlord Verification</h2>
                    <p className="subtitle">Accept one valid government ID to verify a landlord.</p>
                </div>
                <div className="card">
                    <div className="toolbar minimal">
                        <input type="text" className="search-input" placeholder="Search landlord..." value={filter} onChange={e=>setFilter(e.target.value)} />
                        <button className="tbtn" onClick={fetchLandlordsForVerification} disabled={loading}>{loading? 'Loading...' : 'Refresh'}</button>
                    </div>
                    <div className="table-wrapper">
                        <table className="verification-table">
                            <thead>
                                <tr>
                                    <th>Landlord</th>
                                    <th>Documents</th>
                                    <th>Verified?</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLandlords.length===0 && (
                                    <tr><td colSpan="3" style={{textAlign:'center',padding:'36px 0', fontSize:'14px', color:'#64748b'}}>No pending landlord verifications.</td></tr>
                                )}
                                {filteredLandlords.map(landlord => {
                                    const docs = landlord.idDocuments || [];
                                    const accepted = docs.some(d => ['accepted','approved'].includes(d.status));
                                    return (
                                        <tr key={landlord._id}>
                                            <td>
                                                <div className="user-cell compact">
                                                    {landlord.profilePic ? (
                                                        <img className="avatar-pic sm" src={landlord.profilePic.startsWith('http') ? landlord.profilePic : buildUpload(`/profiles/${landlord.profilePic}`)} alt={landlord.fullName || 'Profile'} />
                                                    ) : (
                                                        <div className="avatar-placeholder sm">{(landlord.fullName||'U')[0]}</div>
                                                    )}
                                                    <div className="landlord-meta">
                                                        <strong>{landlord.fullName||'Unnamed'}</strong>
                                                        <div className="small-meta">{landlord.email}</div>
                                                        <div className="tiny-meta">{landlord.contactNumber || 'No contact'}{landlord.address ? ' • '+landlord.address : ''}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="docs-simple-list">
                                                    {docs.map(doc => {
                                                        const status = doc.status;
                                                        return (
                                                            <div key={doc._id} className={`doc-row status-${status}`}>
                                                                <div className="doc-main">
                                                                    <span className="doc-type">{doc.idType || 'ID'}</span>
                                                                    <a href={doc.filename?.startsWith('http') ? doc.filename : buildUpload(`/ids/${doc.filename}`)} target="_blank" rel="noopener noreferrer">View</a>
                                                                    <span className={`badge mini ${status}`}>{status}</span>
                                                                </div>
                                                                {status === 'rejected' && doc.rejectionReason && (
                                                                    <div className="reject-reason">Reason: {doc.rejectionReason}</div>
                                                                )}
                                                                <div className="doc-row-actions">
                                                                    {!accepted && status !== 'accepted' && (
                                                                        <button className="mini-btn positive" disabled={acting===landlord._id} onClick={()=> acceptDocument(landlord._id, doc._id)}>{acting===landlord._id? '...' : 'Accept'}</button>
                                                                    )}
                                                                    {!accepted && status !== 'rejected' && (
                                                                        <button className="mini-btn danger" disabled={acting===landlord._id} onClick={()=>{ setRejectTarget({ landlordId: landlord._id, docId: doc._id }); setRejectReason(''); }}>
                                                                            {acting===landlord._id? '...' : 'Reject'}
                                                                        </button>
                                                                    )}
                                                                    <button className="mini-btn neutral" disabled={deletingDoc===doc._id} onClick={()=> setConfirmDoc({ landlordId: landlord._id, docId: doc._id })}>✖</button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`overall-badge ${accepted? 'approved':'pending'}`}>{accepted? 'Verified':'Pending'}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
            <ConfirmDialog
                open={!!confirmDoc}
                title="Delete Document"
                message="This ID document will be permanently removed. Proceed?"
                confirmLabel="Delete"
                cancelLabel="Cancel"
                danger
                icon={<span role="img" aria-label="Document">📄</span>}
                autoFocus="cancel"
                onCancel={()=> setConfirmDoc(null)}
                onConfirm={async ()=>{
                    if(!confirmDoc) return;
                    const { landlordId, docId } = confirmDoc;
                    setDeletingDoc(docId);
                    try {
                        const token = localStorage.getItem('adminToken');
                                const resp = await fetch(buildApi(`/users/landlord-verification/${landlordId}/doc/${docId}`), { method:'DELETE', headers:{ Authorization:`Bearer ${token}` } });
                        const payload = await resp.json();
                        if (resp.ok) {
                            toast.success('Document deleted');
                            setLandlords(prev => prev.map(l => l._id === landlordId ? { ...l, idDocuments: l.idDocuments.filter(d => d._id !== docId) } : l));
                        } else { toast.error(payload.message || 'Delete failed'); }
                    } catch { toast.error('Error deleting document'); }
                    finally { setDeletingDoc(null); setConfirmDoc(null); }
                }}
            />
            <ConfirmDialog
                open={!!rejectTarget}
                title="Reject Document"
                message={''}
                confirmLabel="Reject"
                cancelLabel="Cancel"
                danger
                icon={<span role="img" aria-label="Warn">⚠️</span>}
                autoFocus="confirm"
                onCancel={()=> { setRejectTarget(null); setRejectReason(''); }}
                onConfirm={async ()=>{
                    if(!rejectTarget) return;
                    if(!rejectReason.trim()) { toast.error('Enter a reason'); return; }
                    await rejectDocument(rejectTarget.landlordId, rejectTarget.docId, rejectReason.trim());
                    setRejectTarget(null); setRejectReason('');
                }}
            >
            </ConfirmDialog>
            {rejectTarget && (
                <div className="confirm-overlay inline-form" role="presentation">
                    <div className="confirm-box" style={{maxWidth:'480px'}}>
                        <h4 style={{marginTop:0}}>Rejection Reason</h4>
                        <p style={{marginTop:4, marginBottom:12}}>Provide a clear reason for rejecting this document.</p>
                        <textarea
                            style={{width:'100%', minHeight:'110px', fontSize:'.75rem', padding:'10px', borderRadius:'10px', border:'1px solid #cbd5e1', resize:'vertical', outline:'none'}}
                            placeholder="Reason..."
                            value={rejectReason}
                            onChange={e=>setRejectReason(e.target.value)}
                        />
                        <div className="confirm-actions" style={{marginTop:'14px'}}>
                            <button className="danger-btn" onClick={async ()=>{
                                if(!rejectReason.trim()) { toast.error('Enter a reason'); return; }
                                await rejectDocument(rejectTarget.landlordId, rejectTarget.docId, rejectReason.trim());
                                setRejectTarget(null); setRejectReason('');
                            }}>Reject</button>
                            <button className="secondary-btn" onClick={()=>{ setRejectTarget(null); setRejectReason(''); }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LandlordVerification;