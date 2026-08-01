const jwt = require('jsonwebtoken');
const { findByBoard, findTaskById, updateTask } = require('../models/tasks');

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
    console.log(`Socket connected: ${socket.id} (user: ${socket.userId})`);

    // ── join_board ─────────────────────────────────
    socket.on('join_board', ({ boardId }) => {
      // Leave any previous board rooms (except the socket's own room)
      for (const room of socket.rooms) {
        if (room !== socket.id) socket.leave(room);
      }
      socket.join(boardId);
      console.log(`Socket ${socket.id} joined board room: ${boardId}`);
    });

    // ── task_moved ─────────────────────────────────
    // Client sends this after a drag-drop. We persist via model,
    // then broadcast to everyone else in the room.
    socket.on('task_moved', async ({ taskId, columnId, order, boardId }) => {
      try {
        const updated = await updateTask(taskId, { columnId, order });
        // Broadcast to all OTHER clients in the board room
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
      // Broadcast the full updated task to everyone else
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
    });
  });
}

module.exports = { initSockets };
