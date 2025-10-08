import React, { useEffect, useState, useContext } from 'react';
import './Messages.css';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import ChatBox from '../../../components/ChatBox/ChatBox';
import { buildUpload, normalizePayload, buildApi } from '../../../services/apiConfig';
import TenantSidebar from '../TenantSidebar/TenantSidebar';
import { AuthContext } from '../../../context/AuthContext';

const Messages = ({ currentUserId: propCurrentUserId }) => {
  const { logout } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchParams] = useSearchParams();
  const targetUserId = searchParams.get('user');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showChat, setShowChat] = useState(false);
  
  // Extract property context from URL if present
  const propertyTitle = searchParams.get('propertyTitle') || '';
  const propertyImage = searchParams.get('propertyImage') || '';
  const propertyPrice = searchParams.get('propertyPrice') || '';
  const propertyId = searchParams.get('propertyId') || '';
  const currentUserId = propCurrentUserId || localStorage.getItem('user_id') || '';

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // On mobile, if we switch to desktop size, show both panels
      if (!mobile) {
        setShowChat(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('user_token');
    axios.get(buildApi('/messages/threads'), {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        // Debug: log raw response body (helps inspect production backend shapes)
        try { console.debug('[debug] /api/messages/threads raw response:', res && res.data ? res.data : res); } catch(e) { console.debug('[debug] threads response (stringified):', JSON.stringify(res).slice(0,2000)); }
        // Normalize the response to an array using normalizePayload
        const payload = normalizePayload(res.data, ['data', 'result', 'messages', 'threads', 'applications']);
        if (!Array.isArray(res.data)) console.warn('Unexpected /api/messages/threads response shape, normalized to array:', res.data);
        setUsers(payload);
        if (targetUserId) {
          const found = payload.find(u => String(u._id || u.id) === String(targetUserId));
          if (found) {
            let userWithProperty = { ...found, _id: String(found._id || found.id) };
            // Only attach propertyInfo if present in URL (from property page)
            if (propertyTitle || propertyImage || propertyPrice || propertyId) {
              userWithProperty.propertyInfo = {
                title: propertyTitle,
                images: propertyImage ? [propertyImage] : [],
                price: propertyPrice,
                _id: propertyId
              };
            }
            setSelectedUser(userWithProperty);
            if (isMobile) setShowChat(true);
          } else {
            axios.get(buildApi(`/users/landlord/${targetUserId}/profile`))
              .then(r => {
                const u = r.data;
                let userWithProperty = { _id: String(u.id || u._id), fullName: u.fullName, username: u.username, profilePic: u.profilePic };
                if (propertyTitle || propertyImage || propertyPrice || propertyId) {
                  userWithProperty.propertyInfo = {
                    title: propertyTitle,
                    images: propertyImage ? [propertyImage] : [],
                    price: propertyPrice,
                    _id: propertyId
                  };
                }
                setSelectedUser(userWithProperty);
                if (isMobile) setShowChat(true);
              })
              .catch(() => {});
          }
        }
      })
      .catch((err) => { console.error('Error fetching threads:', err); setUsers([]); });
  }, [currentUserId, targetUserId, isMobile]);

  // When user clicks a conversation, always clear propertyInfo
  const handleSelectUser = (u) => {
    const { propertyInfo, ...rest } = u;
    setSelectedUser({ ...rest });
    if (isMobile) {
      setShowChat(true);
    }
  };

  const handleBackToList = () => {
    setShowChat(false);
    setSelectedUser(null);
  };

  return (
    <div className="tenant-dashboard dashboard-container">
      <TenantSidebar handleLogout={() => { logout(); localStorage.removeItem('user_token'); window.dispatchEvent(new Event('storage')); }} />
      <main className={`tenant-messages-main ${isMobile ? 'mobile-messages' : ''}`} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'stretch', justifyContent:'center', minHeight:'100vh', height:'100vh', boxSizing:'border-box'}}>
        <div style={{display:'flex',height:'100%',width:'100%',margin:'0 auto',boxSizing:'border-box'}}>
          {/* Conversations List */}
          <div className={`conversations-list ${isMobile && showChat ? 'mobile-hidden' : ''}`} style={{
            width: isMobile ? '100%' : 320, 
            borderRight: isMobile ? 'none' : '1px solid #eee', 
            overflowY: 'auto', 
            background: '#f7f7fa',
            display: isMobile && showChat ? 'none' : 'block'
          }}>
            <div className="messages-header">
              <h3 className="messages-title">Messages</h3>
              {isMobile && (
                <button className="mobile-menu-btn" onClick={() => {/* Add mobile menu functionality if needed */}}>
                  ⋮
                </button>
              )}
            </div>
            {(!Array.isArray(users) || users.length === 0) && (
              <div className="no-conversations" style={{color:'#888',padding:'1em', textAlign: 'center'}}>
                No conversations yet.
              </div>
            )}
            {Array.isArray(users) && users.map(u => (
              <div 
                key={u._id} 
                className={`conversation-item ${selectedUser && selectedUser._id === u._id ? 'active' : ''}`}
                onClick={() => handleSelectUser(u)}
              >
                <img 
                  src={(u.profilePic && u.profilePic.startsWith('http')) ? u.profilePic : (u.profilePic ? buildUpload(`/profiles/${u.profilePic}`) : '/default-avatar.png')} 
                  alt={u.fullName} 
                  className="conversation-avatar"
                />
                <div className="conversation-info">
                  <div className="messages-username">{u.fullName || u.username}</div>
                  {u.lastMessage && (
                    <div className="conversation-preview">
                      {u.lastMessage}
                    </div>
                  )}
                </div>
                {u.unreadCount > 0 && (
                  <span className="unread-badge">{u.unreadCount}</span>
                )}
              </div>
            ))}
          </div>
          
          {/* Chat Area */}
          <div className={`chat-area ${isMobile && !showChat ? 'mobile-hidden' : ''}`} style={{
            flex:1,
            display: isMobile && !showChat ? 'none' : 'flex',
            alignItems:'center',
            justifyContent:'center',
            background:'#f4f6fb',
            height:'100%',
            position: isMobile ? 'fixed' : 'relative',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: isMobile ? 10 : 1
          }}>
            {selectedUser ? (
              <div className="chat-container" style={{width: '100%', height: '100%', display: 'flex', flexDirection: 'column'}}>
                {isMobile && (
                  <div className="mobile-chat-header">
                    <button className="back-button" onClick={handleBackToList}>
                      ← Back
                    </button>
                    <span className="mobile-chat-title">
                      {selectedUser.fullName || selectedUser.username}
                    </span>
                    <div style={{width: '40px'}}></div> {/* Spacer for alignment */}
                  </div>
                )}
                <div style={{flex: 1, width: '100%'}}>
                  <ChatBox
                    currentUserId={String(currentUserId)}
                    targetUserId={String(selectedUser._id)}
                    targetUserName={selectedUser.fullName || selectedUser.username}
                    targetUserAvatar={selectedUser.profilePic}
                    large
                    propertyTitle={selectedUser.propertyInfo?.title || ''}
                    propertyImage={selectedUser.propertyInfo?.images?.[0] || ''}
                    propertyPrice={selectedUser.propertyInfo?.price || ''}
                    propertyId={selectedUser.propertyInfo?._id || ''}
                  />
                </div>
              </div>
            ) : (
              <div className="no-chat-selected" style={{color:'#888',fontSize:'1.1em', textAlign: 'center', padding: '20px'}}>
                {isMobile ? 'Select a conversation to start chatting' : 'Select a conversation to start chatting'}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Messages;