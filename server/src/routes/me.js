const express = require('express');
const { ObjectId } = require('mongodb');
const { authenticate } = require('../middleware/auth');
const { findMembershipsByUser } = require('../models/memberships');
const { getDb } = require('../db');

const router = express.Router();

// GET /api/me/workspaces — returns list of workspaces (with role) the user belongs to
router.get('/workspaces', authenticate, async (req, res) => {
  try {
    const memberships = await findMembershipsByUser(req.user._id);
    if (memberships.length === 0) {
      return res.json([]);
    }

    const wsIds = memberships.map((m) => m.workspaceId);
    const db = getDb();
    const workspaces = await db.collection('workspaces')
      .find({ _id: { $in: wsIds } })
      .toArray();

    const wsMap = new Map(workspaces.map((w) => [w._id.toString(), w]));

    const result = memberships.map((m) => {
      const ws = wsMap.get(m.workspaceId.toString());
      return {
        workspaceId: m.workspaceId.toString(),
        name: ws?.name || 'Unnamed Workspace',
        role: m.role,
        joinedAt: m.joinedAt,
        ownerId: ws?.ownerId?.toString(),
        isOwner: ws?.ownerId?.toString() === req.user._id.toString(),
        inviteCode: ws?.inviteCode,
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Get my workspaces error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
