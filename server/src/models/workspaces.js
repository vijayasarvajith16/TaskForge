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
    webhookUrl: null,
    webhookProvider: null,
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

async function updateWorkspaceWebhook(workspaceId, { webhookUrl, webhookProvider }) {
  await col().updateOne(
    { _id: new ObjectId(workspaceId) },
    { $set: { webhookUrl: webhookUrl || null, webhookProvider: webhookProvider || null } }
  );
}

module.exports = {
  createWorkspace,
  findWorkspaceById,
  findByInviteCode,
  addMember,
  regenerateInviteCode,
  updateWorkspaceWebhook,
};
