const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticate, authorize } = require('../middleware/auth');
const { createWorkspace, findWorkspaceById, findByInviteCode, addMember, regenerateInviteCode } = require('../models/workspaces');
const { updateUser, findByWorkspace } = require('../models/users');

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

    // Update user with workspace reference and promote to head
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

    // Fetch members
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

module.exports = router;
