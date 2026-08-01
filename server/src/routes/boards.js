const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { createBoard, findByWorkspace, findBoardById, updateColumns, deleteBoard } = require('../models/boards');
const { deleteByBoard } = require('../models/tasks');

const router = express.Router();

// GET /api/boards?workspaceId= — list boards for the workspace
router.get('/', authenticate, async (req, res) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId query param required' });

    // Verify user belongs to this workspace
    if (!req.user.workspaceId || req.user.workspaceId.toString() !== workspaceId) {
      return res.status(403).json({ error: 'You do not belong to this workspace' });
    }

    const boards = await findByWorkspace(workspaceId);
    res.json(boards);
  } catch (err) {
    console.error('Get boards error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/boards — create a new board (head/joint_head only)
router.post('/', authenticate, authorize('head', 'joint_head'), async (req, res) => {
  try {
    const { name, workspaceId } = req.body;
    if (!name || !workspaceId) return res.status(400).json({ error: 'name and workspaceId are required' });

    if (!req.user.workspaceId || req.user.workspaceId.toString() !== workspaceId) {
      return res.status(403).json({ error: 'You do not belong to this workspace' });
    }

    const board = await createBoard({ name, workspaceId });
    res.status(201).json(board);
  } catch (err) {
    console.error('Create board error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/boards/:id/columns — update columns (head/joint_head only)
router.patch('/:id/columns', authenticate, authorize('head', 'joint_head'), async (req, res) => {
  try {
    const { columns } = req.body;
    if (!columns || !Array.isArray(columns)) {
      return res.status(400).json({ error: 'columns array is required' });
    }

    const board = await findBoardById(req.params.id);
    if (!board) return res.status(404).json({ error: 'Board not found' });

    await updateColumns(req.params.id, columns);
    const updated = await findBoardById(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('Update columns error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/boards/:id — delete board and its tasks (head/joint_head only)
router.delete('/:id', authenticate, authorize('head', 'joint_head'), async (req, res) => {
  try {
    const board = await findBoardById(req.params.id);
    if (!board) return res.status(404).json({ error: 'Board not found' });

    await deleteByBoard(req.params.id);
    await deleteBoard(req.params.id);
    res.json({ message: 'Board deleted' });
  } catch (err) {
    console.error('Delete board error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
