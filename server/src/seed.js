require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDb, getDb, closeDb } = require('./db');

async function seed() {
  await connectDb(process.env.MONGODB_URI);
  const db = getDb();

  // Clean existing data
  await db.collection('users').deleteMany({});
  await db.collection('workspaces').deleteMany({});
  await db.collection('boards').deleteMany({});
  await db.collection('tasks').deleteMany({});

  console.log('Cleared existing data.');

  const hash = await bcrypt.hash('password123', 10);

  // ─── Users ───────────────────────────────────────
  const headResult = await db.collection('users').insertOne({
    name: 'Priya Sharma',
    email: 'head@demo.com',
    passwordHash: hash,
    role: 'head',
    workspaceId: null,
    createdAt: new Date(),
  });

  const jhResult = await db.collection('users').insertOne({
    name: 'Arjun Patel',
    email: 'jh@demo.com',
    passwordHash: hash,
    role: 'joint_head',
    workspaceId: null,
    createdAt: new Date(),
  });

  const memberResult = await db.collection('users').insertOne({
    name: 'Maya Nair',
    email: 'member@demo.com',
    passwordHash: hash,
    role: 'member',
    workspaceId: null,
    createdAt: new Date(),
  });

  const headId = headResult.insertedId;
  const jhId = jhResult.insertedId;
  const memberId = memberResult.insertedId;

  // ─── Workspace ───────────────────────────────────
  const wsResult = await db.collection('workspaces').insertOne({
    name: 'HR Team Alpha',
    ownerId: headId,
    memberIds: [headId, jhId, memberId],
    inviteCode: 'DEMO2026',
    createdAt: new Date(),
  });
  const wsId = wsResult.insertedId;

  // Update users with workspaceId
  await db.collection('users').updateMany(
    { _id: { $in: [headId, jhId, memberId] } },
    { $set: { workspaceId: wsId } }
  );

  // ─── Board ───────────────────────────────────────
  const { ObjectId } = require('mongodb');
  const col1 = new ObjectId();
  const col2 = new ObjectId();
  const col3 = new ObjectId();
  const col4 = new ObjectId();

  const boardResult = await db.collection('boards').insertOne({
    name: 'Recruitment Drive - August',
    workspaceId: wsId,
    eventDate: null,
    columns: [
      { _id: col1, name: 'To Do', order: 0 },
      { _id: col2, name: 'In Progress', order: 1 },
      { _id: col3, name: 'Blocked', order: 2 },
      { _id: col4, name: 'Done', order: 3 },
    ],
    createdAt: new Date(),
  });
  const boardId = boardResult.insertedId;

  // ─── Tasks ───────────────────────────────────────
  const now = new Date();
  const inFive = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  const inTen = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

  const tasks = [
    {
      boardId, columnId: col1, order: 0,
      title: 'Draft recruitment poster',
      description: 'Design an eye-catching poster for the recruitment campaign',
      assignedTo: memberId, dueDate: inFive,
      dependsOn: [], status: 'open', escalationLevel: 0,
      createdAt: now, updatedAt: now,
    },
    {
      boardId, columnId: col1, order: 1,
      title: 'Book interview rooms',
      description: 'Reserve seminar halls A & B for interview week',
      assignedTo: jhId, dueDate: inTen,
      dependsOn: [], status: 'open', escalationLevel: 0,
      createdAt: now, updatedAt: now,
    },
    {
      boardId, columnId: col2, order: 0,
      title: 'Prepare question bank',
      description: 'Compile technical and HR interview questions',
      assignedTo: headId, dueDate: inFive,
      dependsOn: [], status: 'in_progress', escalationLevel: 0,
      createdAt: now, updatedAt: now,
    },
    {
      boardId, columnId: col3, order: 0,
      title: 'Print application forms',
      description: 'Waiting for design approval from faculty advisor',
      assignedTo: memberId, dueDate: yesterday,
      dependsOn: [], status: 'blocked', escalationLevel: 0,
      createdAt: now, updatedAt: now,
    },
    {
      boardId, columnId: col4, order: 0,
      title: 'Create Google Form for registrations',
      description: 'Online registration form is live',
      assignedTo: jhId, dueDate: yesterday,
      dependsOn: [], status: 'done', escalationLevel: 0,
      createdAt: now, updatedAt: now,
    },
    {
      boardId, columnId: col1, order: 2,
      title: 'Assign panel interviewers',
      description: 'Map team members to interview slots',
      assignedTo: headId, dueDate: inTen,
      dependsOn: [], status: 'open', escalationLevel: 0,
      createdAt: now, updatedAt: now,
    },
  ];

  await db.collection('tasks').insertMany(tasks);

  console.log('');
  console.log('✅ Seed complete!');
  console.log('');
  console.log('Demo accounts (all use password: password123):');
  console.log('  head@demo.com      — Head (Priya Sharma)');
  console.log('  jh@demo.com        — Joint Head (Arjun Patel)');
  console.log('  member@demo.com    — Member (Maya Nair)');
  console.log('');
  console.log('Workspace: HR Team Alpha');
  console.log('Invite code: DEMO2026');
  console.log(`Board: Recruitment Drive - August (${tasks.length} tasks)`);
  console.log('');

  await closeDb();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
