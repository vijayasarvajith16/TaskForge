const cron = require('node-cron');
const { getDb } = require('../db');
const { createNotification, existsForTaskLevel } = require('../models/notifications');
const { findByWorkspace: findUsersByWorkspace } = require('../models/users');
const { getUserSocketIds } = require('../redis');
const { notifyWebhook } = require('../utils/webhook');

// Escalation thresholds — configurable via env for testing
const ESCALATION_HOURS = parseInt(process.env.ESCALATION_HOURS || '24', 10);

/** Socket.io server reference — set once at startup. */
let ioRef = null;

function setSocketRefs(io) {
  ioRef = io;
}

/**
 * Send a notification to a user via Socket.io if they're connected.
 * Uses the Redis-backed socket map so it works across multiple server instances.
 */
async function pushToUser(userId, notification) {
  if (!ioRef) return;
  try {
    const socketIds = await getUserSocketIds(userId);
    if (socketIds && socketIds.length > 0) {
      for (const sid of socketIds) {
        ioRef.to(sid).emit('notification', notification);
      }
    } else {
      // Fallback to room-based emit for single-instance / in-memory mode
      ioRef.to(`user:${userId}`).emit('notification', notification);
    }
  } catch (err) {
    console.error('[Escalation] pushToUser error:', err.message);
  }
}

/**
 * Main escalation check. Finds overdue, non-done tasks and escalates.
 */
async function runEscalation() {
  const db = getDb();
  const now = new Date();

  const overdueTasks = await db.collection('tasks').find({
    dueDate: { $lt: now },
    status: { $ne: 'done' },
    escalationLevel: { $lt: 2 },
  }).toArray();

  if (overdueTasks.length === 0) return;

  let created = 0;

  for (const task of overdueTasks) {
    const taskId = task._id.toString();

    // Need the board to get workspaceId (used for both webhook and L2 member lookup)
    const board = await db.collection('boards').findOne({ _id: task.boardId });
    const workspaceId = board?.workspaceId?.toString();

    // ── Level 0 → 1: Notify the assignee ──
    if (task.escalationLevel === 0 && task.assignedTo) {
      const existing = await existsForTaskLevel(taskId, 1);
      if (!existing) {
        const message = `[L1] Task "${task.title}" is overdue`;
        const notif = await createNotification({
          userId: task.assignedTo.toString(),
          taskId,
          message,
        });
        await pushToUser(task.assignedTo.toString(), notif);

        // Fire-and-forget webhook
        if (workspaceId) {
          notifyWebhook(
            workspaceId,
            `⚠️ *[L1 Escalation]* Task *"${task.title}"* is overdue and has been escalated to the assignee.`,
            { level: 1 }
          );
        }
        created++;
      }

      await db.collection('tasks').updateOne(
        { _id: task._id },
        { $set: { escalationLevel: 1, updatedAt: now } }
      );
    }

    // ── Level 1 → 2: Notify joint_head(s) after threshold ──
    else if (task.escalationLevel === 1) {
      const hoursSinceOverdue = (now - new Date(task.dueDate)) / (1000 * 60 * 60);

      if (hoursSinceOverdue >= ESCALATION_HOURS) {
        const existing = await existsForTaskLevel(taskId, 2);
        if (!existing) {
          if (board) {
            const members = await findUsersByWorkspace(board.workspaceId.toString());
            const jointHeads = members.filter((m) => m.role === 'joint_head' || m.role === 'head');

            const assignee = members.find((m) => m._id.toString() === task.assignedTo?.toString());
            const assigneeName = assignee?.name || 'Unknown';

            for (const jh of jointHeads) {
              const message = `[L2] Task "${task.title}" assigned to ${assigneeName} is overdue and unresolved`;
              const notif = await createNotification({
                userId: jh._id.toString(),
                taskId,
                message,
              });
              await pushToUser(jh._id.toString(), notif);
              created++;
            }

            // Fire-and-forget webhook
            if (workspaceId) {
              notifyWebhook(
                workspaceId,
                `🚨 *[L2 Escalation]* Task *"${task.title}"* assigned to *${assigneeName}* is overdue and unresolved — joint heads notified.`,
                { level: 2 }
              );
            }
          }
        }

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
