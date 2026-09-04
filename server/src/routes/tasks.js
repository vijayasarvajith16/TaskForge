const express = require('express');
const { ObjectId } = require('mongodb');
const { authenticate } = require('../middleware/auth');
const { requireWorkspaceMembership } = require('../middleware/requireWorkspaceMembership');
const { createTask, findByBoard, findTaskById, updateTask, bulkUpdateStatus, deleteTask } = require('../models/tasks');
const { findBoardById } = require('../models/boards');
const { computeStatus, findDirectDependents, validateDependencies } = require('../utils/dependencies');
const { logActivity, findByTask: findActivityByTask } = require('../models/activityLogs');
const { createComment, findByTask: findCommentsByTask } = require('../models/comments');
const { findUserById } = require('../models/users');
const { notifyWebhook } = require('../utils/webhook');

const router = express.Router();

// GET /api/tasks?boardId= — list all tasks for a board
router.get('/', authenticate, requireWorkspaceMembership({ fromBoard: true }), async (req, res) => {
  try {
    const boardId = req.query.boardId;
    const tasks = await findByBoard(boardId);
    res.json(tasks);
  } catch (err) {
    console.error('Get tasks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tasks/:id/detail — get task detail with activity log and comments
router.get('/:id/detail', authenticate, requireWorkspaceMembership({ fromTask: true }), async (req, res) => {
  try {
    const task = req.task;
    const [activity, comments] = await Promise.all([
      findActivityByTask(req.params.id),
      findCommentsByTask(req.params.id),
    ]);

    res.json({ task, activity, comments });
  } catch (err) {
    console.error('Get task detail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tasks/:id/activity — activity feed for a task
router.get('/:id/activity', authenticate, requireWorkspaceMembership({ fromTask: true }), async (req, res) => {
  try {
    const activity = await findActivityByTask(req.params.id);
    res.json(activity);
  } catch (err) {
    console.error('Get activity error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks/:id/comments — add a comment
router.post('/:id/comments', authenticate, requireWorkspaceMembership({ fromTask: true }), async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Comment text is required' });

    const task = req.task;

    const comment = await createComment({
      taskId: req.params.id,
      userId: req.user._id.toString(),
      text: text.trim(),
    });

    // Activity log
    await logActivity({
      taskId: req.params.id,
      userId: req.user._id.toString(),
      action: 'commented',
      detail: `${req.user.name} commented: "${text.trim().slice(0, 60)}${text.length > 60 ? '…' : ''}"`,
    });

    // Broadcast via Socket.io
    const boardId = task.boardId.toString();
    const io = req.app.get('io');
    io.to(boardId).emit('comment_added', {
      taskId: req.params.id,
      comment: { ...comment, userName: req.user.name },
    });

    res.status(201).json({ ...comment, userName: req.user.name });
  } catch (err) {
    console.error('Create comment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks — create a task
router.post('/', authenticate, requireWorkspaceMembership({ fromBoard: true }), async (req, res) => {
  try {
    const { boardId, columnId, title, description, assignedTo, dueDate, dependsOn } = req.body;

    if (!boardId || !columnId || !title) {
      return res.status(400).json({ error: 'boardId, columnId, and title are required' });
    }

    if (req.membership.role === 'member' && assignedTo && assignedTo !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Members can only create tasks assigned to themselves' });
    }

    let validatedDeps = [];
    if (dependsOn && dependsOn.length > 0) {
      const allTasks = await findByBoard(boardId);
      const boardTaskIds = new Set(allTasks.map((t) => t._id.toString()));
      for (const depId of dependsOn) {
        if (!boardTaskIds.has(depId)) {
          return res.status(400).json({ error: `Dependency ${depId} not found on this board` });
        }
      }
      validatedDeps = dependsOn;
    }

    const task = await createTask({ boardId, columnId, title, description, assignedTo, dueDate, dependsOn: validatedDeps });

    // Activity log
    await logActivity({
      taskId: task._id.toString(),
      userId: req.user._id.toString(),
      action: 'created',
      detail: `${req.user.name} created this task`,
    });

    if (assignedTo) {
      const assignee = await findUserById(assignedTo);
      await logActivity({
        taskId: task._id.toString(),
        userId: req.user._id.toString(),
        action: 'assigned',
        detail: `Assigned to ${assignee?.name || 'someone'}`,
      });
    }

    // Dependency check: lock if any dependency is not done
    if (validatedDeps.length > 0) {
      const allTasks = await findByBoard(boardId);
      const status = computeStatus(task, allTasks);
      if (status !== task.status) {
        await updateTask(task._id.toString(), { status });
        task.status = status;
      }
    }

    // Broadcast via Socket.io
    const io = req.app.get('io');
    io.to(boardId).emit('task_created', { task });

    res.status(201).json(task);
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/tasks/:id/move — move task to a different column/order
router.patch('/:id/move', authenticate, requireWorkspaceMembership({ fromTask: true }), async (req, res) => {
  try {
    const { columnId, order } = req.body;
    if (!columnId || order === undefined) {
      return res.status(400).json({ error: 'columnId and order are required' });
    }

    const task = req.task;
    const board = req.board;

    if (task.status === 'locked') {
      return res.status(400).json({ error: 'Locked tasks cannot be moved' });
    }

    const oldColId = task.columnId.toString();
    const updated = await updateTask(req.params.id, { columnId, order });
    const boardId = task.boardId.toString();

    // Activity log: only log if column actually changed
    if (oldColId !== columnId) {
      const newCol = board.columns.find((c) => c._id.toString() === columnId);
      const oldCol = board.columns.find((c) => c._id.toString() === oldColId);
      await logActivity({
        taskId: req.params.id,
        userId: req.user._id.toString(),
        action: 'moved',
        detail: `${req.user.name} moved this from ${oldCol?.name || '?'} to ${newCol?.name || '?'}`,
      });
    }

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
router.patch('/:id/complete', authenticate, requireWorkspaceMembership({ fromTask: true }), async (req, res) => {
  try {
    const task = req.task;
    const board = req.board;

    if (task.status === 'locked') {
      return res.status(400).json({ error: 'Cannot complete a locked task' });
    }

    if (task.status === 'done') {
      return res.json(task);
    }

    if (req.membership.role === 'member' && task.assignedTo && task.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Members can only complete tasks assigned to them' });
    }

    const boardId = task.boardId.toString();

    const completedTask = await updateTask(req.params.id, { status: 'done' });

    // Activity log
    await logActivity({
      taskId: req.params.id,
      userId: req.user._id.toString(),
      action: 'completed',
      detail: `${req.user.name} marked this as done`,
    });

    // Fire webhook for completion
    const workspaceId = board.workspaceId?.toString();
    if (workspaceId) {
      notifyWebhook(
        workspaceId,
        `✅ *${req.user.name}* completed *"${task.title}"* on board *"${board.name}"*`,
        { level: 0, boardId, taskId: req.params.id }
      );
    }

    // Check direct dependents
    const allTasks = await findByBoard(boardId);
    const dependents = findDirectDependents(req.params.id, allTasks);

    const unlockedIds = [];
    for (const dep of dependents) {
      const otherDeps = (dep.dependsOn || []).filter((d) => d.toString() !== req.params.id);
      const allOthersDone = otherDeps.every((dId) => {
        const dTask = allTasks.find((t) => t._id.toString() === dId.toString());
        return dTask && dTask.status === 'done';
      });
      if (allOthersDone && dep.status === 'locked') {
        unlockedIds.push(dep._id.toString());
      }
    }

    if (unlockedIds.length > 0) {
      await bulkUpdateStatus(unlockedIds, 'todo');

      for (const uId of unlockedIds) {
        await logActivity({
          taskId: uId,
          userId: req.user._id.toString(),
          action: 'unlocked',
          detail: `Unlocked automatically because "${task.title}" was completed`,
        });
      }
    }

    // Broadcast via Socket.io
    const io = req.app.get('io');
    io.to(boardId).emit('task_completed', {
      taskId: req.params.id,
      task: completedTask,
    });

    if (unlockedIds.length > 0) {
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
router.patch('/:id', authenticate, requireWorkspaceMembership({ fromTask: true }), async (req, res) => {
  try {
    const task = req.task;

    if (req.membership.role === 'member' && task.assignedTo && task.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Members can only edit tasks assigned to them' });
    }

    const allowed = ['title', 'description', 'assignedTo', 'dueDate', 'columnId', 'status', 'order', 'dependsOn'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates.dependsOn) {
      const allTasks = await findByBoard(task.boardId.toString());
      const validation = validateDependencies(req.params.id, updates.dependsOn, allTasks);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
    }

    // Track assignment changes for logging
    const oldAssignee = task.assignedTo?.toString();
    const newAssignee = updates.assignedTo;

    const updated = await updateTask(req.params.id, updates);

    // Activity log for assignment change
    if (newAssignee && newAssignee !== oldAssignee) {
      const assignee = await findUserById(newAssignee);
      await logActivity({
        taskId: req.params.id,
        userId: req.user._id.toString(),
        action: 'assigned',
        detail: `${req.user.name} assigned this to ${assignee?.name || 'someone'}`,
      });
    }

    // Activity log for other updates
    if (updates.title || updates.description || updates.dueDate) {
      await logActivity({
        taskId: req.params.id,
        userId: req.user._id.toString(),
        action: 'updated',
        detail: `${req.user.name} updated this task`,
      });
    }

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
router.delete('/:id', authenticate, requireWorkspaceMembership({ minRole: 'joint_head', fromTask: true }), async (req, res) => {
  try {
    const task = req.task;
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
