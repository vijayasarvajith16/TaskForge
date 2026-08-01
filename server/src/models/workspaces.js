const { ObjectId } = require('mongodb');
const { getDb } = require('../db');

function col() {
  return getDb().collection('workspaces');
}

async function createWorkspace({ name, ownerId, inviteCode }) {
  const doc = {
    name,
    ownerId: new ObjectId(ownerId),
    memberIds: [new ObjectId(ownerId)],
    inviteCode,
    createdAt: new Date(),
  };
  const result = await col().insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

async function findWorkspaceById(id) {
  return col().findOne({ _id: new ObjectId(id) });
}

async function findByInviteCode(code) {
  return col().findOne({ inviteCode: code });
}

async function addMember(workspaceId, userId) {
  await col().updateOne(
    { _id: new ObjectId(workspaceId) },
    { $addToSet: { memberIds: new ObjectId(userId) } }
  );
}

async function regenerateInviteCode(workspaceId, newCode) {
  await col().updateOne(
    { _id: new ObjectId(workspaceId) },
    { $set: { inviteCode: newCode } }
  );
}

module.exports = { createWorkspace, findWorkspaceById, findByInviteCode, addMember, regenerateInviteCode };
