import React, { useEffect, useRef, useState, useContext } from 'react';
import { useSocket } from '../../context/SocketContext';
import { AuthContext } from '../../context/AuthContext';
import { buildUpload } from '../../services/apiConfig';
import axios from 'axios';
import './ChatBox.css';

// --- Helper functions ---
function renderMessageRow(msg, i, messages, currentUser, targetUserAvatar, targetUserName, buildUpload, deriveAvatarFromLocal, normalizeIdStr) {
  const myId = normalizeIdStr(
    currentUser?._id || 
    currentUser?.id || 
    localStorage.getItem('user_id')
  );
  const msgSenderId = normalizeIdStr(
    msg.senderId || 
    msg.sender?._id || 
    msg.sender?.id || 
    msg.sender
  );
  const isMyMessage = msgSenderId === myId || msg.id?.startsWith('local-');
  let messageStyle, avatarSrc;
  if (isMyMessage) {
    messageStyle = {
      rowClass: 'mine',
      bubbleClass: 'me'
    };
    avatarSrc = msg.senderAvatar || 
               (currentUser?.profilePic && (
                 currentUser.profilePic.startsWith('http')
                   ? currentUser.profilePic
                   : (currentUser.profilePic.startsWith('/uploads/') ? buildUpload(currentUser.profilePic.replace(/^\/uploads/, '')) : buildUpload(`/profiles/${currentUser.profilePic}`))
               )) ||
               deriveAvatarFromLocal() ||
               '/default-avatar.png';
  } else {
    messageStyle = {
      rowClass: 'theirs', 
      bubbleClass: 'them'
    };
    avatarSrc = msg.senderAvatar ||
               (targetUserAvatar && (
                 (targetUserAvatar.startsWith('http'))
                   ? targetUserAvatar
                   : (targetUserAvatar.startsWith('/uploads/') ? buildUpload(targetUserAvatar.replace(/^\/uploads/, '')) : buildUpload(`/profiles/${targetUserAvatar}`))
               )) ||
               buildUpload(`/profiles/${msgSenderId}_profile.jpg`) ||
               '/default-avatar.png';
  }
  const prevMsg = messages[i - 1];
  const showAvatar = !prevMsg || normalizeIdStr(prevMsg.senderId) !== msgSenderId;
  return (
    <div 
      key={msg.id || msg._id || i} 
      className={`chatbox-message-row ${messageStyle.rowClass}`}
      title={isMyMessage ? 'You' : targetUserName}
    >
      {/* Only render avatar for receiver (their) messages */}
      {!isMyMessage && (
        <img
          className="msg-avatar loading"
          src={avatarSrc}
          alt={targetUserName || 'User avatar'}
          style={{ 
            display: showAvatar ? 'block' : 'none'
          }}
          onLoad={(e) => {
            e.currentTarget.classList.remove('loading');
          }}
          onError={(e) => {
            e.currentTarget.classList.remove('loading');
            if (e.currentTarget.src !== '/default-avatar.png') {
              e.currentTarget.src = '/default-avatar.png';
            }
            e.currentTarget.onerror = null;
          }}
        />
      )}
      <div className={`chatbox-message ${messageStyle.bubbleClass}`}>
        {msg.content || msg.message}
      </div>
    </div>
  );
}

function renderMessagesWithPropertyContext(messages, currentUser, targetUserAvatar, targetUserName, buildUpload, deriveAvatarFromLocal, normalizeIdStr) {
  if (!Array.isArray(messages)) return null;
  let shownPropertyIds = new Set();
  return messages.map((msg, i) => {
    let property = msg.property && typeof msg.property === 'object' && (msg.property.title || msg.property.price || (Array.isArray(msg.property.images) && msg.property.images.length));
    if (property && !shownPropertyIds.has(msg.property._id)) {
      shownPropertyIds.add(msg.property._id);
      // DEBUG: Log property object and images
      console.log('DEBUG property in chat:', msg.property);
      // Use image as-is if it already points to uploads or is an http(s) URL; otherwise buildUpload
      let propertyImg = (Array.isArray(msg.property.images) && msg.property.images.length > 0) ? msg.property.images[0] : null;
      let propertyImgSrc = propertyImg
        ? (propertyImg.startsWith('http') ? propertyImg : (propertyImg.startsWith('/uploads/') ? buildUpload(propertyImg.replace(/^\/uploads/, '')) : buildUpload(`/properties/${propertyImg}`)))
        : '/default-property.png';
      return [
        <div key={`property-context-${msg.property._id || i}`} className="chatbox-property-context" style={{display:'flex',alignItems:'center',gap:12,background:'#23272f',padding:'12px 16px',borderRadius:10,margin:'24px 0 12px 0',color:'#fff',maxWidth:420,position:'relative',zIndex:2}}>
          <img src={propertyImgSrc} alt="Property" style={{width:64,height:64,borderRadius:8,objectFit:'cover',border:'2px solid #fff',boxShadow:'0 2px 8px #0003'}} onError={e => { e.target.onerror = null; e.target.src = '/default-property.png'; }} />
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:'1.08em',marginBottom:2}}>{msg.property.title}</div>
            {msg.property.price && <div style={{fontSize:'1em',color:'#a3e635'}}>₱{Number(msg.property.price).toLocaleString()}</div>}
          </div>
          <a href={`/property/${msg.property._id}`} style={{marginLeft:'auto',background:'linear-gradient(90deg,#2563eb 0%,#1e40af 100%)',color:'#fff',padding:'9px 20px',borderRadius:7,fontWeight:600,textDecoration:'none',fontSize:'1em',boxShadow:'0 2px 8px #2563eb55'}}>View Details</a>
        </div>,
        renderMessageRow(msg, i, messages, currentUser, targetUserAvatar, targetUserName, buildUpload, deriveAvatarFromLocal, normalizeIdStr)
      ];
    }
    return renderMessageRow(msg, i, messages, currentUser, targetUserAvatar, targetUserName, buildUpload, deriveAvatarFromLocal, normalizeIdStr);
  }).flat();
}

function deriveAvatarFromLocal() {
  // Try to get a profilePic from localStorage (customize as needed)
  const user = localStorage.getItem('current_user');
  if (user) {
    try {
      const parsed = JSON.parse(user);
      if (parsed.profilePic) {
  if (parsed.profilePic.startsWith('http')) return parsed.profilePic;
  if (parsed.profilePic.startsWith('/uploads/')) return buildUpload(parsed.profilePic.replace(/^\/uploads/, ''));
  return `/uploads/profiles/${parsed.profilePic}`;
      }
    } catch {}
  }
  return '/default-avatar.png';
}

function normalizeIdStr(id) {
  if (!id) return '';
  return typeof id === 'string' ? id : String(id);
}

// --- Main component render ---
function ChatBox({
  large,
  currentUserId,
  targetUserId,
  targetUserName,
  targetUserAvatar,
  propertyTitle,
  propertyImage,
  propertyPrice,
  propertyId
}) {
  const { currentUser } = useContext(AuthContext);

  // chatMessages must be defined before input state initialization
  const [chatMessages, setChatMessages] = useState([]);
  // Auto-fill input for new property chat (do not reference chatMessages in initializer)
  const [input, setInput] = useState(() => {
    if (propertyTitle || propertyImage || propertyPrice) {
      return 'Hello, im interested';
    }
    return '';
  });
  const messagesEndRef = useRef(null);

  // Use chatMessages for all rendering

  // Fetch messages from backend
  const fetchMessages = async () => {
    if (!targetUserId) return;
    try {
      const token = localStorage.getItem('user_token');
      const res = await axios.get(`/api/messages/${targetUserId}`, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
      setChatMessages(res.data || []);
    } catch (err) {
      setChatMessages([]);
    }
  };

  useEffect(() => {
    fetchMessages();
    // eslint-disable-next-line
  }, [targetUserId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Auto-scroll to the bottom of the chat when property context is present, so the property details card and input are always visible after navigating from 'Message Landlord'.
  useEffect(() => {
    if ((propertyTitle || propertyImage || propertyPrice) && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [propertyTitle, propertyImage, propertyPrice]);

  // Socket real-time update
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return;
    const handleReceive = (msg) => {
      if (!msg) return;
      // Only update if message is for this chat
      if (
        (msg.sender === targetUserId || msg.receiver === targetUserId) ||
        (msg.senderId === targetUserId || msg.receiverId === targetUserId)
      ) {
        fetchMessages();
      }
    };
    socket.on('receiveMessage', handleReceive);
    return () => socket.off('receiveMessage', handleReceive);
  }, [socket, targetUserId]);

  // Send message handler
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    try {
      const token = localStorage.getItem('user_token');
      // Always include propertyId only if property context exists
      const payload = {
        receiver: targetUserId,
        content: input,
      };
      if (propertyId) {
        payload.property = propertyId;
      }
      await axios.post('/api/messages', payload, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
      setInput('');
      fetchMessages();
    } catch (err) {
      // Optionally handle error
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start' }}>
      <div className={`chatbox-container ${large ? 'large' : ''}`} style={{ width: '100%', maxWidth: 600, margin: '0 auto', background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px #0001', minHeight: 400, display: 'flex', flexDirection: 'column', height: '80vh' }}>
  <div className="chatbox-header" style={{ borderBottom: '1px solid #eee', padding: '16px 20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{display:'flex',alignItems:'center',width:'100%'}}>
            <img className="chatbox-header-avatar" src={(targetUserAvatar && targetUserAvatar.startsWith('http')) ? targetUserAvatar : (targetUserAvatar ? buildUpload(`/profiles/${targetUserAvatar}`) : '/default-avatar.png')} alt={targetUserName} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', marginRight: 12 }} />
            <div className="chatbox-header-title" style={{ fontWeight: 600, fontSize: '1.1em' }}>{targetUserName}</div>
          </div>
          {/* Property context directly below landlord name */}
          {(propertyTitle || propertyImage || propertyPrice) && (
            <div className="chatbox-property-context" style={{display:'flex',alignItems:'center',gap:12,background:'#23272f',padding:'12px 16px',borderRadius:10,margin:'12px 0 0 0',color:'#fff',maxWidth:'100%',width:'100%',boxSizing:'border-box',alignSelf:'stretch'}}>
              {propertyImage && (
                      <img src={propertyImage.startsWith('http') ? propertyImage : (propertyImage.startsWith('/uploads/') ? buildUpload(propertyImage.replace(/^\/uploads/, '')) : buildUpload(`/properties/${propertyImage}`))} alt="Property" style={{width:56,height:56,borderRadius:8,objectFit:'cover',border:'2px solid #fff',boxShadow:'0 2px 8px #0003'}} onError={e => { e.target.onerror = null; e.target.src = '/default-property.png'; }} />
                    )}
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:'1.05em',marginBottom:2}}>{propertyTitle}</div>
                {propertyPrice && <div style={{fontSize:'0.98em',color:'#a3e635'}}>₱{Number(propertyPrice).toLocaleString()}</div>}
              </div>
              {propertyId && <a href={`/property/${propertyId}`} style={{marginLeft:'auto',background:'linear-gradient(90deg,#2563eb 0%,#1e40af 100%)',color:'#fff',padding:'7px 16px',borderRadius:7,fontWeight:600,textDecoration:'none',fontSize:'0.98em',boxShadow:'0 2px 8px #2563eb55'}}>View Details</a>}
            </div>
          )}
        </div>
        {/* Main flex area: messages (scrollable), bottom bar (property + input) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Scrollable messages */}
          <div className="chatbox-messages" style={{ flex: 1, overflowY: 'auto', padding: 20, width: '100%', position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {Array.isArray(chatMessages) && chatMessages.length === 0 && (
              <div style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>No messages yet.</div>
            )}
            {renderMessagesWithPropertyContext(chatMessages, currentUser, targetUserAvatar, targetUserName, buildUpload, deriveAvatarFromLocal, normalizeIdStr)}
            <div ref={messagesEndRef} />
          </div>
          {/* Bottom bar: input only, property context is now always at the top */}
          <div style={{width:'100%',background:'#fff',boxSizing:'border-box',paddingBottom:0}}>
            <form className="chatbox-input-row" onSubmit={sendMessage} style={{ display: 'flex', alignItems: 'center', borderTop: '1px solid #eee', padding: '12px 16px', width: '100%', background: '#fff' }}>
              <input value={input} onChange={e => setInput(e.target.value)} placeholder="Type a message..." style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #ccc', marginRight: 8 }} />
              <button type="submit" style={{ padding: '10px 20px', borderRadius: 8, background: '#2563eb', color: '#fff', fontWeight: 600, border: 'none' }}>Send</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatBox;

