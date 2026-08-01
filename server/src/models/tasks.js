const { ObjectId } = require('mongodb');
const { getDb } = require('../db');

function col() {
  return getDb().collection('tasks');
}

async function createTask({ boardId, columnId, title, description = '', assignedTo = null, dueDate = null, dependsOn = [] }) {
  // Set order to the count of tasks already in that column
  const count = await col().countDocuments({ boardId: new ObjectId(boardId), columnId: new ObjectId(columnId) });

  const now = new Date();
  const doc = {
    boardId: new ObjectId(boardId),
    columnId: new ObjectId(columnId),
    order: count,
    title,
    description,
    assignedTo: assignedTo ? new ObjectId(assignedTo) : null,
    dueDate: dueDate ? new Date(dueDate) : null,
    dependsOn: Array.isArray(dependsOn) ? dependsOn.map((id) => new ObjectId(id)) : [],
    status: 'open',
    escalationLevel: 0,
    createdAt: now,
    updatedAt: now,
  };
  const result = await col().insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

async function findByBoard(boardId) {
  return col().find({ boardId: new ObjectId(boardId) }).sort({ order: 1 }).toArray();
}

async function findTaskById(id) {
  return col().findOne({ _id: new ObjectId(id) });
}

async function updateTask(id, updates) {
  updates.updatedAt = new Date();
  // Convert string IDs to ObjectIds where needed
  if (updates.assignedTo) updates.assignedTo = new ObjectId(updates.assignedTo);
  if (updates.columnId) updates.columnId = new ObjectId(updates.columnId);
  if (updates.dueDate) updates.dueDate = new Date(updates.dueDate);
  if (Array.isArray(updates.dependsOn)) {
    updates.dependsOn = updates.dependsOn.map((id) => new ObjectId(id));
  }

  await col().updateOne({ _id: new ObjectId(id) }, { $set: updates });
  return findTaskById(id);
}

/**
 * Bulk-update the status field for multiple tasks at once.
 * Returns the list of modified task IDs.
 */
async function bulkUpdateStatus(taskStatusPairs) {
  const ops = taskStatusPairs.map(({ taskId, status }) => ({
    updateOne: {
      filter: { _id: new ObjectId(taskId) },
      update: { $set: { status, updatedAt: new Date() } },
    },
  }));
  if (ops.length > 0) {
    await col().bulkWrite(ops);
  }
}

async function deleteTask(id) {
  await col().deleteOne({ _id: new ObjectId(id) });
}

async function deleteByBoard(boardId) {
  await col().deleteMany({ boardId: new ObjectId(boardId) });
}

module.exports = { createTask, findByBoard, findTaskById, updateTask, bulkUpdateStatus, deleteTask, deleteByBoard };
