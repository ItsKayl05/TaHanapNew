import React, { useEffect, useRef, useState, useContext } from 'react';
import { useSocket } from '../../context/SocketContext';
import { AuthContext } from '../../context/AuthContext';
import { buildUpload, buildApi } from '../../services/apiConfig';
import axios from 'axios';
import './ChatBox.css';

// --- Helper functions ---
function renderMessageRow(msg, i, messages, currentUser, targetUserAvatar, targetUserName, buildUpload, deriveAvatarFromLocal, normalizeIdStr) {
    if (!Array.isArray(messages)) return null;
    
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
                {/* Text content */}
                {msg.content && <div className="message-text">{msg.content}</div>}
                
                {/* Attachments */}
                {msg.attachments && msg.attachments.length > 0 && (
                    <div className="message-attachments">
                        {msg.attachments.map((attachment, index) => (
                            <div key={index} className="attachment-item">
                                {attachment.fileType === 'image' ? (
                                    <img 
                                        src={attachment.url} 
                                        alt={attachment.originalName}
                                        className="attachment-image"
                                        onClick={() => window.open(attachment.url, '_blank')}
                                    />
                                ) : attachment.fileType === 'video' ? (
                                    <video 
                                        controls 
                                        className="attachment-video"
                                    >
                                        <source src={attachment.url} type="video/mp4" />
                                        Your browser does not support the video tag.
                                    </video>
                                ) : (
                                    <a 
                                        href={attachment.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="attachment-file"
                                    >
                                        <div className="file-icon">📄</div>
                                        <div className="file-info">
                                            <div className="file-name">{attachment.originalName}</div>
                                            {attachment.size && (
                                                <div className="file-size">
                                                    {(attachment.size / 1024 / 1024).toFixed(2)} MB
                                                </div>
                                            )}
                                        </div>
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function renderMessagesWithPropertyContext(messages, currentUser, targetUserAvatar, targetUserName, buildUpload, deriveAvatarFromLocal, normalizeIdStr) {
    if (!Array.isArray(messages)) {
        console.warn('⚠️ messages is not an array:', messages);
        return null;
    }
    
    let shownPropertyIds = new Set();
    return messages.map((msg, i) => {
        let property = msg.property && typeof msg.property === 'object' && (msg.property.title || msg.property.price || (Array.isArray(msg.property.images) && msg.property.images.length));
        if (property && !shownPropertyIds.has(msg.property._id)) {
            shownPropertyIds.add(msg.property._id);
            
            let propertyImg = (Array.isArray(msg.property.images) && msg.property.images.length > 0) ? msg.property.images[0] : null;
            let propertyImgSrc = propertyImg
                ? (propertyImg.startsWith('http') ? propertyImg : (propertyImg.startsWith('/uploads/') ? buildUpload(propertyImg.replace(/^\/uploads/, '')) : buildUpload(`/properties/${propertyImg}`)))
                : '/default-property.png';
            
            return [
                <div key={`property-context-${msg.property._id || i}`} className="chatbox-property-context">
                    <img src={propertyImgSrc} alt="Property" className="property-context-image" />
                    <div className="property-context-info">
                        <div className="property-context-title">{msg.property.title}</div>
                        {msg.property.price && <div className="property-context-price">₱{Number(msg.property.price).toLocaleString()}</div>}
                    </div>
                    <a href={`/property/${msg.property._id}`} className="property-context-link">View Details</a>
                </div>,
                renderMessageRow(msg, i, messages, currentUser, targetUserAvatar, targetUserName, buildUpload, deriveAvatarFromLocal, normalizeIdStr)
            ];
        }
        return renderMessageRow(msg, i, messages, currentUser, targetUserAvatar, targetUserName, buildUpload, deriveAvatarFromLocal, normalizeIdStr);
    }).flat();
}

function deriveAvatarFromLocal() {
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
    const [chatMessages, setChatMessages] = useState([]);
    const [input, setInput] = useState(() => {
        if (propertyTitle || propertyImage || propertyPrice) {
            return 'Hello, im interested';
        }
        return '';
    });
    const [uploading, setUploading] = useState(false);
    const [attachments, setAttachments] = useState([]);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    // Fetch messages
    const fetchMessages = async () => {
        if (!targetUserId) {
            console.log('❌ No targetUserId provided');
            setChatMessages([]);
            return;
        }
        
        try {
            const token = localStorage.getItem('user_token');
            const res = await axios.get(buildApi(`/messages/${targetUserId}`), 
                token ? { headers: { Authorization: `Bearer ${token}` } } : {}
            );
            
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
            setChatMessages([]);
        }
    };

    useEffect(() => {
        fetchMessages();
    }, [targetUserId]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages]);

    // Socket real-time update
    const { socket } = useSocket();
    useEffect(() => {
        if (!socket) return;
        
        const handleReceive = (msg) => {
            if (!msg) return;
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

    // Handle file upload to Cloudinary
    const handleFileUpload = async (files) => {
        setUploading(true);
        const uploadedAttachments = [];
        
        try {
            for (let file of files) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('upload_preset', 'tahanap_messages'); // Your Cloudinary upload preset
                
                const uploadRes = await axios.post(
                    `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/upload`,
                    formData
                );
                
                uploadedAttachments.push({
                    url: uploadRes.data.secure_url,
                    originalName: file.name,
                    publicId: uploadRes.data.public_id,
                    fileType: file.type.startsWith('image/') ? 'image' : 
                              file.type.startsWith('video/') ? 'video' : 'document',
                    size: file.size
                });
            }
            
            setAttachments(prev => [...prev, ...uploadedAttachments]);
        } catch (err) {
            console.error('❌ Error uploading files:', err);
            alert('Failed to upload files. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    // Handle file input change
    const handleFileInputChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            handleFileUpload(files);
        }
        e.target.value = ''; // Reset input
    };

    // Remove attachment
    const removeAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    // Send message handler
    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() && attachments.length === 0) return;
        
        try {
            const token = localStorage.getItem('user_token');
            const payload = {
                receiver: targetUserId,
                content: input.trim(),
                attachments: attachments,
                property: propertyId || undefined
            };
            
            console.log('📤 Sending message with attachments:', payload);
            await axios.post(buildApi('/messages'), payload, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            setInput('');
            setAttachments([]);
            fetchMessages();
        } catch (err) {
            console.error('❌ Error sending message:', err);
        }
    };

    return (
        <div className="chatbox-wrapper">
            <div className={`chatbox-container ${large ? 'large' : ''}`}>
                
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
                
                <div className="chatbox-content">
                    <div className="chatbox-messages">
                        {!Array.isArray(chatMessages) || chatMessages.length === 0 ? (
                            <div className="chatbox-empty">
                                No messages yet. Start a conversation!
                            </div>
                        ) : (
                            renderMessagesWithPropertyContext(chatMessages, currentUser, targetUserAvatar, targetUserName, buildUpload, deriveAvatarFromLocal, normalizeIdStr)
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    
                    {/* Attachments preview */}
                    {attachments.length > 0 && (
                        <div className="attachments-preview">
                            {attachments.map((attachment, index) => (
                                <div key={index} className="attachment-preview-item">
                                    {attachment.fileType === 'image' ? (
                                        <img src={attachment.url} alt={attachment.originalName} />
                                    ) : (
                                        <div className="file-preview">
                                            <span>📄</span>
                                            <span>{attachment.originalName}</span>
                                        </div>
                                    )}
                                    <button 
                                        type="button" 
                                        className="remove-attachment"
                                        onClick={() => removeAttachment(index)}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    <div className="chatbox-input-container">
                        <form className="chatbox-input-row" onSubmit={sendMessage}>
                            <input 
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileInputChange}
                                multiple
                                accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                                style={{ display: 'none' }}
                            />
                            <button 
                                type="button"
                                className="attachment-button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                            >
                                {uploading ? '📤' : '📎'}
                            </button>
                            <input 
                                value={input} 
                                onChange={e => setInput(e.target.value)} 
                                placeholder="Type a message..." 
                                className="chatbox-input"
                                disabled={uploading}
                            />
                            <button 
                                type="submit" 
                                className="chatbox-send-button"
                                disabled={(!input.trim() && attachments.length === 0) || uploading}
                            >
                                {uploading ? 'Sending...' : 'Send'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ChatBox;