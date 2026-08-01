const { ObjectId } = require('mongodb');
const { getDb } = require('../db');

function col() {
  return getDb().collection('comments');
}

async function createComment({ taskId, userId, text }) {
  const doc = {
    taskId: new ObjectId(taskId),
    userId: new ObjectId(userId),
    text,
    createdAt: new Date(),
  };
  const result = await col().insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

async function findByTask(taskId) {
  return col()
    .find({ taskId: new ObjectId(taskId) })
    .sort({ createdAt: 1 })
    .toArray();
}

module.exports = { createComment, findByTask };
