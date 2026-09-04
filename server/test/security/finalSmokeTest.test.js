const test = require('node:test');
const assert = require('node:assert');
const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const http = require('http');
require('dotenv').config();

const { connectDb, getDb, closeDb } = require('../../src/db');
const { createWorkspace, updateWorkspaceWebhook } = require('../../src/models/workspaces');
const { createMembership } = require('../../src/models/memberships');
const { createBoard } = require('../../src/models/boards');
const { createTask } = require('../../src/models/tasks');
const { createTemplate } = require('../../src/models/templates');
const { runEscalation } = require('../../src/jobs/escalation');
const webhookUtil = require('../../src/utils/webhook');

// Import Express app
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

test('Final Smoke Test — Complete Multi-Workspace Verification', async (t) => {
  await connectDb(process.env.MONGODB_URI);
  const db = getDb();

  const server = buildTestServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

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

  // 1. Create two workspaces, each with their own board/task data
  const user1Id = new ObjectId(); // Multi-workspace user (Head in A, Member in B)
  const user2Id = new ObjectId(); // Head in B
  const user3Id = new ObjectId(); // Member only in Workspace A
  const jointHeadAId = new ObjectId(); // Joint head in Workspace A
  const jointHeadBId = new ObjectId(); // Joint head in Workspace B

  await db.collection('users').insertMany([
    { _id: user1Id, name: 'User 1', email: `u1_${Date.now()}@test.com` },
    { _id: user2Id, name: 'User 2', email: `u2_${Date.now()}@test.com` },
    { _id: user3Id, name: 'User 3', email: `u3_${Date.now()}@test.com` },
    { _id: jointHeadAId, name: 'Joint Head A', email: `jha_${Date.now()}@test.com` },
    { _id: jointHeadBId, name: 'Joint Head B', email: `jhb_${Date.now()}@test.com` },
  ]);

  const token1 = makeToken(user1Id);
  const token3 = makeToken(user3Id);

  // Workspace A
  const wsA = await createWorkspace({ name: 'Smoke Workspace A', ownerId: user1Id.toString(), inviteCode: 'SMK_A' });
  await updateWorkspaceWebhook(wsA._id, { webhookUrl: 'https://webhook.test/workspaceA', webhookProvider: 'slack' });
  await createMembership({ userId: user1Id, workspaceId: wsA._id, role: 'head' });
  await createMembership({ userId: user3Id, workspaceId: wsA._id, role: 'member' });
  await createMembership({ userId: jointHeadAId, workspaceId: wsA._id, role: 'joint_head' });

  // Workspace B
  const wsB = await createWorkspace({ name: 'Smoke Workspace B', ownerId: user2Id.toString(), inviteCode: 'SMK_B' });
  await updateWorkspaceWebhook(wsB._id, { webhookUrl: 'https://webhook.test/workspaceB', webhookProvider: 'slack' });
  await createMembership({ userId: user2Id, workspaceId: wsB._id, role: 'head' });
  await createMembership({ userId: user1Id, workspaceId: wsB._id, role: 'member' });
  await createMembership({ userId: jointHeadBId, workspaceId: wsB._id, role: 'joint_head' });

  // Boards
  const boardA = await createBoard({ name: 'Board A', workspaceId: wsA._id.toString() });
  const boardB = await createBoard({ name: 'Board B', workspaceId: wsB._id.toString() });

  // Tasks
  const taskA = await createTask({
    boardId: boardA._id.toString(),
    columnId: boardA.columns[0]._id.toString(),
    title: 'Task A',
    assignedTo: user3Id.toString(),
    dueDate: new Date(Date.now() - 48 * 3600 * 1000).toISOString(), // Overdue by 48h
  });
  await db.collection('tasks').updateOne({ _id: taskA._id }, { $set: { escalationLevel: 1 } });
  const taskB = await createTask({
    boardId: boardB._id.toString(),
    columnId: boardB.columns[0]._id.toString(),
    title: 'Task B',
    assignedTo: user1Id.toString(),
  });

  const templateB = await createTemplate({
    workspaceId: wsB._id.toString(),
    name: 'Template B',
    taskBlueprint: [{ blueprintId: 'tp1', title: 'Blueprint Task' }],
  });

  try {
    // ── Smoke Step 1 & 2: Differential permissions for User 1 ──
    await t.test('User 1 CAN create board in Workspace A (where role is head)', async () => {
      const res = await api('POST', '/api/boards', {
        token: token1,
        body: { name: 'New Board by Head', workspaceId: wsA._id.toString() },
      });
      assert.strictEqual(res.status, 201);
    });

    await t.test('User 1 CANNOT create board in Workspace B (where role is member) -> 403', async () => {
      const res = await api('POST', '/api/boards', {
        token: token1,
        body: { name: 'Illegal Board by Member', workspaceId: wsB._id.toString() },
      });
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.json.error, 'Insufficient role');
    });

    // ── Smoke Step 3: User 3 (member only in A) attempting Workspace B endpoints ──
    await t.test('User 3 rejected from Workspace B boards endpoint (403)', async () => {
      const res = await api('GET', `/api/boards?workspaceId=${wsB._id}`, { token: token3 });
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.json.error, 'Not a member of this workspace');
    });

    await t.test('User 3 rejected from Workspace B task endpoint (403)', async () => {
      const res = await api('GET', `/api/tasks/${taskB._id}/detail`, { token: token3 });
      assert.strictEqual(res.status, 403);
    });

    await t.test('User 3 rejected from Workspace B template endpoint (403)', async () => {
      const res = await api('GET', `/api/templates?workspaceId=${wsB._id}`, { token: token3 });
      assert.strictEqual(res.status, 403);
    });

    await t.test('User 3 rejected from Workspace B calendar token endpoint (403)', async () => {
      const res = await api('POST', `/api/boards/${boardB._id}/calendar/token`, { token: token3 });
      assert.strictEqual(res.status, 403);
    });

    // ── Smoke Step 4: Escalation sweep and Webhook delivery isolation ──
    await t.test('Escalation sweep notifies ONLY Joint Head A and posts ONLY to Workspace A webhook', async () => {
      const recordedWebhookCalls = [];
      const origNotifyWebhook = webhookUtil.notifyWebhook;
      webhookUtil.notifyWebhook = (wsId, text, opts) => {
        recordedWebhookCalls.push({ wsId: wsId.toString(), text, opts });
      };

      try {
        await runEscalation();

        // Check notifications created
        const notificationsForJHA = await db.collection('notifications').find({ userId: jointHeadAId }).toArray();
        const notificationsForJHB = await db.collection('notifications').find({ userId: jointHeadBId }).toArray();

        // Joint Head A must have received notification for overdue Task A
        assert.ok(notificationsForJHA.length >= 1, 'Joint Head A must be notified');

        // Joint Head B (in Workspace B) must NOT have received any notification!
        assert.strictEqual(notificationsForJHB.length, 0, 'Joint Head B in Workspace B must NOT receive notifications from Workspace A tasks');

        // Webhook posted only to Workspace A
        const wsACalls = recordedWebhookCalls.filter((c) => c.wsId === wsA._id.toString());
        const wsBCalls = recordedWebhookCalls.filter((c) => c.wsId === wsB._id.toString());

        assert.ok(wsACalls.length > 0, 'Workspace A webhook was called');
        assert.strictEqual(wsBCalls.length, 0, 'Workspace B webhook was NOT called');
      } finally {
        webhookUtil.notifyWebhook = origNotifyWebhook;
      }
    });

  } finally {
    server.close();
    await db.collection('workspaces').deleteMany({ _id: { $in: [wsA._id, wsB._id] } });
    await db.collection('memberships').deleteMany({ workspaceId: { $in: [wsA._id, wsB._id] } });
    await db.collection('boards').deleteMany({ workspaceId: { $in: [wsA._id, wsB._id] } });
    await db.collection('tasks').deleteMany({ boardId: { $in: [boardA._id, boardB._id] } });
    await db.collection('eventTemplates').deleteMany({ workspaceId: { $in: [wsA._id, wsB._id] } });
    await db.collection('notifications').deleteMany({ taskId: taskA._id.toString() });
    await db.collection('users').deleteMany({ _id: { $in: [user1Id, user2Id, user3Id, jointHeadAId, jointHeadBId] } });
    await closeDb();
  }
});
