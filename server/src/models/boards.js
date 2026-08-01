const { ObjectId } = require('mongodb');
const { getDb } = require('../db');

function col() {
  return getDb().collection('boards');
}

const DEFAULT_COLUMNS = [
  { _id: new ObjectId(), name: 'To Do', order: 0 },
  { _id: new ObjectId(), name: 'In Progress', order: 1 },
  { _id: new ObjectId(), name: 'Blocked', order: 2 },
  { _id: new ObjectId(), name: 'Done', order: 3 },
];

function freshDefaultColumns() {
  return DEFAULT_COLUMNS.map((c) => ({ ...c, _id: new ObjectId() }));
}

async function createBoard({ name, workspaceId, eventDate = null, columns = null }) {
  const doc = {
    name,
    workspaceId: new ObjectId(workspaceId),
    eventDate: eventDate ? new Date(eventDate) : null,
    columns: columns || freshDefaultColumns(),
    createdAt: new Date(),
  };
  const result = await col().insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

async function findByWorkspace(workspaceId) {
  return col().find({ workspaceId: new ObjectId(workspaceId) }).toArray();
}

async function findBoardById(id) {
  return col().findOne({ _id: new ObjectId(id) });
}

async function updateColumns(boardId, columns) {
  await col().updateOne({ _id: new ObjectId(boardId) }, { $set: { columns } });
}

async function deleteBoard(boardId) {
  await col().deleteOne({ _id: new ObjectId(boardId) });
}

module.exports = { createBoard, findByWorkspace, findBoardById, updateColumns, deleteBoard };
