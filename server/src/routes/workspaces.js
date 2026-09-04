const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const { authenticate } = require('../middleware/auth');
const { requireWorkspaceMembership } = require('../middleware/requireWorkspaceMembership');
const {
  createWorkspace, findWorkspaceById, findByInviteCode,
  addMember, regenerateInviteCode, updateWorkspaceWebhook,
} = require('../models/workspaces');
const { createMembership, findMembership } = require('../models/memberships');
const { findByWorkspace } = require('../models/users');
const { getDb } = require('../db');

const router = express.Router();

// POST /api/workspaces — create a new workspace
router.post('/', authenticate, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const inviteCode = uuidv4().slice(0, 8).toUpperCase();
    const workspace = await createWorkspace({ name, ownerId: req.user._id.toString(), inviteCode });

    // Explicit membership row created with role: 'head'
    await createMembership({
      userId: req.user._id,
      workspaceId: workspace._id,
      role: 'head',
    });

    res.status(201).json(workspace);
  } catch (err) {
    console.error('Create workspace error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/workspaces/:id — get workspace details
router.get('/:id', authenticate, requireWorkspaceMembership(), async (req, res) => {
  try {
    const workspace = await findWorkspaceById(req.params.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const members = await findByWorkspace(workspace._id.toString());

    res.json({
      ...workspace,
      userRole: req.membership.role,
      members: members.map((m) => ({ _id: m._id, name: m.name, email: m.email, role: m.role })),
    });
  } catch (err) {
    console.error('Get workspace error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/workspaces/:id/invite — regenerate invite code (head/joint_head only)
router.post('/:id/invite', authenticate, requireWorkspaceMembership({ minRole: 'joint_head' }), async (req, res) => {
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
    const workspace = await findByInviteCode(req.params.code);
    if (!workspace) return res.status(404).json({ error: 'Invalid invite code' });

    const existingMembership = await findMembership(req.user._id, workspace._id);
    if (existingMembership) {
      return res.status(400).json({ error: 'You are already a member of this workspace', workspace });
    }

    // Add membership
    await createMembership({
      userId: req.user._id,
      workspaceId: workspace._id,
      role: 'member',
    });
    await addMember(workspace._id.toString(), req.user._id.toString());

    res.json({ message: 'Joined workspace successfully', workspace });
  } catch (err) {
    console.error('Join workspace error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/workspaces/:id/workload — task count per member
router.get('/:id/workload', authenticate, requireWorkspaceMembership(), async (req, res) => {
  try {
    const members = await findByWorkspace(req.params.id);
    const db = getDb();

    const boards = await db.collection('boards').find({ workspaceId: new ObjectId(req.params.id) }).toArray();
    const boardIds = boards.map((b) => b._id);

    const tasks = boardIds.length > 0
      ? await db.collection('tasks').find({ boardId: { $in: boardIds } }).toArray()
      : [];

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
router.get('/:id/leaderboard', authenticate, requireWorkspaceMembership(), async (req, res) => {
  try {
    const members = await findByWorkspace(req.params.id);
    const db = getDb();

    const boards = await db.collection('boards').find({ workspaceId: new ObjectId(req.params.id) }).toArray();
    const boardIds = boards.map((b) => b._id);

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

// ── Webhook settings ─────────────────────────────────────────────────────────

// PATCH /api/workspaces/:id/webhook — save webhook URL + provider (head/joint_head only)
router.patch('/:id/webhook', authenticate, requireWorkspaceMembership({ minRole: 'joint_head' }), async (req, res) => {
  try {
    const { webhookUrl, webhookProvider } = req.body;
    if (!webhookUrl || !webhookProvider) {
      return res.status(400).json({ error: 'webhookUrl and webhookProvider are required' });
    }
    if (!['slack', 'discord'].includes(webhookProvider)) {
      return res.status(400).json({ error: 'webhookProvider must be "slack" or "discord"' });
    }

    await updateWorkspaceWebhook(req.params.id, { webhookUrl, webhookProvider });
    res.json({ message: 'Webhook saved' });
  } catch (err) {
    console.error('Save webhook error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/workspaces/:id/webhook — remove webhook (head/joint_head only)
router.delete('/:id/webhook', authenticate, requireWorkspaceMembership({ minRole: 'joint_head' }), async (req, res) => {
  try {
    await updateWorkspaceWebhook(req.params.id, { webhookUrl: null, webhookProvider: null });
    res.json({ message: 'Webhook removed' });
  } catch (err) {
    console.error('Delete webhook error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/workspaces/:id/webhook/test — send a test message (head/joint_head only)
router.post('/:id/webhook/test', authenticate, requireWorkspaceMembership({ minRole: 'joint_head' }), async (req, res) => {
  try {
    const workspace = await findWorkspaceById(req.params.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    if (!workspace.webhookUrl) {
      return res.status(400).json({ error: 'No webhook configured' });
    }

    const { webhookUrl, webhookProvider } = workspace;
    const payload = webhookProvider === 'slack'
      ? { text: '✅ TaskForge webhook test — connection confirmed!' }
      : {
          content: '✅ TaskForge webhook test — connection confirmed!',
          embeds: [{ description: '✅ TaskForge webhook test — connection confirmed!', color: 0x22c55e }],
        };

    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      return res.status(502).json({ error: `Webhook returned HTTP ${resp.status}`, detail: body });
    }

    res.json({ message: 'Test message sent successfully' });
  } catch (err) {
    console.error('Test webhook error:', err);
    res.status(502).json({ error: 'Failed to reach webhook URL', detail: err.message });
  }
});

module.exports = router;
