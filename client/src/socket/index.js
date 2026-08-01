import { io } from 'socket.io-client';

let socket = null;

/**
 * Get or create the socket connection. Authenticates via JWT.
 * Reconnects automatically if the token changes.
 */
export function getSocket() {
  const token = localStorage.getItem('token');
  if (!token) {
    // No token — disconnect if connected
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    return null;
  }

  // If socket exists and is connected (or connecting), return it
  if (socket && (socket.connected || socket.active)) {
    return socket;
  }

  // Clean up old socket if it exists
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  socket = io('http://localhost:3001', {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  return socket;
}

/**
 * Join a board room. Leaves any previous board room first (server-side).
 */
export function joinBoard(boardId) {
  const s = getSocket();
  if (s) {
    s.emit('join_board', { boardId });
    console.log('Emitted join_board:', boardId);
  }
}

/**
 * Disconnect and clean up.
 */
export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export default { getSocket, joinBoard, disconnectSocket };
