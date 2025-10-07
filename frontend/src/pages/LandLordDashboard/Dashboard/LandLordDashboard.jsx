import React, { useEffect, useState, useContext, useMemo } from "react";
import ChatBox from '../../../components/ChatBox/ChatBox';
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import images from "../../../assets/assets";
import "./LandLordDashboard.css";
import { AuthContext } from "../../../context/AuthContext";
import Sidebar from "../Sidebar/Sidebar";
import { authFetch } from "../../../utils/authFetch";
import { buildApi } from '../../../services/apiConfig';
import { barangayList } from '../../../utils/barangayList';

const LandlordDashboard = () => {
    const { logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const [role, setRole] = useState("");
    const [userData, setUserData] = useState({ username:"", fullName:"", address:"", barangay:"", contactNumber:"", email:"", profilePic:"", showEmailPublicly:false });
    const [passwords, setPasswords] = useState({ oldPassword:"", newPassword:"" });
    const [showPasswords, setShowPasswords] = useState(false);
    const [isUpdated, setIsUpdated] = useState(false);
    const [idVerificationStatus, setIdVerificationStatus] = useState("pending");
    const [idDocs, setIdDocs] = useState([]);
    const [idFile, setIdFile] = useState(null);
    const [idType, setIdType] = useState("");

    const acceptedIDs = [
        "Philippine Passport",
        "Driver's License",
        "UMID",
        "PRC ID",
        "Postal ID",
        "National ID (PhilSys)"
    ];

    useEffect(()=>{
        const check = async () => {
            const token = localStorage.getItem('user_token');
            if(!token) return;
            try {
                const res = await fetch(buildApi('/users/check-status'),{ headers:{ Authorization:`Bearer ${token}` }});
                const data = await res.json();
                if (data.status==='banned') {
                    localStorage.setItem('is_banned','true');
                    window.dispatchEvent(new Event('storage'));
                }
            } catch(err){
                // silent
            }
        };
        check();
        const id = setInterval(check,30000);
        return ()=>clearInterval(id);
    },[]);

    useEffect(()=>{
        const token = localStorage.getItem('user_token');
        if(!token){ toast.error('No token found. Redirecting...'); navigate('/'); return; }
        try {
            const decoded = JSON.parse(atob(token.split('.')[1]));
            if(Date.now() >= decoded.exp * 1000){
                toast.error('Session expired. Please log in again.');
                localStorage.removeItem('user_token');
                navigate('/login');
                return;
            }
        } catch { /* ignore */ }

        const load = async () => {
            try {
                const response = await authFetch(buildApi('/users/landlord-dashboard'));
                const data = await response.json();
                if(!response.ok){
                    if(response.status===401){ toast.error(data.message || 'Unauthorized'); navigate('/login'); return; }
                    toast.error('Failed to load dashboard');
                    return;
                }
                if(data.role !== 'landlord'){ toast.error('Not a landlord'); navigate('/'); return; }
                setRole('landlord');
                setUserData({
                    username: data.username,
                    fullName: data.fullName || '',
                    address: data.address || '',
                    barangay: data.barangay || '',
                    contactNumber: data.contactNumber || '',
                    email: data.email || '',
                    // ✅ Use Cloudinary URL directly, fallback to default avatar
                    profilePic: data.profilePic || images.avatar,
                    showEmailPublicly: !!data.showEmailPublicly
                });
                setIdDocs(data.idDocuments || []);
                if (data.landlordVerified) setIdVerificationStatus('approved');
                else if((data.idDocuments||[]).some(d=>d.status==='rejected')) setIdVerificationStatus('rejected');
                else if((data.idDocuments||[]).some(d=>d.status==='pending')) setIdVerificationStatus('pending');
                else setIdVerificationStatus('pending');
            } catch(err){
                toast.error('Error fetching dashboard');
            }
        };
        load();
    },[navigate, isUpdated]);

    const passwordStrength = useMemo(()=>{
        const pw = passwords.newPassword;
        if(!pw) return { score:0, label:'Weak' };
        let s=0; if(pw.length>=8) s++; if(pw.length>=12) s++; if(/[A-Z]/.test(pw)) s++; if(/[0-9]/.test(pw)) s++; if(/[^A-Za-z0-9]/.test(pw)) s++;
        const labels=['Weak','Fair','Good','Strong','Very Strong'];
        return { score:s, label: labels[Math.min(s-1, labels.length-1)] || 'Weak' };
    },[passwords.newPassword]);

    const handleLogout = () => {
        logout();
        localStorage.removeItem('user_token');
        toast.success('Logged out');
        navigate('/');
        window.dispatchEvent(new Event('storage'));
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if(passwords.newPassword.length < 8){ toast.error('Password too short'); return; }
        try {
            const res = await fetch(buildApi('/users/change-password'),{
                method:'POST',
                headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('user_token')}` },
                body: JSON.stringify({ currentPassword: passwords.oldPassword, newPassword: passwords.newPassword })
            });
            if(res.ok){ toast.success('Password updated'); setPasswords({ oldPassword:'', newPassword:'' }); }
            else { const d= await res.json(); toast.error(d.message || 'Failed'); }
        } catch { toast.error('Error'); }
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('fullName', userData.fullName);
        formData.append('address', userData.address);
        formData.append('barangay', userData.barangay);
        formData.append('contactNumber', userData.contactNumber);
        formData.append('showEmailPublicly', userData.showEmailPublicly);
        if(userData.profilePic instanceof File) formData.append('profilePic', userData.profilePic);
        try {
            const res = await authFetch(buildApi('/users/update-profile'),{ method:'PUT', body: formData });
            if(res.ok){ toast.success('Profile saved'); setIsUpdated(p=>!p); }
            else toast.error('Update failed');
        } catch { toast.error('Error updating'); }
    };

    const handleImageChange = e => { if(e.target.files[0]) setUserData(u=>({...u, profilePic:e.target.files[0]})); };
    const handleImageClick = () => document.getElementById('file-input').click();

    const handleIDUpload = async (e) => {
        e.preventDefault();
        if(!idFile || !idType){ toast.error('Provide ID file and type'); return; }

        const allowed = ['image/jpeg','image/png','image/jpg','application/pdf'];
        if (!allowed.includes(idFile.type)) { toast.error('Only JPG, PNG or PDF allowed'); return; }
        if (idFile.size > 1024 * 1024 * 10) { toast.error('File too large. Max 10MB'); return; }

        const formData = new FormData();
        formData.append('idFiles', idFile, idFile.name);
        formData.append('idTypes', JSON.stringify([idType]));
        try {
            const res = await authFetch(buildApi('/users/upload-id'),{ method:'POST', body: formData });
            if(res.ok){
                toast.success('ID uploaded');
                setIdVerificationStatus('pending');
                try { const upd = await authFetch(buildApi('/users/landlord-dashboard')); const fresh = await upd.json(); if(upd.ok) setIdDocs(fresh.idDocuments||[]); } catch {}
                setIdFile(null); setIdType('');
            } else { const d= await res.json(); toast.error(d.message || 'Upload failed'); }
        } catch { toast.error('Error uploading'); }
    };

    return (
        <div className="dashboard-container landlord-dashboard">
            <Sidebar idVerificationStatus={idVerificationStatus} handleLogout={handleLogout} />
            <div className="main-content landlord-main">
                {role === 'landlord' ? (
                    <div className="profile-grid">
                        {/* Profile Card */}
                        <section className="card glass profile-section" aria-labelledby="profile-heading">
                            <div className="card-header"><h2 id="profile-heading">Profile</h2></div>
                            <form onSubmit={handleProfileUpdate} className="stack gap-md" noValidate>
                                <div className="avatar-wrapper" onClick={handleImageClick} role="button" tabIndex={0} aria-label="Change profile picture" onKeyDown={e=>{if(e.key==='Enter') handleImageClick();}}>
                                    <img src={userData.profilePic instanceof File ? URL.createObjectURL(userData.profilePic) : userData.profilePic} alt="Profile avatar" className="profile-pic" loading="lazy" />
                                    <span className="avatar-overlay">Change</span>
                                </div>
                                <p className="username" aria-live="polite">@{userData.username}</p>
                                <input id="file-input" type="file" accept="image/*" hidden onChange={handleImageChange} />
                                <div className="field-group">
                                    <label htmlFor="fullName">Full Name<span className="req">*</span></label>
                                    <input id="fullName" value={userData.fullName} onChange={e=>setUserData(u=>({...u, fullName:e.target.value}))} required autoComplete="name" />
                                </div>
                                <div className="field-row">
                                    <div className="field-group">
                                        <label htmlFor="address">Address<span className="req">*</span></label>
                                        <input id="address" value={userData.address} onChange={e=>setUserData(u=>({...u, address:e.target.value}))} required autoComplete="street-address" />
                                    </div>
                                    <div className="field-group">
                                        <label htmlFor="barangay">Barangay<span className="req">*</span></label>
                                        <select id="barangay" value={userData.barangay} onChange={e=>setUserData(u=>({...u, barangay:e.target.value}))} required>
                                            <option value="">Select Barangay</option>
                                            {barangayList.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>
                                    <div className="field-group">
                                        <label htmlFor="contactNumber">Contact Number<span className="req">*</span></label>
                                        <input id="contactNumber" value={userData.contactNumber} onChange={e=>setUserData(u=>({...u, contactNumber:e.target.value}))} required autoComplete="tel" />
                                    </div>
                                </div>
                                <div className="field-row">
                                    <div className="field-group">
                                        <label htmlFor="email">Email Address</label>
                                        <input id="email" value={userData.email} readOnly disabled />
                                        <label className="toggle inline" style={{marginTop:'0.5rem'}}>
                                            <input type="checkbox" checked={userData.showEmailPublicly} onChange={e=>setUserData(u=>({...u, showEmailPublicly:e.target.checked}))} /> Show email on public profile
                                        </label>
                                    </div>
                                    <div className="field-group">{/* occupation removed */}</div>
                                </div>
                                <div className="actions end"><button className="btn primary" type="submit">Save Changes</button></div>
                            </form>
                        </section>

                        {/* ID Verification */}
                        <section className="card glass id-verification-section" aria-labelledby="id-heading">
                            <div className="card-header"><h2 id="id-heading">ID Verification</h2><span className={`status-pill ${idVerificationStatus}`}>{idVerificationStatus}</span></div>
                            <div className="status-copy" aria-live="polite">
                                {idVerificationStatus==='approved' && <p className="success">Verified. You can list properties.</p>}
                                {idVerificationStatus==='rejected' && (
                                    <div className="rejected-box">
                                        <p className="error-text">Previous submission rejected. Fix issues and re-upload.</p>
                                        <ul className="rejection-reasons">{idDocs.filter(d=>d.status==='rejected').map(d=>(<li key={d._id}><strong>{d.idType||'ID'}:</strong> {d.rejectionReason||'No reason provided'}</li>))}</ul>
                                    </div>
                                )}
                                {idVerificationStatus==='pending' && <p className="pending">Pending review...</p>}
                            </div>
                            <form onSubmit={handleIDUpload} className="stack gap-sm" noValidate>
                                <div className="field-group"><label htmlFor="idType">ID Type<span className="req">*</span></label>
                                    <select id="idType" value={idType} onChange={e=>setIdType(e.target.value)} required><option value="">Select ID Type</option>{acceptedIDs.map(id=> <option key={id} value={id}>{id}</option>)}</select>
                                </div>
                                <div className="field-group"><label htmlFor="idFile">Upload ID<span className="req">*</span></label>
                                    <input id="idFile" type="file" accept="image/*,.pdf" onChange={e=>setIdFile(e.target.files[0])} required />
                                </div>
                                <div className="actions end"><button type="submit" className="btn outline" disabled={idVerificationStatus==='approved'}>{idVerificationStatus==='approved' ? 'Already Verified' : 'Upload / Re-upload'}</button></div>
                            </form>
                        </section>

                        {/* Password */}
                        <section className="card glass change-password-section" aria-labelledby="pw-heading">
                            <div className="card-header"><h2 id="pw-heading">Change Password</h2></div>
                            <form onSubmit={handlePasswordChange} className="stack gap-sm" noValidate>
                                <div className="field-group"><label htmlFor="oldPassword">Current Password<span className="req">*</span></label>
                                    <input id="oldPassword" type={showPasswords?'text':'password'} value={passwords.oldPassword} onChange={e=>setPasswords(p=>({...p, oldPassword:e.target.value}))} required autoComplete="current-password" />
                                </div>
                                <div className="field-group"><label htmlFor="newPassword">New Password<span className="req">*</span></label>
                                    <input id="newPassword" type={showPasswords?'text':'password'} value={passwords.newPassword} onChange={e=>setPasswords(p=>({...p, newPassword:e.target.value}))} required autoComplete="new-password" aria-describedby="pw-hint" />
                                    <div className="pw-meter" aria-live="polite"><div className={`bar score-${passwordStrength.score}`}></div><span className="pw-label">{passwordStrength.label}</span></div>
                                    <small id="pw-hint" className="hint">Use 12+ chars incl upper, lower, number & symbol.</small>
                                </div>
                                <label className="toggle inline"><input type="checkbox" checked={showPasswords} onChange={()=>setShowPasswords(s=>!s)} /> Show passwords</label>
                                <div className="actions end"><button type="submit" className="btn danger" disabled={!passwords.newPassword}>Update Password</button></div>
                            </form>
                        </section>
                    </div>
                ) : (
                    <div className="loading-container"><div className="spinner" aria-label="Loading" /><p>Loading dashboard...</p></div>
                )}
            </div>
        </div>
    );
};

export default LandlordDashboard;