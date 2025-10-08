import React, { useEffect, useRef, useState, useContext } from 'react';
import { useSocket } from '../../context/SocketContext';
import { AuthContext } from '../../context/AuthContext';
import { buildUpload, buildApi } from '../../services/apiConfig';
import axios from 'axios';
import './ChatBox.css';

// ... (keep all the existing helper functions exactly the same) ...

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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // FIXED: Ensure chatMessages is always an array
  const [chatMessages, setChatMessages] = useState([]);
  
  const [input, setInput] = useState(() => {
    if (propertyTitle || propertyImage || propertyPrice) {
      return 'Hello, im interested';
    }
    return '';
  });
  
  const messagesEndRef = useRef(null);

  // Fetch messages from backend - FIXED with better error handling
  const fetchMessages = async () => {
    if (!targetUserId) {
      console.log('❌ No targetUserId provided');
      setChatMessages([]);
      return;
    }
    
    try {
      const token = localStorage.getItem('user_token');
      console.log(`🔄 Fetching messages for targetUserId: ${targetUserId}`);
      
      const res = await axios.get(buildApi(`/messages/${targetUserId}`), 
        token ? { headers: { Authorization: `Bearer ${token}` } } : {}
      );
      
      console.log('✅ Messages response:', res.data);
      
      // SAFETY CHECK: Ensure we always set an array
      if (Array.isArray(res.data)) {
        setChatMessages(res.data);
      } else if (res.data && Array.isArray(res.data.messages)) {
        setChatMessages(res.data.messages);
      } else if (res.data && Array.isArray(res.data.data)) {
        setChatMessages(res.data.data);
      } else {
        console.warn('⚠️ Unexpected messages format, setting empty array:', res.data);
        setChatMessages([]);
      }
    } catch (err) {
      console.error('❌ Error fetching messages:', err);
      // Always set to empty array on error
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

  // Auto-scroll when property context is present
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
        console.log('📨 New message received, refreshing...');
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
      const payload = {
        receiver: targetUserId,
        content: input,
      };
      
      if (propertyId) {
        payload.property = propertyId;
      }
      
      console.log('📤 Sending message:', payload);
      await axios.post(buildApi('/messages'), payload, 
        token ? { headers: { Authorization: `Bearer ${token}` } } : {}
      );
      
      setInput('');
      fetchMessages(); // Refresh messages after sending
    } catch (err) {
      console.error('❌ Error sending message:', err);
    }
  };

  // Debug current state
  useEffect(() => {
    console.log('🔧 ChatBox State:', {
      targetUserId,
      targetUserName,
      chatMessagesLength: chatMessages.length,
      chatMessagesType: typeof chatMessages,
      isArray: Array.isArray(chatMessages)
    });
  }, [chatMessages, targetUserId, targetUserName]);

  return (
    <div className={`chatbox-wrapper ${isMobile ? 'mobile-chat' : ''}`}>
      <div className={`chatbox-container ${large ? 'large' : ''} ${isMobile ? 'mobile-fullscreen' : ''}`}>
        
        <div className="chatbox-header">
          <div className="chatbox-header-main">
            <img 
              className="chatbox-header-avatar" 
              src={(targetUserAvatar && targetUserAvatar.startsWith('http')) ? targetUserAvatar : (targetUserAvatar ? buildUpload(`/profiles/${targetUserAvatar}`) : '/default-avatar.png')} 
              alt={targetUserName} 
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/default-avatar.png';
              }}
            />
            <div className="chatbox-header-title">
              {targetUserName || 'Unknown User'}
            </div>
          </div>
          
          {/* Property context directly below landlord name */}
          {(propertyTitle || propertyImage || propertyPrice) && (
            <div className="chatbox-property-context">
              {propertyImage && (
                <img 
                  src={propertyImage.startsWith('http') ? propertyImage : (propertyImage.startsWith('/uploads/') ? buildUpload(propertyImage.replace(/^\/uploads/, '')) : buildUpload(`/properties/${propertyImage}`))} 
                  alt="Property" 
                  onError={e => { 
                    e.target.onerror = null; 
                    e.target.src = '/default-property.png'; 
                  }} 
                />
              )}
              <div className="chatbox-property-info">
                <div className="chatbox-property-title">{propertyTitle || 'Property'}</div>
                {propertyPrice && <div className="chatbox-property-price">₱{Number(propertyPrice).toLocaleString()}</div>}
              </div>
              {propertyId && (
                <a 
                  href={`/property/${propertyId}`} 
                  className="chatbox-property-link"
                >
                  View Details
                </a>
              )}
            </div>
          )}
        </div>
        
        {/* Main flex area: messages (scrollable), bottom bar (property + input) */}
        <div className="chatbox-content">
          {/* Scrollable messages */}
          <div className="chatbox-messages">
            {/* FIXED: Always ensure chatMessages is treated as array */}
            {!Array.isArray(chatMessages) || chatMessages.length === 0 ? (
              <div className="chatbox-empty">
                No messages yet. Start a conversation!
              </div>
            ) : (
              renderMessagesWithPropertyContext(chatMessages, currentUser, targetUserAvatar, targetUserName, buildUpload, deriveAvatarFromLocal, normalizeIdStr)
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Bottom bar: input only */}
          <div className="chatbox-input-container">
            <form className="chatbox-input-row" onSubmit={sendMessage}>
              <input 
                value={input} 
                onChange={e => setInput(e.target.value)} 
                placeholder="Type a message..." 
                className="chatbox-input"
              />
              <button 
                type="submit" 
                className="chatbox-send-button"
                disabled={!input.trim()}
              >
                {isMobile ? '➤' : 'Send'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatBox;