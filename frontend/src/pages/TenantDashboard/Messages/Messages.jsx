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
    <div className="dashboard-container">
      <TenantSidebar handleLogout={() => { logout(); localStorage.removeItem('user_token'); window.dispatchEvent(new Event('storage')); }} />
      <main className={`tenant-messages-main ${isMobile ? 'mobile-messages' : ''}`}>
        <div className="messages-content-wrapper">
          {/* Conversations List */}
          <div className={`conversations-list ${isMobile && showChat ? 'mobile-hidden' : ''}`}>
            <div className="messages-header">
              <h3 className="messages-title">Messages</h3>
              {isMobile && (
                <button className="mobile-menu-btn" onClick={() => {/* Add mobile menu functionality if needed */}}>
                  ⋮
                </button>
              )}
            </div>
            <div className="conversations-scroll-area">
              {(!Array.isArray(users) || users.length === 0) && (
                <div className="no-conversations">
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
          </div>
          
          {/* Chat Area */}
          <div className={`chat-area ${isMobile && !showChat ? 'mobile-hidden' : ''}`}>
            {selectedUser ? (
              <div className="chat-container">
                {isMobile && (
                  <div className="mobile-chat-header">
                    <button className="back-button" onClick={handleBackToList}>
                      ← Back
                    </button>
                    <span className="mobile-chat-title">
                      {selectedUser.fullName || selectedUser.username}
                    </span>
                    <div className="header-spacer"></div>
                  </div>
                )}
                <div className="chat-box-container">
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
              <div className="no-chat-selected">
                {isMobile ? 'Select a conversation to start chatting' : 'Select a conversation from the list to start chatting'}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Messages;