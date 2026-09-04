const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireWorkspaceMembership } = require('../middleware/requireWorkspaceMembership');
const { createPoll, findByBoard, findPollById, vote } = require('../models/polls');
const { findBoardById } = require('../models/boards');

const router = express.Router();

// POST /api/boards/:id/polls — create a poll (head/joint_head only)
router.post('/boards/:id/polls', authenticate, requireWorkspaceMembership({ minRole: 'joint_head', fromBoard: true }), async (req, res) => {
  try {
    const { question, options, closesAt } = req.body;
    if (!question || !options || options.length < 2) {
      return res.status(400).json({ error: 'question and at least 2 options are required' });
    }
    if (!closesAt) {
      return res.status(400).json({ error: 'closesAt is required' });
    }

    const poll = await createPoll({
      boardId: req.params.id,
      question,
      options,
      closesAt,
    });

    const io = req.app.get('io');
    io.to(req.params.id).emit('poll_created', { poll });

    res.status(201).json(poll);
  } catch (err) {
    console.error('Create poll error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/boards/:id/polls — list polls for a board
router.get('/boards/:id/polls', authenticate, requireWorkspaceMembership({ fromBoard: true }), async (req, res) => {
  try {
    const polls = await findByBoard(req.params.id);
    res.json(polls);
  } catch (err) {
    console.error('Get polls error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/polls/:id/vote — cast or change a vote
router.post('/polls/:id/vote', authenticate, requireWorkspaceMembership({ fromPoll: true }), async (req, res) => {
  try {
    const { optionIndex } = req.body;
    if (optionIndex === undefined) {
      return res.status(400).json({ error: 'optionIndex is required' });
    }

    const poll = req.poll;

    if (new Date() > new Date(poll.closesAt)) {
      return res.status(400).json({ error: 'This poll is closed' });
    }

    const updated = await vote(req.params.id, req.user._id.toString(), optionIndex);

    const io = req.app.get('io');
    io.to(poll.boardId.toString()).emit('poll_updated', { poll: updated });

    res.json(updated);
  } catch (err) {
    console.error('Vote error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
