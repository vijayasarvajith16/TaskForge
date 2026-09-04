const { ObjectId } = require('mongodb');
const { getDb } = require('../db');

function col() {
  return getDb().collection('memberships');
}

/**
 * Create a new membership for a user in a workspace.
 */
async function createMembership({ userId, workspaceId, role = 'member', joinedAt = new Date() }) {
  const doc = {
    userId: new ObjectId(userId),
    workspaceId: new ObjectId(workspaceId),
    role,
    joinedAt: new Date(joinedAt),
  };
  const result = await col().insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

/**
 * Find a specific membership by userId and workspaceId.
 */
async function findMembership(userId, workspaceId) {
  if (!userId || !workspaceId) return null;
  return col().findOne({
    userId: new ObjectId(userId),
    workspaceId: new ObjectId(workspaceId),
  });
}

/**
 * Find all memberships for a given user.
 */
async function findMembershipsByUser(userId) {
  if (!userId) return [];
  return col().find({ userId: new ObjectId(userId) }).toArray();
}

/**
 * Find all memberships for a given workspace.
 */
async function findMembershipsByWorkspace(workspaceId) {
  if (!workspaceId) return [];
  return col().find({ workspaceId: new ObjectId(workspaceId) }).toArray();
}

/**
 * Update role in a membership.
 */
async function updateMembershipRole(userId, workspaceId, role) {
  await col().updateOne(
    { userId: new ObjectId(userId), workspaceId: new ObjectId(workspaceId) },
    { $set: { role } }
  );
}

/**
 * Remove a membership.
 */
async function deleteMembership(userId, workspaceId) {
  await col().deleteOne({
    userId: new ObjectId(userId),
    workspaceId: new ObjectId(workspaceId),
  });
}

/**
 * Ensure indices for fast lookups.
 */
async function initMembershipIndexes() {
  try {
    await col().createIndex({ userId: 1, workspaceId: 1 }, { unique: true });
    await col().createIndex({ workspaceId: 1 });
  } catch (err) {
    console.error('Membership index init error:', err);
  }
}

module.exports = {
  createMembership,
  findMembership,
  findMembershipsByUser,
  findMembershipsByWorkspace,
  updateMembershipRole,
  deleteMembership,
  initMembershipIndexes,
};
