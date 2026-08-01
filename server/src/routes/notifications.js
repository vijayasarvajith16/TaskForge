const express = require('express');
const { authenticate } = require('../middleware/auth');
const { findByUser, countUnread, markRead, markAllRead } = require('../models/notifications');

const router = express.Router();

// GET /api/notifications — list notifications for the current user
router.get('/', authenticate, async (req, res) => {
  try {
    const notifications = await findByUser(req.user._id.toString());
    const unreadCount = await countUnread(req.user._id.toString());
    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/notifications/:id/read — mark a single notification as read
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    await markRead(req.params.id);
    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/notifications/read-all — mark all notifications as read
router.patch('/read-all', authenticate, async (req, res) => {
  try {
    await markAllRead(req.user._id.toString());
    res.json({ message: 'All marked as read' });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
