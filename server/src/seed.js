require('dotenv').config();
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const { connectDb, getDb, closeDb } = require('./db');

async function seed() {
  await connectDb(process.env.MONGODB_URI);
  const db = getDb();

  // Clean existing data
  await db.collection('users').deleteMany({});
  await db.collection('workspaces').deleteMany({});
  await db.collection('boards').deleteMany({});
  await db.collection('tasks').deleteMany({});
  await db.collection('eventTemplates').deleteMany({});
  await db.collection('notifications').deleteMany({});

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

  // ─── Tasks (with dependency chain) ────────────────
  const now = new Date();
  const inFive = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  const inTen = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  const inFifteen = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

  // Pre-generate task IDs for cross-referencing dependencies
  const taskAId = new ObjectId();
  const taskBId = new ObjectId();
  const taskCId = new ObjectId();

  const tasks = [
    // ── Dependency chain: A → B → C ──
    {
      _id: taskAId,
      boardId, columnId: col1, order: 0,
      title: 'Design recruitment poster',
      description: 'Create the visual design for the poster — this is the first step in the chain',
      assignedTo: memberId, dueDate: inFive,
      dependsOn: [], status: 'open', escalationLevel: 0,
      createdAt: now, updatedAt: now,
    },
    {
      _id: taskBId,
      boardId, columnId: col1, order: 1,
      title: 'Print recruitment posters',
      description: 'Send the approved design to the print shop (depends on poster design)',
      assignedTo: jhId, dueDate: inTen,
      dependsOn: [taskAId], status: 'locked', escalationLevel: 0,
      createdAt: now, updatedAt: now,
    },
    {
      _id: taskCId,
      boardId, columnId: col1, order: 2,
      title: 'Distribute posters on campus',
      description: 'Pin up posters on all notice boards (depends on printing)',
      assignedTo: memberId, dueDate: inFifteen,
      dependsOn: [taskBId], status: 'locked', escalationLevel: 0,
      createdAt: now, updatedAt: now,
    },

    // ── Independent tasks ──
    {
      boardId, columnId: col1, order: 3,
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
      boardId, columnId: col1, order: 4,
      title: 'Assign panel interviewers',
      description: 'Map team members to interview slots',
      assignedTo: headId, dueDate: inTen,
      dependsOn: [], status: 'open', escalationLevel: 0,
      createdAt: now, updatedAt: now,
    },
  ];

  await db.collection('tasks').insertMany(tasks);

  // ─── Demo Template: Freshers Induction ─────────────
  const bp1 = new ObjectId().toString();
  const bp2 = new ObjectId().toString();
  const bp3 = new ObjectId().toString();
  const bp4 = new ObjectId().toString();
  const bp5 = new ObjectId().toString();

  await db.collection('eventTemplates').insertOne({
    workspaceId: wsId,
    name: 'Freshers Induction',
    taskBlueprint: [
      { blueprintId: bp1, title: 'Book auditorium', role: 'head', offsetDaysFromEvent: -14, dependsOn: [] },
      { blueprintId: bp2, title: 'Send invitations to freshers', role: 'member', offsetDaysFromEvent: -7, dependsOn: [bp1] },
      { blueprintId: bp3, title: 'Prepare welcome kits', role: 'joint_head', offsetDaysFromEvent: -7, dependsOn: [] },
      { blueprintId: bp4, title: 'Rehearse event flow', role: 'head', offsetDaysFromEvent: -3, dependsOn: [bp1, bp3] },
      { blueprintId: bp5, title: 'Set up venue', role: 'member', offsetDaysFromEvent: -1, dependsOn: [bp4] },
    ],
    createdAt: now,
    updatedAt: now,
  });

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
  console.log('Dependency chain: Design poster → Print posters → Distribute posters');
  console.log('  "Print posters" is LOCKED (depends on "Design poster")');
  console.log('  "Distribute posters" is LOCKED (depends on "Print posters")');
  console.log('');

  await closeDb();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
