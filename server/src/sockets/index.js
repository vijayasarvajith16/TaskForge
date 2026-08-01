const jwt = require('jsonwebtoken');
const { findByBoard, findTaskById, updateTask } = require('../models/tasks');

// In-memory map: userId (string) -> Set<socketId>
const userSocketMap = new Map();

function initSockets(io) {
  // Authenticate socket connections via JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`Socket connected: ${socket.id} (user: ${userId})`);

    // Track userId -> socketId mapping
    if (!userSocketMap.has(userId)) {
      userSocketMap.set(userId, new Set());
    }
    userSocketMap.get(userId).add(socket.id);

    // ── join_board ─────────────────────────────────
    socket.on('join_board', ({ boardId }) => {
      socket.join(boardId);
      console.log(`Socket ${socket.id} joined board room: ${boardId}`);
    });

    // ── task_moved ─────────────────────────────────
    socket.on('task_moved', async ({ taskId, columnId, order, boardId }) => {
      try {
        const updated = await updateTask(taskId, { columnId, order });
        socket.to(boardId).emit('task_moved', {
          taskId,
          columnId: updated.columnId.toString(),
          order: updated.order,
          task: updated,
        });
      } catch (err) {
        console.error('Socket task_moved error:', err);
      }
    });

    // ── task_updated ───────────────────────────────
    socket.on('task_updated', async ({ task, boardId }) => {
      socket.to(boardId).emit('task_updated', { task });
    });

    // ── task_created ───────────────────────────────
    socket.on('task_created', ({ task, boardId }) => {
      socket.to(boardId).emit('task_created', { task });
    });

    // ── task_deleted ───────────────────────────────
    socket.on('task_deleted', ({ taskId, boardId }) => {
      socket.to(boardId).emit('task_deleted', { taskId });
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      // Clean up userId -> socketId mapping
      const sockets = userSocketMap.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) userSocketMap.delete(userId);
      }
    });
  });
}

module.exports = { initSockets, userSocketMap };
