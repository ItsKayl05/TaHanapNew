import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import '../landlord-theme.css';
import { authFetch } from "../../../utils/authFetch";
import { buildApi } from '../../../services/apiConfig';
import DashboardSidebar from '../../../components/DashboardSidebar/DashboardSidebar';

const Sidebar = ({ handleLogout }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Handle window resize
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const [showIdModal, setShowIdModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const [idEntries, setIdEntries] = useState([]); // {file,idType}

    // allow user to dismiss a server-side rejected notice without it forcing the modal open
    const [dismissedRejected, setDismissedRejected] = useState(false);
    const idTypeOptions = [
        "PhilSys National ID",
        "SSS ID",
        "GSIS ID",
        "Driver's License",
        "Passport",
        "PRC ID",
        "UMID"
    ];
    const [landlordData, setLandlordData] = useState(null);
    const [loadingDash, setLoadingDash] = useState(false);
    const isVerified = landlordData?.landlordVerified === true;
    const [lastVerificationState, setLastVerificationState] = useState(null);

    const refreshLandlordData = async () => {
        try {
            setLoadingDash(true);
            const res = await authFetch(buildApi('/users/landlord-dashboard'));
            const data = await res.json();
            setLandlordData(data);
        } catch { /* silent */ } finally { setLoadingDash(false); }
    };
    useEffect(()=>{ refreshLandlordData(); }, []);
    // keep previous behavior: modal auto-opens when there's a rejected doc
    useEffect(()=>{
        if (landlordData) {
            if (lastVerificationState === false && landlordData.landlordVerified === true) {
                toast.success('Your landlord verification is approved.');
            }
            setLastVerificationState(landlordData.landlordVerified);
        }
    }, [landlordData, lastVerificationState]);

    const handleAddFiles = (files) => {
        const newItems = Array.from(files).map(f => ({ file: f, idType: "" }));
        setIdEntries(prev => [...prev, ...newItems]);
    };
    const updateIdType = (i, idType) => setIdEntries(p=> p.map((e,idx)=> idx===i? { ...e, idType } : e));
    const removeEntry = (i) => setIdEntries(p=> p.filter((_,idx)=> idx!==i));
    const handleIdSubmit = async (e) => {
        e.preventDefault();
        if (idEntries.length === 0) {
            setError('Please add at least one ID image.');
            toast.error('No file selected.');
            return;
        }
        if (idEntries.some(e => !e.idType)) {
            setError('Select ID type for each file.');
            toast.error('Select ID type for each file.');
            return;
        }
        // Check if only one ID is allowed unless rejected
        if (landlordData && landlordData.idDocuments && landlordData.idDocuments.length >= 1) {
            const existing = landlordData.idDocuments[0];
            if (!existing || existing.status !== 'rejected') {
                setError('Only one ID document is allowed. Your current document must be rejected before you can upload a new one.');
                toast.error('Only one ID document is allowed. Please wait for admin review or re-upload if rejected.');
                return;
            }
        }
        setUploading(true); setError('');
        try {
            const formData = new FormData();
            idEntries.forEach(entry => formData.append('idFiles', entry.file));
            formData.append('idTypes', JSON.stringify(idEntries.map(e => e.idType)));
            const res = await authFetch(buildApi('/users/upload-id'), { method: 'POST', body: formData });
            const data = await res.json();
            if (res.ok) {
                toast.success('ID submitted for review.');
                setIdEntries([]);
                // reset dismissal so future rejections show again
                setDismissedRejected(false);
                setShowIdModal(false);
                await refreshLandlordData();
            } else {
                setError(data.message || 'Upload failed');
                toast.error(data.message || 'Upload failed');
            }
        } catch {
            setError('Upload error');
            toast.error('Upload error');
        } finally {
            setUploading(false);
        }
    };

    const handleAddPropertiesClick = () => {
        if (!isVerified) {
            setShowIdModal(true);
        } else {
            navigate('/add-properties');
        }
    };

    const getActiveItem = () => {
        const path = location.pathname;
        if (path.includes("landlord-profile")) return "profile";
        if (path.includes("add-properties")) return "add-properties";
        if (path.includes("my-properties")) return "my-properties";
        if (path.includes("properties") && !path.includes("my-properties")) return "properties";
        return "";
    };
    const activeItem = getActiveItem();

    const hasRejected = (landlordData?.idDocuments||[]).some(d=> d.status==='rejected');
    const rejectedDocs = (landlordData?.idDocuments||[]).filter(d=> d.status==='rejected');

    const links = [
        { key:'profile', label:'Profile', to:'/landlord-profile', active: activeItem==='profile' },
        { key:'add-properties', label:'Add Properties', to:'/add-properties', active: activeItem==='add-properties', locked:!isVerified, hint:'Verify ID first' },
        { key:'my-properties', label:'My Properties', to:'/my-properties', active: activeItem==='my-properties' },
        { key:'properties', label:'All Listings', to:'/properties', active: activeItem==='properties' },
        { key:'property-map', label:'Property Map', to:'/property-map', active: location.pathname==='/property-map' },
        { key:'messages', label:'Messages', to:'/landlord/messages', active: location.pathname==='/landlord/messages' },
    ];
    const verification = !loadingDash && landlordData ? {
        status: isVerified? 'verified' : hasRejected? 'rejected' : ( (landlordData.idDocuments||[]).length>0 ? 'pending':'none'),
        rejectedReasons: rejectedDocs.map(r=> `${r.idType||'ID'}: ${r.rejectionReason||'No reason'}`)
    } : null;

    return (
        <>
            <DashboardSidebar
                variant="landlord"
                links={links}
                onNavigate={(to)=>{
                    if(to==='/add-properties') { handleAddPropertiesClick(); return; }
                    navigate(to);
                }}
                onLogout={handleLogout}
                verification={verification}
                isMobile={isMobile}
            />
            {(showIdModal || (hasRejected && !dismissedRejected)) && (
                <div className="id-modal-overlay" onClick={() => { if (hasRejected) setDismissedRejected(true); else setShowIdModal(false); }}>
                    <div className={`id-modal ${isMobile ? 'mobile-modal' : ''}`} onClick={(e)=>e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Landlord Verification</h3>
                            {isMobile && (
                                <button 
                                    className="modal-close-btn"
                                    onClick={() => { 
                                        setDismissedRejected(true);
                                        setShowIdModal(false);
                                    }}
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                        <div className="modal-body">
                            <p className="id-intro"><strong>{hasRejected? 'Your previous submission was rejected.' : 'Why we need this:'}</strong> {hasRejected? 'Please review the reason(s) below and submit a new clear image of your ID.' : 'Provide valid government IDs to unlock property listing.'}</p>
                            {hasRejected && rejectedDocs.length>0 && (
                                <div className="reject-list">
                                    <p className="reject-title">Rejection Reason{rejectedDocs.length>1?'s':''}:</p>
                                    <ul>
                                        {rejectedDocs.map(r=> <li key={r._id}><strong>{r.idType||'ID'}:</strong> {r.rejectionReason || 'No reason given.'}</li>)}
                                    </ul>
                                </div>
                            )}
                            <div className="id-guidelines">
                                <p><strong>Accepted IDs (JPG, PNG, or PDF, max 10MB):</strong></p>
                                <ul>
                                    <li>PhilSys National ID</li>
                                    <li>SSS / GSIS ID</li>
                                    <li>Driver's License (front)</li>
                                    <li>Passport (bio page)</li>
                                    <li>PRC ID</li>
                                    <li>UMID</li>
                                </ul>
                                <p className="tips"><strong>Quality:</strong> Full ID visible, readable, no edits/filters.</p>
                            </div>
                            <form onSubmit={handleIdSubmit}>
                                <label className="file-drop">
                                    <input type="file" accept="image/*,application/pdf" multiple disabled={uploading} onChange={(e)=> { if(e.target.files) handleAddFiles(e.target.files); e.target.value=''; }} />
                                    <span>Add ID Image(s) or PDF</span>
                                </label>
                                <div className="id-file-list">
                                    {idEntries.map((entry, idx)=>(
                                        <div className={`id-file-row ${isMobile ? 'mobile-file-row' : ''}`} key={idx}>
                                            <div className="name">{entry.file.name}</div>
                                            <select value={entry.idType} onChange={(e)=>updateIdType(idx, e.target.value)} disabled={uploading}>
                                                <option value="">Select ID Type</option>
                                                {idTypeOptions.map(opt=> <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                            <button type="button" className="remove" onClick={()=>removeEntry(idx)} disabled={uploading}>✕</button>
                                        </div>
                                    ))}
                                    {idEntries.length === 0 && <div className="placeholder">No files added yet.</div>}
                                </div>
                                {error && <div className="id-modal-error">{error}</div>}
                                <div className={`id-modal-actions ${isMobile ? 'mobile-actions' : ''}`}>
                                    <button type="button" onClick={()=>{
                                        setDismissedRejected(true);
                                        setShowIdModal(false);
                                    }} disabled={uploading}>Cancel</button>
                                    <button type="submit" disabled={uploading || idEntries.length===0}>{uploading ? 'Uploading...' : (hasRejected? 'Re-upload ID' : 'Submit for Review')}</button>
                                </div>
                                <div className="review-time">Typical review time: <strong>within 1 hour</strong>.</div>
                            </form>
                        </div>
                        <div className="modal-footer"><div style={{fontSize:'.65rem',color:'#6b7280'}}>False / altered IDs = suspension.</div></div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Sidebar;