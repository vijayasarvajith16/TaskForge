const test = require('node:test');
const assert = require('node:assert');
const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const http = require('http');
require('dotenv').config();

const { connectDb, getDb, closeDb } = require('../../src/db');
const { createWorkspace } = require('../../src/models/workspaces');
const { createMembership } = require('../../src/models/memberships');
const { createBoard } = require('../../src/models/boards');
const { createTask } = require('../../src/models/tasks');
const { createTemplate } = require('../../src/models/templates');
const { createPoll } = require('../../src/models/polls');

// Import Express app for direct in-memory testing
const express = require('express');
const authRoutes = require('../../src/routes/auth');
const workspaceRoutes = require('../../src/routes/workspaces');
const boardRoutes = require('../../src/routes/boards');
const taskRoutes = require('../../src/routes/tasks');
const templateRoutes = require('../../src/routes/templates');
const pollRoutes = require('../../src/routes/polls');
const meRoutes = require('../../src/routes/me');

function buildTestServer() {
  const app = express();
  app.use(express.json());
  // Mock socket.io for routes
  app.set('io', {
    to: () => ({ emit: () => {} }),
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/workspaces', workspaceRoutes);
  app.use('/api/boards', boardRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/templates', templateRoutes);
  app.use('/api/me', meRoutes);
  app.use('/api', pollRoutes);

  return http.createServer(app);
}

function makeToken(userId) {
  return jwt.sign({ userId: userId.toString() }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
}

test('Security & Multi-Workspace Isolation Test Suite', async (t) => {
  await connectDb(process.env.MONGODB_URI);
  const db = getDb();

  const server = buildTestServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  // Helper request
  async function api(method, path, { token, body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  }

  // Setup test data
  const userAId = new ObjectId();
  const userBId = new ObjectId();
  const userCId = new ObjectId(); // Member in A
  const userDId = new ObjectId(); // Member in A, Head in B

  // Insert users
  await db.collection('users').insertMany([
    { _id: userAId, name: 'Alice (Head A)', email: `alice_${Date.now()}@test.com` },
    { _id: userBId, name: 'Bob (Head B)', email: `bob_${Date.now()}@test.com` },
    { _id: userCId, name: 'Charlie (Member A)', email: `charlie_${Date.now()}@test.com` },
    { _id: userDId, name: 'David (Member A, Head B)', email: `david_${Date.now()}@test.com` },
  ]);

  const tokenA = makeToken(userAId);
  const tokenB = makeToken(userBId);
  const tokenC = makeToken(userCId);
  const tokenD = makeToken(userDId);

  // Workspace A
  const wsA = await createWorkspace({ name: 'Workspace A', ownerId: userAId.toString(), inviteCode: 'WSA123' });
  await createMembership({ userId: userAId, workspaceId: wsA._id, role: 'head' });
  await createMembership({ userId: userCId, workspaceId: wsA._id, role: 'member' });
  await createMembership({ userId: userDId, workspaceId: wsA._id, role: 'member' });

  // Workspace B
  const wsB = await createWorkspace({ name: 'Workspace B', ownerId: userBId.toString(), inviteCode: 'WSB123' });
  await createMembership({ userId: userBId, workspaceId: wsB._id, role: 'head' });
  await createMembership({ userId: userDId, workspaceId: wsB._id, role: 'head' });

  // Boards
  const boardA = await createBoard({ name: 'Board A1', workspaceId: wsA._id.toString() });
  const boardB = await createBoard({ name: 'Board B1', workspaceId: wsB._id.toString() });

  // Tasks
  const taskA = await createTask({
    boardId: boardA._id.toString(),
    columnId: boardA.columns[0]._id.toString(),
    title: 'Task in A',
  });
  const taskB = await createTask({
    boardId: boardB._id.toString(),
    columnId: boardB.columns[0]._id.toString(),
    title: 'Task in B',
  });

  // Templates
  const templateA = await createTemplate({
    workspaceId: wsA._id.toString(),
    name: 'Template A',
    taskBlueprint: [{ blueprintId: 'b1', title: 'Step 1' }],
  });
  const templateB = await createTemplate({
    workspaceId: wsB._id.toString(),
    name: 'Template B',
    taskBlueprint: [{ blueprintId: 'b1', title: 'Step 1' }],
  });

  // Poll on Board B
  const pollB = await createPoll({
    boardId: boardB._id.toString(),
    question: 'Feature on Board B?',
    options: ['Yes', 'No'],
    closesAt: new Date(Date.now() + 86400000).toISOString(),
  });

  try {
    // ── Test 1: Cross-workspace board access rejected ───────────
    await t.test('User A cannot list Workspace B boards (403)', async () => {
      const res = await api('GET', `/api/boards?workspaceId=${wsB._id}`, { token: tokenA });
      assert.strictEqual(res.status, 403);
    });

    await t.test('User A cannot create board in Workspace B (403)', async () => {
      const res = await api('POST', '/api/boards', {
        token: tokenA,
        body: { name: 'Hack Board', workspaceId: wsB._id.toString() },
      });
      assert.strictEqual(res.status, 403);
    });

    // ── Test 2: Cross-workspace task access rejected ────────────
    await t.test('User A cannot list tasks on Board B (403)', async () => {
      const res = await api('GET', `/api/tasks?boardId=${boardB._id}`, { token: tokenA });
      assert.strictEqual(res.status, 403);
    });

    await t.test('User A cannot get detail of Task B (403)', async () => {
      const res = await api('GET', `/api/tasks/${taskB._id}/detail`, { token: tokenA });
      assert.strictEqual(res.status, 403);
    });

    await t.test('User A cannot comment on Task B (403)', async () => {
      const res = await api('POST', `/api/tasks/${taskB._id}/comments`, {
        token: tokenA,
        body: { text: 'Infiltrating Task B' },
      });
      assert.strictEqual(res.status, 403);
    });

    await t.test('User A cannot update Task B (403)', async () => {
      const res = await api('PATCH', `/api/tasks/${taskB._id}`, {
        token: tokenA,
        body: { title: 'Compromised Title' },
      });
      assert.strictEqual(res.status, 403);
    });

    await t.test('User A cannot delete Task B (403)', async () => {
      const res = await api('DELETE', `/api/tasks/${taskB._id}`, { token: tokenA });
      assert.strictEqual(res.status, 403);
    });

    // ── Test 3: Cross-workspace template access rejected ────────
    await t.test('User A cannot list templates for Workspace B (403)', async () => {
      const res = await api('GET', `/api/templates?workspaceId=${wsB._id}`, { token: tokenA });
      assert.strictEqual(res.status, 403);
    });

    await t.test('User A cannot update Template B (403)', async () => {
      const res = await api('PATCH', `/api/templates/${templateB._id}`, {
        token: tokenA,
        body: { name: 'Tampered Template' },
      });
      assert.strictEqual(res.status, 403);
    });

    // ── Test 4: Cross-workspace polls rejected ──────────────────
    await t.test('User A cannot list polls on Board B (403)', async () => {
      const res = await api('GET', `/api/boards/${boardB._id}/polls`, { token: tokenA });
      assert.strictEqual(res.status, 403);
    });

    await t.test('User A cannot vote on Poll B (403)', async () => {
      const res = await api('POST', `/api/polls/${pollB._id}/vote`, {
        token: tokenA,
        body: { optionIndex: 0 },
      });
      assert.strictEqual(res.status, 403);
    });

    // ── Test 5: Role enforcement within Workspace A ─────────────
    await t.test('Charlie (Member in A) cannot create a board in A (403)', async () => {
      const res = await api('POST', '/api/boards', {
        token: tokenC,
        body: { name: 'Member Board', workspaceId: wsA._id.toString() },
      });
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.json.error, 'Insufficient role');
    });

    await t.test('Alice (Head in A) CAN create a board in A (201)', async () => {
      const res = await api('POST', '/api/boards', {
        token: tokenA,
        body: { name: 'Valid Head Board', workspaceId: wsA._id.toString() },
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.json.name, 'Valid Head Board');
    });

    // ── Test 6: Multi-workspace differential roles ──────────────
    await t.test('David: role member in A cannot create board in A, but role head in B CAN create board in B', async () => {
      // In A: member role -> fails
      const resInA = await api('POST', '/api/boards', {
        token: tokenD,
        body: { name: 'David Board in A', workspaceId: wsA._id.toString() },
      });
      assert.strictEqual(resInA.status, 403);

      // In B: head role -> succeeds
      const resInB = await api('POST', '/api/boards', {
        token: tokenD,
        body: { name: 'David Board in B', workspaceId: wsB._id.toString() },
      });
      assert.strictEqual(resInB.status, 201);
      assert.strictEqual(resInB.json.name, 'David Board in B');
    });

    // ── Test 7: GET /api/me/workspaces returns all memberships ──
    await t.test('David sees both Workspace A (member) and Workspace B (head) in /api/me/workspaces', async () => {
      const res = await api('GET', '/api/me/workspaces', { token: tokenD });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.length, 2);

      const memA = res.json.find((w) => w.workspaceId === wsA._id.toString());
      const memB = res.json.find((w) => w.workspaceId === wsB._id.toString());

      assert.ok(memA);
      assert.strictEqual(memA.role, 'member');
      assert.ok(memB);
      assert.strictEqual(memB.role, 'head');
    });

  } finally {
    // Cleanup
    server.close();
    await db.collection('workspaces').deleteMany({ _id: { $in: [wsA._id, wsB._id] } });
    await db.collection('memberships').deleteMany({ workspaceId: { $in: [wsA._id, wsB._id] } });
    await db.collection('boards').deleteMany({ workspaceId: { $in: [wsA._id, wsB._id] } });
    await db.collection('tasks').deleteMany({ boardId: { $in: [boardA._id, boardB._id] } });
    await db.collection('eventTemplates').deleteMany({ workspaceId: { $in: [wsA._id, wsB._id] } });
    await db.collection('polls').deleteMany({ boardId: boardB._id });
    await db.collection('users').deleteMany({ _id: { $in: [userAId, userBId, userCId, userDId] } });
    await closeDb();
  }
});
