const { ObjectId } = require('mongodb');
const { getDb } = require('../db');

function col() {
  return getDb().collection('users');
}

/**
 * Account-level user creation.
 * Workspaces and roles are managed strictly via the memberships collection.
 */
async function createUser({ name, email, passwordHash }) {
  const doc = { name, email, passwordHash, createdAt: new Date() };
  const result = await col().insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

async function findByEmail(email) {
  return col().findOne({ email });
}

async function findUserById(id) {
  if (!id) return null;
  return col().findOne({ _id: new ObjectId(id) });
}

/**
 * Retrieve all users belonging to a workspace via the memberships collection.
 * Attaches the per-workspace role onto each returned user object.
 */
async function findByWorkspace(workspaceId) {
  if (!workspaceId) return [];
  const db = getDb();
  const memberships = await db.collection('memberships')
    .find({ workspaceId: new ObjectId(workspaceId) })
    .toArray();

  if (memberships.length === 0) return [];

  const userIds = memberships.map((m) => m.userId);
  const users = await col().find({ _id: { $in: userIds } }).toArray();

  const membershipMap = new Map(memberships.map((m) => [m.userId.toString(), m]));

  return users.map((u) => {
    const mem = membershipMap.get(u._id.toString());
    return {
      ...u,
      role: mem?.role || 'member',
      joinedAt: mem?.joinedAt || u.createdAt,
    };
  });
}

async function updateUser(id, updates) {
  await col().updateOne({ _id: new ObjectId(id) }, { $set: updates });
}

module.exports = { createUser, findByEmail, findUserById, findByWorkspace, updateUser };
