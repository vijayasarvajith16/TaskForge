const { ObjectId } = require('mongodb');
const { getDb } = require('../db');

function col() {
  return getDb().collection('activityLogs');
}

/**
 * Log an activity entry.
 * @param {string} taskId
 * @param {string} userId
 * @param {string} action - "created" | "moved" | "assigned" | "commented" | "completed" | "updated"
 * @param {string} detail - Human-readable description
 */
async function logActivity({ taskId, userId, action, detail }) {
  const doc = {
    taskId: new ObjectId(taskId),
    userId: new ObjectId(userId),
    action,
    detail,
    timestamp: new Date(),
  };
  await col().insertOne(doc);
  return doc;
}

async function findByTask(taskId) {
  return col()
    .find({ taskId: new ObjectId(taskId) })
    .sort({ timestamp: -1 })
    .limit(100)
    .toArray();
}

module.exports = { logActivity, findByTask };
