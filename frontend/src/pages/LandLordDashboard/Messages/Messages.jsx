
import React, { useEffect, useState, useContext } from 'react';
import './Messages.css';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import ChatBox from '../../../components/ChatBox/ChatBox';
import { buildApi } from '../../../services/apiConfig';
import DashboardSidebar from '../../../components/DashboardSidebar/DashboardSidebar';
import { AuthContext } from '../../../context/AuthContext';
import { buildUpload } from '../../../services/apiConfig';


const Messages = ({ currentUserId }) => {
  const { logout } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchParams] = useSearchParams();
  const targetUserId = searchParams.get('user');
  const propertyTitle = searchParams.get('propertyTitle') || '';
  const propertyImage = searchParams.get('propertyImage') || '';
  const propertyPrice = searchParams.get('propertyPrice') || '';
  const propertyId = searchParams.get('propertyId') || '';

  useEffect(() => {
    const token = localStorage.getItem('user_token');
    // Fetch all messages involving the current user
    axios.get(buildApi('/messages/threads'), {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        const payload = Array.isArray(res.data) ? res.data : (res.data && Array.isArray(res.data.data) ? res.data.data : []);
        if (!Array.isArray(res.data)) console.warn('Unexpected /api/messages/threads shape (landlord), normalized to array:', res.data);
        setUsers(payload);
        // If coming from Contact Owner, auto-select the target user
        if (targetUserId) {
          const found = payload.find(u => String(u._id) === String(targetUserId));
          if (found) {
            setSelectedUser(found);
          } else {
            // Try to fetch the public landlord profile if not in threads
            axios.get(buildApi(`/users/landlord/${targetUserId}/profile`))
              .then(r => {
                const u = r.data;
                let userWithProperty = { _id: String(u.id || u._id), fullName: u.fullName, username: u.username, profilePic: u.profilePic };
                if (propertyTitle || propertyImage || propertyPrice || propertyId) {
                  userWithProperty.propertyInfo = {
                    title: propertyTitle,
                    images: propertyImage ? [decodeURIComponent(propertyImage)] : [],
                    price: propertyPrice,
                    _id: propertyId
                  };
                }
                setSelectedUser(userWithProperty);
              })
              .catch(() => {});
          }
        }
      })
      .catch((err) => { console.error('Error fetching landlord threads:', err); setUsers([]); });
  }, [currentUserId, targetUserId]);

  // helper to resolve avatar src from various possible fields
  const avatarFor = (u) => {
    const p = (u && (u.profilePic || u.profilePicUrl || u.avatar || u.image));
    if (!p) return '/default-avatar.png';
    if (typeof p === 'string' && p.startsWith('http')) return p;
    return buildUpload(`/profiles/${p}`);
  };

  return (
    <div className="landlord-dashboard dashboard-container">
      <DashboardSidebar
        variant="landlord"
        links={[
          { key:'profile', label:'Profile', to:'/landlord-profile', active: false },
          { key:'add-properties', label:'Add Properties', to:'/add-properties', active: false },
          { key:'my-properties', label:'My Properties', to:'/my-properties', active: false },
          { key:'properties', label:'All Listings', to:'/properties', active: false },
          { key:'property-map', label:'Property Map', to:'/property-map', active: false },
          { key:'messages', label:'Messages', to:'/landlord/messages', active: true },
        ]}
        onNavigate={(to)=> { window.location.href = to; }}
        onLogout={() => { logout(); localStorage.removeItem('user_token'); window.dispatchEvent(new Event('storage')); }}
      />
      <main className="landlord-messages-main messages-page" style={{flex:1}}>
        <div className="messages-layout" style={{display:'flex',height:'80vh'}}>
          <div className="messages-list" style={{width:320, borderRight:'1px solid #eee', overflowY:'auto', background:'#f7f7fa'}}>
  <h3 className="messages-title">Messages</h3>
        {(!Array.isArray(users) || users.length === 0) && <div style={{color:'#888',padding:'1em'}}>No conversations yet.</div>}
        {Array.isArray(users) && users.map(u => (
          <div key={u._id} style={{padding:'0.75em 1em',cursor:'pointer',background:selectedUser&&selectedUser._id===u._id?'#e6eaff':'',display:'flex',alignItems:'center',borderRadius:8,margin:'0.25em 0'}} onClick={()=>setSelectedUser(u)}>
            <img src={avatarFor(u)} alt={u.fullName} style={{width:40,height:40,borderRadius:'50%',marginRight:12,objectFit:'cover',border:'2px solid #dbeafe'}} />
            <div style={{flex:1}}>
              <div className="messages-username">{u.fullName || u.username}</div>
              {u.lastMessage && <div style={{fontSize:'0.95em',color:'#888',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{u.lastMessage}</div>}
            </div>
          </div>
        ))}
      </div>
  <div className="messages-area" style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:'#f4f6fb'}}>
        {selectedUser ? (
          <ChatBox
            currentUserId={currentUserId}
            targetUserId={selectedUser._id}
            targetUserName={selectedUser.fullName || selectedUser.username}
            targetUserAvatar={selectedUser.profilePic}
            large
            propertyTitle={selectedUser.propertyInfo?.title || ''}
            propertyImage={selectedUser.propertyInfo?.images?.[0] || ''}
            propertyPrice={selectedUser.propertyInfo?.price || ''}
            propertyId={selectedUser.propertyInfo?._id || ''}
          />
        ) : (
          <div style={{color:'#888',fontSize:'1.1em'}}>Select a conversation to start chatting</div>
        )}
          </div>
          </div>
      </main>
    </div>
  );
};

export default Messages;
