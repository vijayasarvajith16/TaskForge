const express = require('express');
const { ObjectId } = require('mongodb');
const { authenticate, authorize } = require('../middleware/auth');
const { createBoard, findByWorkspace, findBoardById, updateColumns, deleteBoard } = require('../models/boards');
const { createTask, findByBoard, deleteByBoard } = require('../models/tasks');
const { findTemplateById } = require('../models/templates');
const { findByWorkspace: findUsersByWorkspace } = require('../models/users');
const { computeStatus } = require('../utils/dependencies');

const router = express.Router();

// GET /api/boards?workspaceId= — list boards for the workspace
router.get('/', authenticate, async (req, res) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId query param required' });

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

// POST /api/boards/from-template — create board from template (head/joint_head only)
router.post('/from-template', authenticate, authorize('head', 'joint_head'), async (req, res) => {
  try {
    const { templateId, eventDate, name } = req.body;
    if (!templateId || !eventDate || !name) {
      return res.status(400).json({ error: 'templateId, eventDate, and name are required' });
    }

    const template = await findTemplateById(templateId);
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const workspaceId = req.user.workspaceId.toString();
    if (template.workspaceId.toString() !== workspaceId) {
      return res.status(403).json({ error: 'Template does not belong to your workspace' });
    }

    // 1. Create the board with eventDate
    const board = await createBoard({ name, workspaceId, eventDate });
    const boardId = board._id.toString();
    const toDoColumnId = board.columns[0]._id.toString(); // First column = "To Do"

    // 2. Get workspace members for role auto-assignment
    const members = await findUsersByWorkspace(workspaceId);

    // 3. Map blueprintId -> generated real task ID
    const blueprintToTaskId = new Map();
    const eventDateMs = new Date(eventDate).getTime();
    const msPerDay = 24 * 60 * 60 * 1000;

    // First pass: create all tasks (without dependsOn initially)
    const createdTasks = [];
    for (let i = 0; i < template.taskBlueprint.length; i++) {
      const bp = template.taskBlueprint[i];
      const dueDate = new Date(eventDateMs + (bp.offsetDaysFromEvent || 0) * msPerDay);

      // Auto-assign: match role to a workspace member's role
      // The blueprint role is a free-form string like "head", "joint_head", "member"
      let assignedTo = null;
      if (bp.role) {
        const roleLower = bp.role.toLowerCase().replace(/\s+/g, '_');
        const match = members.find((m) => m.role === roleLower);
        if (match) assignedTo = match._id.toString();
      }

      const task = await createTask({
        boardId,
        columnId: toDoColumnId,
        title: bp.title,
        description: '',
        assignedTo,
        dueDate: dueDate.toISOString(),
        dependsOn: [], // Filled in second pass
      });

      blueprintToTaskId.set(bp.blueprintId, task._id.toString());
      createdTasks.push({ task, blueprint: bp });
    }

    // Second pass: set dependsOn using the real task IDs
    const { getDb } = require('../db');
    const tasksCol = getDb().collection('tasks');

    for (const { task, blueprint } of createdTasks) {
      if (blueprint.dependsOn && blueprint.dependsOn.length > 0) {
        const realDeps = blueprint.dependsOn
          .map((bpId) => blueprintToTaskId.get(bpId))
          .filter(Boolean)
          .map((id) => new ObjectId(id));

        if (realDeps.length > 0) {
          await tasksCol.updateOne(
            { _id: task._id },
            { $set: { dependsOn: realDeps, updatedAt: new Date() } }
          );
        }
      }
    }

    // 3. Run computeStatus on all tasks to set initial locked/open states
    const allTasks = await findByBoard(boardId);
    const bulkOps = [];
    for (const t of allTasks) {
      const newStatus = computeStatus(t, allTasks);
      if (newStatus !== t.status) {
        bulkOps.push({
          updateOne: {
            filter: { _id: t._id },
            update: { $set: { status: newStatus, updatedAt: new Date() } },
          },
        });
      }
    }
    if (bulkOps.length > 0) {
      await tasksCol.bulkWrite(bulkOps);
    }

    // Fetch final state
    const finalTasks = await findByBoard(boardId);

    res.status(201).json({ board, tasks: finalTasks });
  } catch (err) {
    console.error('Create board from template error:', err);
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
