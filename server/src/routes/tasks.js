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

    // Members can only create tasks if they're head/joint_head OR if they're the assignee
    // For Phase 1 simplicity: head and joint_head can create freely; members can create tasks assigned to themselves
    if (req.user.role === 'member' && assignedTo && assignedTo !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Members can only create tasks assigned to themselves' });
    }

    const task = await createTask({ boardId, columnId, title, description, assignedTo, dueDate });
    res.status(201).json(task);
  } catch (err) {
    console.error('Create task error:', err);
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

    // Only head/joint_head can delete tasks, or the task creator
    if (req.user.role === 'member') {
      return res.status(403).json({ error: 'Only head or joint_head can delete tasks' });
    }

    await deleteTask(req.params.id);
    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
