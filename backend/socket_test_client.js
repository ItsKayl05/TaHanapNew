import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:4000';
const roomId = 'test-room';

console.log('Starting socket.io test client...');

const socket = io(SOCKET_URL, { transports: ['websocket','polling'], reconnectionAttempts: 5, timeout: 20000 });

socket.on('connect', () => {
  console.log('client: connected', socket.id);
  socket.emit('joinRoom', { roomId });
  console.log('client: joinRoom emitted for', roomId);
  // send a test message
  const msg = { roomId, message: 'hello from test client', sender: 'test-client', receiver: 'server', createdAt: new Date().toISOString() };
  socket.emit('sendMessage', msg);
  console.log('client: sendMessage emitted', msg);
});

socket.on('receiveMessage', (m) => {
  console.log('client: receiveMessage', m);
});

socket.on('connect_error', (err) => console.warn('client: connect_error', err && err.message ? err.message : err));
socket.on('connect_timeout', () => console.warn('client: connect_timeout'));
socket.on('reconnect_attempt', n => console.log('client: reconnect_attempt', n));
socket.on('reconnect_failed', () => console.warn('client: reconnect_failed'));
socket.on('disconnect', (reason) => console.log('client: disconnected', reason));

// exit after 10 seconds
setTimeout(() => {
  console.log('client: closing');
  socket.disconnect();
  process.exit(0);
}, 10000);
