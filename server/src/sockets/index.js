const jwt = require('jsonwebtoken');
const { findBoardById } = require('../models/boards');
const { findMembership } = require('../models/memberships');
const { updateTask } = require('../models/tasks');
const { setUserSocket, removeUserSocket } = require('../redis');

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

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`Socket connected: ${socket.id} (user: ${userId})`);

    // Join personal user room for direct notification delivery (single-instance & fallback mode)
    socket.join(`user:${userId}`);

    // Register in Redis-backed user→socket map (if Redis is active)
    await setUserSocket(userId, socket.id);

    // ── join_board ─────────────────────────────────
    socket.on('join_board', async ({ boardId }) => {
      try {
        if (!boardId) return;
        const board = await findBoardById(boardId);
        if (!board) {
          return socket.emit('error', { message: 'Board not found' });
        }

        // Verify user has explicit membership in board's workspace
        const membership = await findMembership(userId, board.workspaceId);
        if (!membership) {
          console.warn(`[Socket Security] User ${userId} denied join_board ${boardId} — not a member of workspace ${board.workspaceId}`);
          return socket.emit('error', { message: 'Not a member of this workspace' });
        }

        socket.join(boardId);
        console.log(`Socket ${socket.id} (user: ${userId}, role: ${membership.role}) joined board room: ${boardId}`);
      } catch (err) {
        console.error('Socket join_board error:', err);
      }
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

    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id}`);
      // Clean up Redis user→socket mapping
      await removeUserSocket(userId, socket.id);
    });
  });
}

module.exports = { initSockets };
