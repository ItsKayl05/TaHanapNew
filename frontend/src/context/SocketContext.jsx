import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE } from '../services/apiConfig';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // prefer polling-first for reliability
    socketRef.current = io(`${API_BASE}`, { transports: ['polling', 'websocket'], withCredentials: true, reconnectionAttempts: 10, timeout: 20000 });
    const s = socketRef.current;
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', (err) => console.warn('Socket connect_error (context):', err));

    return () => {
      try { s.disconnect(); } catch (e) {}
      socketRef.current = null;
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;
