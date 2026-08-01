const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const { authenticate, authorize } = require('../middleware/auth');
const { createWorkspace, findWorkspaceById, findByInviteCode, addMember, regenerateInviteCode } = require('../models/workspaces');
const { updateUser, findByWorkspace } = require('../models/users');
const { getDb } = require('../db');

const router = express.Router();

// POST /api/workspaces — create a new workspace
router.post('/', authenticate, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    if (req.user.workspaceId) {
      return res.status(400).json({ error: 'You already belong to a workspace' });
    }

    const inviteCode = uuidv4().slice(0, 8).toUpperCase();
    const workspace = await createWorkspace({ name, ownerId: req.user._id.toString(), inviteCode });

    await updateUser(req.user._id, { workspaceId: workspace._id, role: 'head' });

    res.status(201).json(workspace);
  } catch (err) {
    console.error('Create workspace error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/workspaces/:id — get workspace details
router.get('/:id', authenticate, async (req, res) => {
  try {
    const workspace = await findWorkspaceById(req.params.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const members = await findByWorkspace(workspace._id.toString());

    res.json({
      ...workspace,
      members: members.map((m) => ({ _id: m._id, name: m.name, email: m.email, role: m.role })),
    });
  } catch (err) {
    console.error('Get workspace error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/workspaces/:id/invite — regenerate invite code (head/joint_head only)
router.post('/:id/invite', authenticate, authorize('head', 'joint_head'), async (req, res) => {
  try {
    const workspace = await findWorkspaceById(req.params.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const newCode = uuidv4().slice(0, 8).toUpperCase();
    await regenerateInviteCode(req.params.id, newCode);

    res.json({ inviteCode: newCode });
  } catch (err) {
    console.error('Invite error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/workspaces/join/:code — join via invite code
router.post('/join/:code', authenticate, async (req, res) => {
  try {
    if (req.user.workspaceId) {
      return res.status(400).json({ error: 'You already belong to a workspace' });
    }

    const workspace = await findByInviteCode(req.params.code);
    if (!workspace) return res.status(404).json({ error: 'Invalid invite code' });

    await addMember(workspace._id.toString(), req.user._id.toString());
    await updateUser(req.user._id, { workspaceId: workspace._id });

    res.json({ message: 'Joined workspace successfully', workspace });
  } catch (err) {
    console.error('Join workspace error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/workspaces/:id/workload — task count per member
router.get('/:id/workload', authenticate, async (req, res) => {
  try {
    const workspace = await findWorkspaceById(req.params.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const members = await findByWorkspace(workspace._id.toString());
    const db = getDb();

    // Get all boards in this workspace
    const boards = await db.collection('boards').find({ workspaceId: new ObjectId(req.params.id) }).toArray();
    const boardIds = boards.map((b) => b._id);

    // Get all tasks across those boards
    const tasks = boardIds.length > 0
      ? await db.collection('tasks').find({ boardId: { $in: boardIds } }).toArray()
      : [];

    // Aggregate per member
    const workload = members.map((m) => {
      const memberTasks = tasks.filter((t) => t.assignedTo && t.assignedTo.toString() === m._id.toString());
      const openCount = memberTasks.filter((t) => t.status !== 'done' && t.status !== 'locked').length;
      const totalCount = memberTasks.length;
      const doneCount = memberTasks.filter((t) => t.status === 'done').length;
      return {
        _id: m._id,
        name: m.name,
        role: m.role,
        openTasks: openCount,
        totalTasks: totalCount,
        doneTasks: doneCount,
      };
    });

    res.json(workload);
  } catch (err) {
    console.error('Workload error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/workspaces/:id/leaderboard — completed tasks per member
router.get('/:id/leaderboard', authenticate, async (req, res) => {
  try {
    const workspace = await findWorkspaceById(req.params.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const members = await findByWorkspace(workspace._id.toString());
    const db = getDb();

    const boards = await db.collection('boards').find({ workspaceId: new ObjectId(req.params.id) }).toArray();
    const boardIds = boards.map((b) => b._id);

    // Optional date range filter
    const { from, to } = req.query;
    const taskFilter = { boardId: { $in: boardIds } };
    if (from || to) {
      taskFilter.updatedAt = {};
      if (from) taskFilter.updatedAt.$gte = new Date(from);
      if (to) taskFilter.updatedAt.$lte = new Date(to);
    }

    const tasks = boardIds.length > 0
      ? await db.collection('tasks').find(taskFilter).toArray()
      : [];

    const now = new Date();
    const leaderboard = members
      .map((m) => {
        const memberTasks = tasks.filter((t) => t.assignedTo && t.assignedTo.toString() === m._id.toString());
        const done = memberTasks.filter((t) => t.status === 'done').length;
        const overdue = memberTasks.filter(
          (t) => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < now
        ).length;
        const total = done + overdue;
        const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

        return {
          _id: m._id,
          name: m.name,
          role: m.role,
          tasksCompleted: done,
          overdueCount: overdue,
          completionRate,
        };
      })
      .sort((a, b) => b.tasksCompleted - a.tasksCompleted);

    res.json(leaderboard);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
