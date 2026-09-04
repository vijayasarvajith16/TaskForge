require('dotenv').config();
const { ObjectId } = require('mongodb');
const { connectDb, getDb, closeDb } = require('../db');

async function migrate() {
  console.log('[Migration] Connecting to database...');
  await connectDb(process.env.MONGODB_URI);
  const db = getDb();

  const usersCol = db.collection('users');
  const membershipsCol = db.collection('memberships');

  // Find users with an existing workspaceId
  const usersWithWorkspace = await usersCol.find({
    workspaceId: { $ne: null, $exists: true },
  }).toArray();

  console.log(`[Migration] Found ${usersWithWorkspace.length} user(s) with workspaceId.`);

  let createdCount = 0;
  for (const user of usersWithWorkspace) {
    const existing = await membershipsCol.findOne({
      userId: user._id,
      workspaceId: new ObjectId(user.workspaceId),
    });

    if (!existing) {
      await membershipsCol.insertOne({
        userId: user._id,
        workspaceId: new ObjectId(user.workspaceId),
        role: user.role || 'member',
        joinedAt: user.createdAt || new Date(),
      });
      createdCount++;
    } else {
      console.log(`[Migration] Membership already exists for user ${user._id} in workspace ${user.workspaceId}`);
    }
  }

  console.log(`[Migration] Created ${createdCount} membership record(s).`);

  // Verify count
  const allMemberships = await membershipsCol.find({}).toArray();
  console.log(`[Migration] Total memberships now in database: ${allMemberships.length}`);

  for (const user of usersWithWorkspace) {
    const mem = await membershipsCol.findOne({
      userId: user._id,
      workspaceId: new ObjectId(user.workspaceId),
    });
    if (!mem) {
      throw new Error(`[Migration Validation Error] User ${user._id} is missing expected membership!`);
    }
    if (user.role && mem.role !== user.role) {
      throw new Error(`[Migration Validation Error] User ${user._id} role mismatch: expected ${user.role}, got ${mem.role}`);
    }
  }
  console.log('[Migration] Verification passed: every existing user has exactly one corresponding membership.');

  // Create indexes
  await membershipsCol.createIndex({ userId: 1, workspaceId: 1 }, { unique: true });
  await membershipsCol.createIndex({ workspaceId: 1 });
  console.log('[Migration] Membership indexes created.');

  // Unset workspaceId and role from users collection
  const unsetResult = await usersCol.updateMany(
    {},
    { $unset: { workspaceId: '', role: '' } }
  );
  console.log(`[Migration] Unset workspaceId & role from ${unsetResult.modifiedCount} user documents.`);

  await closeDb();
  console.log('[Migration] Completed successfully.');
}

if (require.main === module) {
  migrate().catch((err) => {
    console.error('[Migration Error]', err);
    process.exit(1);
  });
}

module.exports = { migrate };
