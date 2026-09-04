const express = require('express');
const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { requireWorkspaceMembership } = require('../middleware/requireWorkspaceMembership');
const {
  createBoard, findByWorkspace, findBoardById, findBoardByCalendarToken,
  updateColumns, updateBoardCalendarToken, deleteBoard,
} = require('../models/boards');
const { createTask, findByBoard, deleteByBoard } = require('../models/tasks');
const { findTemplateById } = require('../models/templates');
const { findByWorkspace: findUsersByWorkspace } = require('../models/users');
const { computeStatus } = require('../utils/dependencies');
const { createEvents } = require('ics');

const router = express.Router();

// GET /api/boards?workspaceId= — list boards for the workspace
router.get('/', authenticate, requireWorkspaceMembership(), async (req, res) => {
  try {
    const boards = await findByWorkspace(req.workspaceId);
    res.json(boards);
  } catch (err) {
    console.error('Get boards error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/boards — create a new board (head/joint_head only)
router.post('/', authenticate, requireWorkspaceMembership({ minRole: 'joint_head' }), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const board = await createBoard({ name, workspaceId: req.workspaceId });
    res.status(201).json(board);
  } catch (err) {
    console.error('Create board error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/boards/from-template — create board from template (head/joint_head only)
router.post('/from-template', authenticate, requireWorkspaceMembership({ minRole: 'joint_head', fromTemplate: true }), async (req, res) => {
  try {
    const { templateId, eventDate, name } = req.body;
    if (!templateId || !eventDate || !name) {
      return res.status(400).json({ error: 'templateId, eventDate, and name are required' });
    }

    const template = req.template;
    const workspaceId = req.workspaceId;

    const board = await createBoard({ name, workspaceId, eventDate });
    const boardId = board._id.toString();
    const toDoColumnId = board.columns[0]._id.toString();

    const members = await findUsersByWorkspace(workspaceId);
    const blueprintToTaskId = new Map();
    const eventDateMs = new Date(eventDate).getTime();
    const msPerDay = 24 * 60 * 60 * 1000;

    const createdTasks = [];
    for (let i = 0; i < template.taskBlueprint.length; i++) {
      const bp = template.taskBlueprint[i];
      const dueDate = new Date(eventDateMs + (bp.offsetDaysFromEvent || 0) * msPerDay);

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
        dependsOn: [],
      });

      blueprintToTaskId.set(bp.blueprintId, task._id.toString());
      createdTasks.push({ ...task, originalBp: bp });
    }

    // Pass 2: wire dependencies
    for (const item of createdTasks) {
      if (item.originalBp.dependsOnBlueprintIds && item.originalBp.dependsOnBlueprintIds.length > 0) {
        const realDepIds = item.originalBp.dependsOnBlueprintIds
          .map((bpId) => blueprintToTaskId.get(bpId))
          .filter(Boolean);

        if (realDepIds.length > 0) {
          const { getDb } = require('../db');
          await getDb().collection('tasks').updateOne(
            { _id: item._id },
            { $set: { dependsOn: realDepIds.map((id) => new ObjectId(id)) } }
          );
        }
      }
    }

    // Pass 3: lock any tasks that have unresolved dependencies
    const allTasks = await findByBoard(boardId);
    const { getDb } = require('../db');
    const tasksCol = getDb().collection('tasks');
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

    const finalTasks = await findByBoard(boardId);
    res.status(201).json({ board, tasks: finalTasks });
  } catch (err) {
    console.error('Create board from template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/boards/:id/columns — update columns (head/joint_head only)
router.patch('/:id/columns', authenticate, requireWorkspaceMembership({ minRole: 'joint_head', fromBoard: true }), async (req, res) => {
  try {
    const { columns } = req.body;
    if (!columns || !Array.isArray(columns)) {
      return res.status(400).json({ error: 'columns array is required' });
    }

    await updateColumns(req.params.id, columns);
    const updated = await findBoardById(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('Update columns error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/boards/:id — delete board and its tasks (head/joint_head only)
router.delete('/:id', authenticate, requireWorkspaceMembership({ minRole: 'joint_head', fromBoard: true }), async (req, res) => {
  try {
    await deleteByBoard(req.params.id);
    await deleteBoard(req.params.id);
    res.json({ message: 'Board deleted' });
  } catch (err) {
    console.error('Delete board error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Calendar Feed ─────────────────────────────────────────────────────────────

// POST /api/boards/:id/calendar/token — generate (or regenerate) a calendar token
router.post('/:id/calendar/token', authenticate, requireWorkspaceMembership({ minRole: 'joint_head', fromBoard: true }), async (req, res) => {
  try {
    const token = uuidv4();
    await updateBoardCalendarToken(req.params.id, token);
    res.json({ calendarToken: token });
  } catch (err) {
    console.error('Generate calendar token error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/boards/:id/calendar/token — revoke calendar token
router.delete('/:id/calendar/token', authenticate, requireWorkspaceMembership({ minRole: 'joint_head', fromBoard: true }), async (req, res) => {
  try {
    await updateBoardCalendarToken(req.params.id, null);
    res.json({ message: 'Calendar token revoked' });
  } catch (err) {
    console.error('Revoke calendar token error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/boards/:id/calendar.ics?token=... — unauthenticated .ics feed
// token IS the auth — no JWT required (calendar apps can't send custom headers)
router.get('/:id/calendar.ics', async (req, res) => {
  try {
    const { token, download } = req.query;
    if (!token) return res.status(401).json({ error: 'token query param required' });

    const board = await findBoardById(req.params.id);
    if (!board || !board.calendarToken || board.calendarToken !== token) {
      return res.status(401).send('Invalid or revoked calendar token');
    }

    // Fetch workspace members via findUsersByWorkspace (which reads memberships)
    const members = await findUsersByWorkspace(board.workspaceId.toString());
    const memberMap = new Map(members.map((m) => [m._id.toString(), m.name]));

    // All non-done tasks with a due date
    const tasks = await findByBoard(req.params.id);
    const eligibleTasks = tasks.filter((t) => t.status !== 'done' && t.dueDate);

    // Build ics events
    const events = eligibleTasks.map((t) => {
      const d = new Date(t.dueDate);
      const assigneeName = t.assignedTo ? (memberMap.get(t.assignedTo.toString()) || 'Unassigned') : 'Unassigned';
      return {
        title: t.title,
        description: `Assignee: ${assigneeName} | Status: ${t.status}${t.description ? '\n' + t.description : ''}`,
        start: [d.getFullYear(), d.getMonth() + 1, d.getDate()],
        end: [d.getFullYear(), d.getMonth() + 1, d.getDate()],
        uid: t._id.toString() + '@taskforge',
        status: t.status === 'in_progress' ? 'TENTATIVE' : 'CONFIRMED',
      };
    });

    const { error: icsError, value: icsString } = createEvents(events);
    if (icsError) {
      console.error('ICS generation error:', icsError);
      return res.status(500).send('Failed to generate calendar');
    }

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    if (download === 'true') {
      res.setHeader('Content-Disposition', `attachment; filename="${board.name.replace(/[^a-z0-9]/gi, '_')}.ics"`);
    }
    res.send(icsString);
  } catch (err) {
    console.error('Calendar feed error:', err);
    res.status(500).send('Internal server error');
  }
});

module.exports = router;
