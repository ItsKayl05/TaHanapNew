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
    console.log('Initializing Socket.IO connection to:', API_BASE);
    
    // Enhanced socket configuration
    const socketConfig = {
      transports: ['polling', 'websocket'],
      withCredentials: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 30000,
      forceNew: true,
      autoConnect: true,
      path: '/socket.io/'
    };

    socketRef.current = io(API_BASE, socketConfig);
    const s = socketRef.current;

    const onConnect = () => {
      console.log('✅ Socket.IO connected successfully');
      setConnected(true);
      setConnectionError(null);
    };

    const onDisconnect = (reason) => {
      console.log('❌ Socket.IO disconnected:', reason);
      setConnected(false);
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        s.connect();
      }
    };

    const onConnectError = (err) => {
      console.warn('⚠️ Socket.IO connect_error:', err.message);
      setConnectionError(err.message);
      setConnected(false);
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

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up Socket.IO connection');
      
      // Remove all event listeners
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
      s.off('reconnect_attempt', onReconnectAttempt);
      s.off('reconnect', onReconnect);
      s.off('reconnect_error', onReconnectError);
      s.off('reconnect_failed', onReconnectFailed);
      
      // Disconnect socket
      if (s.connected) {
        s.disconnect();
      }
      
      socketRef.current = null;
      setConnected(false);
    };
  }, []);

  // Context value
  const contextValue = {
    socket: socketRef.current,
    connected,
    connectionError,
    reconnect: () => {
      if (socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
      }
    },
    disconnect: () => {
      if (socketRef.current && socketRef.current.connected) {
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