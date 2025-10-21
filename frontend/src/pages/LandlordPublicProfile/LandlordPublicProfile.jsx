import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { buildApi } from '../../services/apiConfig';
import { FaArrowLeft, FaMapMarkerAlt, FaPhone, FaShieldAlt } from 'react-icons/fa';
import './LandlordPublicProfile.css';

const LandlordPublicProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(()=>{
    let active = true;
    const isValidObjectId = /^[a-f\d]{24}$/i.test(id);
    if (!isValidObjectId) {
      setError('Invalid landlord profile link.');
      setLoading(false);
      return;
    }
    (async()=>{
      try {
        const res = await fetch(buildApi(`/users/landlord/${id}/profile`));
        if(!res.ok){ throw new Error('Failed to load profile'); }
        const data = await res.json();
        if(active) { setProfile(data); setLoading(false); }
      } catch(e){ if(active){ setError('Unable to load landlord profile'); setLoading(false); } }
    })();
    return ()=>{ active = false; };
  },[id]);

  if(loading) return <div className="lp-loading"><div className="lp-spinner"/><p>Loading property owner profile...</p></div>;
  if(error || !profile) return <div className="lp-error"><h3>{error || 'Profile not found'}</h3><button onClick={()=>navigate(-1)} className="lp-back"><FaArrowLeft/> Back</button></div>;

  return (
  <div className="landlord-public-container">
      <button onClick={()=>navigate(-1)} className="lp-back"><FaArrowLeft/> Back</button>
      <div className="lp-card">
        <div className="lp-header">
          {/* ✅ Use Cloudinary URL directly, fallback to default avatar */}
          <img src={profile.profilePic || '/default-avatar.png'} alt={profile.fullName} className="lp-avatar" />
          <div className="lp-meta">
            <h1>{profile.fullName} {profile.verified && <span className="lp-verified" title="Verified"><FaShieldAlt/></span>}</h1>
            {profile.username && <p className="lp-username">@{profile.username}</p>}
            {profile.email && <p className="lp-email">Email: {profile.email}</p>}
            {profile.address && <p className="lp-address"><FaMapMarkerAlt/> {profile.address}</p>}
            {profile.contactNumber && <p className="lp-contact"><FaPhone/> {profile.contactNumber}</p>}
          </div>
        </div>
        <div className="lp-footer">
          <p className="lp-note">This is a public snapshot of the property owner's verified profile. Do not share private information without consent.</p>
        </div>
      </div>
    </div>
  );
};

export default LandlordPublicProfile;