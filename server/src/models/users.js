const { ObjectId } = require('mongodb');
const { getDb } = require('../db');

function col() {
  return getDb().collection('users');
}

async function createUser({ name, email, passwordHash, role = 'member', workspaceId = null }) {
  const doc = { name, email, passwordHash, role, workspaceId, createdAt: new Date() };
  const result = await col().insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

async function findByEmail(email) {
  return col().findOne({ email });
}

async function findUserById(id) {
  return col().findOne({ _id: new ObjectId(id) });
}

async function findByWorkspace(workspaceId) {
  return col().find({ workspaceId: new ObjectId(workspaceId) }).toArray();
}

async function updateUser(id, updates) {
  await col().updateOne({ _id: new ObjectId(id) }, { $set: updates });
}

module.exports = { createUser, findByEmail, findUserById, findByWorkspace, updateUser };
