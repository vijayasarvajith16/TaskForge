const express = require('express');
const { authenticate } = require('../middleware/auth');
const { createTask, findByBoard, findTaskById, updateTask, bulkUpdateStatus, deleteTask } = require('../models/tasks');
const { findBoardById } = require('../models/boards');
const { computeStatus, findDirectDependents, validateDependencies } = require('../utils/dependencies');

const router = express.Router();

// GET /api/tasks?boardId= — list all tasks for a board
router.get('/', authenticate, async (req, res) => {
  try {
    const { boardId } = req.query;
    if (!boardId) return res.status(400).json({ error: 'boardId query param required' });

    const board = await findBoardById(boardId);
    if (!board) return res.status(404).json({ error: 'Board not found' });

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
    const { boardId, columnId, title, description, assignedTo, dueDate, dependsOn } = req.body;

    if (!boardId || !columnId || !title) {
      return res.status(400).json({ error: 'boardId, columnId, and title are required' });
    }

    const board = await findBoardById(boardId);
    if (!board) return res.status(404).json({ error: 'Board not found' });

    if (!req.user.workspaceId || req.user.workspaceId.toString() !== board.workspaceId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.user.role === 'member' && assignedTo && assignedTo !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Members can only create tasks assigned to themselves' });
    }

    // Validate dependencies if provided
    let validatedDeps = [];
    if (dependsOn && dependsOn.length > 0) {
      const allTasks = await findByBoard(boardId);
      // For new tasks, we don't have an ID yet, so skip cycle check (no other task can depend on a non-existent task)
      const boardTaskIds = new Set(allTasks.map((t) => t._id.toString()));
      for (const depId of dependsOn) {
        if (!boardTaskIds.has(depId)) {
          return res.status(400).json({ error: `Dependency ${depId} not found on this board` });
        }
      }
      validatedDeps = dependsOn;
    }

    const task = await createTask({ boardId, columnId, title, description, assignedTo, dueDate, dependsOn: validatedDeps });

    // If the task has dependencies, compute its initial status
    if (validatedDeps.length > 0) {
      const allTasks = await findByBoard(boardId);
      const status = computeStatus(task, allTasks);
      if (status !== task.status) {
        const updated = await updateTask(task._id.toString(), { status });
        const io = req.app.get('io');
        io.to(boardId).emit('task_created', { task: updated });
        return res.status(201).json(updated);
      }
    }

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

    // Locked tasks cannot be moved
    if (task.status === 'locked') {
      return res.status(400).json({ error: 'Locked tasks cannot be moved' });
    }

    const board = await findBoardById(task.boardId.toString());
    if (!req.user.workspaceId || req.user.workspaceId.toString() !== board.workspaceId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await updateTask(req.params.id, { columnId, order });
    const boardId = task.boardId.toString();

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

// PATCH /api/tasks/:id/complete — mark task as done and unlock dependents
router.patch('/:id/complete', authenticate, async (req, res) => {
  try {
    const task = await findTaskById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (task.status === 'locked') {
      return res.status(400).json({ error: 'Cannot complete a locked task' });
    }

    if (task.status === 'done') {
      return res.json(task); // Already done, no-op
    }

    const board = await findBoardById(task.boardId.toString());
    if (!req.user.workspaceId || req.user.workspaceId.toString() !== board.workspaceId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Members can only complete tasks assigned to them
    if (req.user.role === 'member' && task.assignedTo && task.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Members can only complete tasks assigned to them' });
    }

    const boardId = task.boardId.toString();

    // 1. Mark this task as done
    const completedTask = await updateTask(req.params.id, { status: 'done' });

    // 2. Find direct dependents and recompute their status
    const allTasks = await findByBoard(boardId);
    const dependents = findDirectDependents(req.params.id, allTasks);
    const unlockedIds = [];

    const statusUpdates = [];
    for (const dep of dependents) {
      const newStatus = computeStatus(dep, allTasks);
      if (newStatus !== dep.status) {
        statusUpdates.push({ taskId: dep._id.toString(), status: newStatus });
        if (dep.status === 'locked' && newStatus !== 'locked') {
          unlockedIds.push(dep._id.toString());
        }
      }
    }

    // 3. Bulk-update unlocked tasks
    if (statusUpdates.length > 0) {
      await bulkUpdateStatus(statusUpdates);
    }

    // 4. Broadcast events
    const io = req.app.get('io');
    io.to(boardId).emit('task_updated', { task: completedTask });

    if (unlockedIds.length > 0) {
      // Fetch the updated tasks so clients get full data
      const updatedAll = await findByBoard(boardId);
      const unlockedTasks = updatedAll.filter((t) => unlockedIds.includes(t._id.toString()));
      io.to(boardId).emit('tasks_unlocked', {
        taskIds: unlockedIds,
        tasks: unlockedTasks,
      });
    }

    res.json({
      task: completedTask,
      unlockedTaskIds: unlockedIds,
    });
  } catch (err) {
    console.error('Complete task error:', err);
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

    if (req.user.role === 'member' && task.assignedTo && task.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Members can only edit tasks assigned to them' });
    }

    const allowed = ['title', 'description', 'assignedTo', 'dueDate', 'columnId', 'status', 'order', 'dependsOn'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // Validate dependencies if being updated
    if (updates.dependsOn) {
      const allTasks = await findByBoard(task.boardId.toString());
      const validation = validateDependencies(req.params.id, updates.dependsOn, allTasks);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
    }

    const updated = await updateTask(req.params.id, updates);

    // Recompute status if dependsOn changed
    if (updates.dependsOn) {
      const allTasks = await findByBoard(task.boardId.toString());
      const newStatus = computeStatus(updated, allTasks);
      if (newStatus !== updated.status) {
        const recomputed = await updateTask(req.params.id, { status: newStatus });
        const io = req.app.get('io');
        io.to(task.boardId.toString()).emit('task_updated', { task: recomputed });
        return res.json(recomputed);
      }
    }

    const boardId = task.boardId.toString();
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

    if (req.user.role === 'member') {
      return res.status(403).json({ error: 'Only head or joint_head can delete tasks' });
    }

    const boardId = task.boardId.toString();
    const taskId = task._id.toString();

    await deleteTask(req.params.id);

    const io = req.app.get('io');
    io.to(boardId).emit('task_deleted', { taskId });

    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
