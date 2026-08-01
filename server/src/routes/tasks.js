const express = require('express');
const { authenticate } = require('../middleware/auth');
const { createTask, findByBoard, findTaskById, updateTask, deleteTask } = require('../models/tasks');
const { findBoardById } = require('../models/boards');

const router = express.Router();

// GET /api/tasks?boardId= — list all tasks for a board
router.get('/', authenticate, async (req, res) => {
  try {
    const { boardId } = req.query;
    if (!boardId) return res.status(400).json({ error: 'boardId query param required' });

    const board = await findBoardById(boardId);
    if (!board) return res.status(404).json({ error: 'Board not found' });

    // Verify user belongs to the workspace
    if (!req.user.workspaceId || req.user.workspaceId.toString() !== board.workspaceId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const tasks = await findByBoard(boardId);
    res.json(tasks);
  } catch (err) {
    console.error('Get tasks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks — create a task
router.post('/', authenticate, async (req, res) => {
  try {
    const { boardId, columnId, title, description, assignedTo, dueDate } = req.body;

    if (!boardId || !columnId || !title) {
      return res.status(400).json({ error: 'boardId, columnId, and title are required' });
    }

    const board = await findBoardById(boardId);
    if (!board) return res.status(404).json({ error: 'Board not found' });

    if (!req.user.workspaceId || req.user.workspaceId.toString() !== board.workspaceId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Members can only create tasks assigned to themselves
    if (req.user.role === 'member' && assignedTo && assignedTo !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Members can only create tasks assigned to themselves' });
    }

    const task = await createTask({ boardId, columnId, title, description, assignedTo, dueDate });

    // Broadcast to other clients in the board room
    const io = req.app.get('io');
    io.to(boardId).emit('task_created', { task });

    res.status(201).json(task);
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/tasks/:id/move — move a task to a different column/position (drag-and-drop)
router.patch('/:id/move', authenticate, async (req, res) => {
  try {
    const { columnId, order } = req.body;
    if (!columnId || order === undefined) {
      return res.status(400).json({ error: 'columnId and order are required' });
    }

    const task = await findTaskById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const board = await findBoardById(task.boardId.toString());
    if (!req.user.workspaceId || req.user.workspaceId.toString() !== board.workspaceId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await updateTask(req.params.id, { columnId, order });
    const boardId = task.boardId.toString();

    // Broadcast to other clients in the board room
    const io = req.app.get('io');
    io.to(boardId).emit('task_moved', {
      taskId: updated._id.toString(),
      columnId: updated.columnId.toString(),
      order: updated.order,
      task: updated,
    });

    res.json(updated);
  } catch (err) {
    console.error('Move task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/tasks/:id — update a task
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const task = await findTaskById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const board = await findBoardById(task.boardId.toString());
    if (!req.user.workspaceId || req.user.workspaceId.toString() !== board.workspaceId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Members can only edit tasks assigned to them
    if (req.user.role === 'member' && task.assignedTo && task.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Members can only edit tasks assigned to them' });
    }

    // Only allow safe fields to be updated
    const allowed = ['title', 'description', 'assignedTo', 'dueDate', 'columnId', 'status', 'order'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const updated = await updateTask(req.params.id, updates);
    const boardId = task.boardId.toString();

    // Broadcast to other clients in the board room
    const io = req.app.get('io');
    io.to(boardId).emit('task_updated', { task: updated });

    res.json(updated);
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/tasks/:id — delete a task
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const task = await findTaskById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const board = await findBoardById(task.boardId.toString());
    if (!req.user.workspaceId || req.user.workspaceId.toString() !== board.workspaceId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only head/joint_head can delete tasks
    if (req.user.role === 'member') {
      return res.status(403).json({ error: 'Only head or joint_head can delete tasks' });
    }

    const boardId = task.boardId.toString();
    const taskId = task._id.toString();

    await deleteTask(req.params.id);

    // Broadcast deletion to other clients
    const io = req.app.get('io');
    io.to(boardId).emit('task_deleted', { taskId });

    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
