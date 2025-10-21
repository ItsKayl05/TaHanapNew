import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { buildApi } from '../services/apiConfig';

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const userToken = localStorage.getItem('user_token');
    
    if (!userToken) {
      console.log('🔐 No user token found, skipping Socket.IO connection');
      return;
    }

    // FIXED: Use your actual backend URL for Socket.IO
    const apiUrl = buildApi('');
    let socketBaseUrl = apiUrl.replace('/api', '');
    
    // Ensure we're using the correct backend URL
    if (socketBaseUrl.includes('tahanap-backend.onrender.com')) {
      socketBaseUrl = socketBaseUrl.replace('tahanap-backend.onrender.com', 'tahanap-backend-g6mx.onrender.com');
    }
    
    console.log('🔌 Initializing Socket.IO connection to:', socketBaseUrl);

    // Enhanced socket configuration
    const socketConfig = {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
      forceNew: true,
      autoConnect: true,
      path: '/socket.io/',
      auth: {
        token: userToken
      },
      query: {
        token: userToken,
        client: 'web',
        origin: window.location.origin
      }
    };

    try {
      socketRef.current = io(socketBaseUrl, socketConfig);
      const s = socketRef.current;

      const onConnect = () => {
        console.log('✅ Socket.IO connected successfully to', socketBaseUrl);
        setConnected(true);
        setConnectionError(null);
        setRetryCount(0);
      };

      const onDisconnect = (reason) => {
        console.log('❌ Socket.IO disconnected:', reason);
        setConnected(false);
        
        if (reason === 'io server disconnect') {
          setTimeout(() => {
            if (s && !s.connected) {
              s.connect();
            }
          }, 3000);
        }
      };

      const onConnectError = (err) => {
        console.warn('⚠️ Socket.IO connect_error:', err.message);
        setConnectionError(err.message);
        setConnected(false);
        setRetryCount(prev => prev + 1);
        
        // Don't block on CORS errors - they're common with Socket.IO
        if (err.message.includes('CORS') || err.message.includes('cross-origin')) {
          console.log('CORS error detected - this is normal with Socket.IO fallbacks');
        }
      };

      const onReconnectAttempt = (attempt) => {
        console.log(`🔄 Socket.IO reconnection attempt ${attempt}`);
      };

      const onReconnect = (attempt) => {
        console.log(`✅ Socket.IO reconnected after ${attempt} attempts`);
        setConnected(true);
        setConnectionError(null);
      };

      const onReconnectError = (err) => {
        console.error('❌ Socket.IO reconnection error:', err);
      };

      const onReconnectFailed = () => {
        console.error('💥 Socket.IO reconnection failed');
        setConnectionError('Failed to reconnect to server');
      };

      // Register event listeners
      s.on('connect', onConnect);
      s.on('disconnect', onDisconnect);
      s.on('connect_error', onConnectError);
      s.on('reconnect_attempt', onReconnectAttempt);
      s.on('reconnect', onReconnect);
      s.on('reconnect_error', onReconnectError);
      s.on('reconnect_failed', onReconnectFailed);

      // Connect manually
      if (!s.connected) {
        s.connect();
      }

    } catch (error) {
      console.error('💥 Failed to initialize Socket.IO:', error);
      setConnectionError('Failed to initialize connection');
    }

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up Socket.IO connection');
      
      if (socketRef.current) {
        const s = socketRef.current;
        
        // Remove all event listeners
        s.off('connect');
        s.off('disconnect');
        s.off('connect_error');
        s.off('reconnect_attempt');
        s.off('reconnect');
        s.off('reconnect_error');
        s.off('reconnect_failed');
        
        // Disconnect socket
        if (s.connected) {
          s.disconnect();
        }
        
        socketRef.current = null;
      }
      
      setConnected(false);
    };
  }, []);

  // Context value
  const contextValue = {
    socket: socketRef.current,
    connected,
    connectionError,
    retryCount,
    reconnect: () => {
      if (socketRef.current && !socketRef.current.connected) {
        console.log('🔄 Manual reconnection triggered');
        socketRef.current.connect();
      }
    },
    disconnect: () => {
      if (socketRef.current && socketRef.current.connected) {
        console.log('🔌 Manual disconnection triggered');
        socketRef.current.disconnect();
      }
    }
  };

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;