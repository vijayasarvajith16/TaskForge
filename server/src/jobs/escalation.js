const cron = require('node-cron');
const { getDb } = require('../db');
const { createNotification, existsForTaskLevel } = require('../models/notifications');
const { findByWorkspace: findUsersByWorkspace } = require('../models/users');

// Escalation thresholds — configurable via env for testing
const ESCALATION_HOURS = parseInt(process.env.ESCALATION_HOURS || '24', 10);

/**
 * Map of userId -> Set<socketId> for live notification push.
 * Managed by initSocketMap() in the socket layer.
 */
let userSocketMap = new Map();
let ioRef = null;

function setSocketRefs(io, socketMap) {
  ioRef = io;
  userSocketMap = socketMap;
}

/**
 * Send a notification to a user via Socket.io if they're connected.
 */
function pushToUser(userId, notification) {
  if (!ioRef) return;
  const socketIds = userSocketMap.get(userId);
  if (socketIds && socketIds.size > 0) {
    for (const sid of socketIds) {
      ioRef.to(sid).emit('notification', notification);
    }
  }
}

/**
 * Main escalation check. Finds overdue, non-done tasks and escalates.
 */
async function runEscalation() {
  const db = getDb();
  const now = new Date();

  // Find all overdue tasks that aren't done
  const overdueTasks = await db.collection('tasks').find({
    dueDate: { $lt: now },
    status: { $ne: 'done' },
    escalationLevel: { $lt: 2 },
  }).toArray();

  if (overdueTasks.length === 0) return;

  let created = 0;

  for (const task of overdueTasks) {
    const taskId = task._id.toString();

    // ── Level 0 → 1: Notify the assignee ──
    if (task.escalationLevel === 0 && task.assignedTo) {
      // Check for duplicate
      const existing = await existsForTaskLevel(taskId, 1);
      if (!existing) {
        const message = `[L1] Task "${task.title}" is overdue`;
        const notif = await createNotification({
          userId: task.assignedTo.toString(),
          taskId,
          message,
        });
        pushToUser(task.assignedTo.toString(), notif);
        created++;
      }

      // Bump escalation level
      await db.collection('tasks').updateOne(
        { _id: task._id },
        { $set: { escalationLevel: 1, updatedAt: now } }
      );
    }

    // ── Level 1 → 2: Notify joint_head(s) after threshold ──
    else if (task.escalationLevel === 1) {
      const hoursSinceOverdue = (now - new Date(task.dueDate)) / (1000 * 60 * 60);

      if (hoursSinceOverdue >= ESCALATION_HOURS) {
        // Check for duplicate
        const existing = await existsForTaskLevel(taskId, 2);
        if (!existing) {
          // Find the board to get workspaceId
          const board = await db.collection('boards').findOne({ _id: task.boardId });
          if (board) {
            // Find joint_head users in the workspace
            const members = await findUsersByWorkspace(board.workspaceId.toString());
            const jointHeads = members.filter((m) => m.role === 'joint_head' || m.role === 'head');

            // Find assignee name for the message
            const assignee = members.find((m) => m._id.toString() === task.assignedTo?.toString());
            const assigneeName = assignee?.name || 'Unknown';

            for (const jh of jointHeads) {
              const message = `[L2] Task "${task.title}" assigned to ${assigneeName} is overdue and unresolved`;
              const notif = await createNotification({
                userId: jh._id.toString(),
                taskId,
                message,
              });
              pushToUser(jh._id.toString(), notif);
              created++;
            }
          }
        }

        // Bump escalation level
        await db.collection('tasks').updateOne(
          { _id: task._id },
          { $set: { escalationLevel: 2, updatedAt: now } }
        );
      }
    }
  }

  if (created > 0) {
    console.log(`[Escalation] Created ${created} notification(s) for ${overdueTasks.length} overdue task(s)`);
  }
}

/**
 * Start the escalation cron job.
 * Default: every 30 minutes. If ESCALATION_CRON env is set, use that instead.
 */
function startEscalationJob() {
  const cronExpr = process.env.ESCALATION_CRON || '*/30 * * * *';
  console.log(`[Escalation] Cron scheduled: ${cronExpr} (threshold: ${ESCALATION_HOURS}h)`);

  cron.schedule(cronExpr, async () => {
    try {
      await runEscalation();
    } catch (err) {
      console.error('[Escalation] Job error:', err);
    }
  });
}

module.exports = { startEscalationJob, runEscalation, setSocketRefs };
