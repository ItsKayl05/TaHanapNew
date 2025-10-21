import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE } from '../services/apiConfig';

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

  useEffect(() => {
    const userToken = localStorage.getItem('user_token');
    
    if (!userToken) {
      console.log('🔐 No user token found, skipping Socket.IO connection');
      return;
    }

    // Build Socket.IO URL from API base
    let socketUrl;
    try {
      const url = new URL(API_BASE);
      socketUrl = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`;
    } catch (error) {
      console.error('Invalid API URL:', API_BASE);
      // Fallback for development
      socketUrl = 'ws://localhost:4000';
    }

    console.log('🔌 Connecting to Socket.IO:', socketUrl);

    const socketConfig = {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      auth: {
        token: userToken
      }
    };

    try {
      socketRef.current = io(socketUrl, socketConfig);
      const socket = socketRef.current;

      const onConnect = () => {
        console.log('✅ Socket.IO connected successfully');
        setConnected(true);
        setConnectionError(null);
      };

      const onDisconnect = (reason) => {
        console.log('❌ Socket.IO disconnected:', reason);
        setConnected(false);
      };

      const onConnectError = (error) => {
        console.warn('⚠️ Socket.IO connection error:', error.message);
        setConnectionError(error.message);
        setConnected(false);
      };

      const onReconnect = (attempt) => {
        console.log(`✅ Socket.IO reconnected after ${attempt} attempts`);
        setConnected(true);
        setConnectionError(null);
      };

      const onReconnectFailed = () => {
        console.error('💥 Socket.IO reconnection failed');
        setConnectionError('Failed to reconnect to server');
      };

      // Register event listeners
      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      socket.on('connect_error', onConnectError);
      socket.on('reconnect', onReconnect);
      socket.on('reconnect_failed', onReconnectFailed);

    } catch (error) {
      console.error('💥 Failed to initialize Socket.IO:', error);
      setConnectionError('Failed to initialize connection');
    }

    return () => {
      console.log('🧹 Cleaning up Socket.IO connection');
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setConnected(false);
    };
  }, []);

  const contextValue = {
    socket: socketRef.current,
    connected,
    connectionError,
    reconnect: () => {
      if (socketRef.current) {
        socketRef.current.connect();
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