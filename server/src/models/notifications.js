const { ObjectId } = require('mongodb');
const { getDb } = require('../db');

function col() {
  return getDb().collection('notifications');
}

async function createNotification({ userId, taskId, message }) {
  const doc = {
    userId: new ObjectId(userId),
    taskId: new ObjectId(taskId),
    message,
    read: false,
    createdAt: new Date(),
  };
  const result = await col().insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

async function findByUser(userId) {
  return col()
    .find({ userId: new ObjectId(userId) })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();
}

async function countUnread(userId) {
  return col().countDocuments({ userId: new ObjectId(userId), read: false });
}

async function markRead(id) {
  await col().updateOne({ _id: new ObjectId(id) }, { $set: { read: true } });
}

async function markAllRead(userId) {
  await col().updateMany(
    { userId: new ObjectId(userId), read: false },
    { $set: { read: true } }
  );
}

/**
 * Check if a notification already exists for a given task at a given escalation level.
 * Uses a convention: the message includes the escalation level marker.
 */
async function existsForTaskLevel(taskId, escalationLevel) {
  const marker = `[L${escalationLevel}]`;
  return col().findOne({
    taskId: new ObjectId(taskId),
    message: { $regex: marker.replace(/[[\]]/g, '\\$&') },
  });
}

module.exports = {
  createNotification,
  findByUser,
  countUnread,
  markRead,
  markAllRead,
  existsForTaskLevel,
};
