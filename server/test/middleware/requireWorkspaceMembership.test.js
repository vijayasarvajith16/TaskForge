const test = require('node:test');
const assert = require('node:assert');
const { ObjectId } = require('mongodb');

// Require the middleware module
const { requireWorkspaceMembership, roleSatisfies } = require('../../src/middleware/requireWorkspaceMembership');
const membershipsModel = require('../../src/models/memberships');

function createMockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.body = data;
      return res;
    },
  };
  return res;
}

test('roleSatisfies helper checks hierarchy accurately', () => {
  // Head satisfies all roles
  assert.strictEqual(roleSatisfies('head', 'member'), true);
  assert.strictEqual(roleSatisfies('head', 'joint_head'), true);
  assert.strictEqual(roleSatisfies('head', 'head'), true);

  // Joint head satisfies member and joint_head, but not head
  assert.strictEqual(roleSatisfies('joint_head', 'member'), true);
  assert.strictEqual(roleSatisfies('joint_head', 'joint_head'), true);
  assert.strictEqual(roleSatisfies('joint_head', 'head'), false);

  // Member satisfies member, but not joint_head or head
  assert.strictEqual(roleSatisfies('member', 'member'), true);
  assert.strictEqual(roleSatisfies('member', 'joint_head'), false);
  assert.strictEqual(roleSatisfies('member', 'head'), false);

  // Unknown role or null minRole
  assert.strictEqual(roleSatisfies('member', null), true);
  assert.strictEqual(roleSatisfies('unknown', 'member'), false);
});

test('requireWorkspaceMembership: rejects if user is not authenticated', async () => {
  const middleware = requireWorkspaceMembership();
  const req = { user: null };
  const res = createMockRes();
  let nextCalled = false;
  const next = () => { nextCalled = true; };

  await middleware(req, res, next);
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(nextCalled, false);
});

test('requireWorkspaceMembership: rejects 400 if workspaceId is missing', async () => {
  const middleware = requireWorkspaceMembership();
  const req = {
    user: { _id: new ObjectId() },
    params: {},
    query: {},
    body: {},
    headers: {},
  };
  const res = createMockRes();
  let nextCalled = false;
  const next = () => { nextCalled = true; };

  await middleware(req, res, next);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.error, 'workspaceId required');
  assert.strictEqual(nextCalled, false);
});

test('requireWorkspaceMembership: a non-member gets 403', async () => {
  const origFindMembership = membershipsModel.findMembership;
  membershipsModel.findMembership = async () => null;

  try {
    const middleware = requireWorkspaceMembership();
    const req = {
      user: { _id: new ObjectId() },
      query: { workspaceId: new ObjectId().toString() },
      params: {},
      body: {},
      headers: {},
    };
    const res = createMockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    await middleware(req, res, next);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.error, 'Not a member of this workspace');
    assert.strictEqual(nextCalled, false);
  } finally {
    membershipsModel.findMembership = origFindMembership;
  }
});

test('requireWorkspaceMembership: a member of the workspace passes with 200/next()', async () => {
  const wsId = new ObjectId().toString();
  const fakeMembership = {
    _id: new ObjectId(),
    userId: new ObjectId(),
    workspaceId: new ObjectId(wsId),
    role: 'member',
  };

  const origFindMembership = membershipsModel.findMembership;
  membershipsModel.findMembership = async () => fakeMembership;

  try {
    const middleware = requireWorkspaceMembership();
    const req = {
      user: { _id: fakeMembership.userId },
      query: { workspaceId: wsId },
      params: {},
      body: {},
      headers: {},
    };
    const res = createMockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    await middleware(req, res, next);
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.membership, fakeMembership);
    assert.strictEqual(req.workspaceId, wsId);
  } finally {
    membershipsModel.findMembership = origFindMembership;
  }
});

test('requireWorkspaceMembership: member-role user fails minRole: "head" check (403)', async () => {
  const wsId = new ObjectId().toString();
  const fakeMembership = {
    _id: new ObjectId(),
    userId: new ObjectId(),
    workspaceId: new ObjectId(wsId),
    role: 'member',
  };

  const origFindMembership = membershipsModel.findMembership;
  membershipsModel.findMembership = async () => fakeMembership;

  try {
    const middleware = requireWorkspaceMembership({ minRole: 'head' });
    const req = {
      user: { _id: fakeMembership.userId },
      query: { workspaceId: wsId },
      params: {},
      body: {},
      headers: {},
    };
    const res = createMockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    await middleware(req, res, next);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.error, 'Insufficient role');
    assert.strictEqual(nextCalled, false);
  } finally {
    membershipsModel.findMembership = origFindMembership;
  }
});

test('requireWorkspaceMembership: head-role user passes minRole: "member" check', async () => {
  const wsId = new ObjectId().toString();
  const fakeMembership = {
    _id: new ObjectId(),
    userId: new ObjectId(),
    workspaceId: new ObjectId(wsId),
    role: 'head',
  };

  const origFindMembership = membershipsModel.findMembership;
  membershipsModel.findMembership = async () => fakeMembership;

  try {
    const middleware = requireWorkspaceMembership({ minRole: 'member' });
    const req = {
      user: { _id: fakeMembership.userId },
      query: { workspaceId: wsId },
      params: {},
      body: {},
      headers: {},
    };
    const res = createMockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    await middleware(req, res, next);
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.membership.role, 'head');
  } finally {
    membershipsModel.findMembership = origFindMembership;
  }
});

test('requireWorkspaceMembership: joint_head satisfies minRole: "joint_head" and fails "head"', async () => {
  const wsId = new ObjectId().toString();
  const fakeMembership = {
    _id: new ObjectId(),
    userId: new ObjectId(),
    workspaceId: new ObjectId(wsId),
    role: 'joint_head',
  };

  const origFindMembership = membershipsModel.findMembership;
  membershipsModel.findMembership = async () => fakeMembership;

  try {
    // 1. Joint head passes minRole: joint_head
    const mwJoint = requireWorkspaceMembership({ minRole: 'joint_head' });
    const req1 = {
      user: { _id: fakeMembership.userId },
      headers: { 'x-workspace-id': wsId },
      params: {},
      query: {},
      body: {},
    };
    const res1 = createMockRes();
    let nextCalled1 = false;
    await mwJoint(req1, res1, () => { nextCalled1 = true; });
    assert.strictEqual(nextCalled1, true);

    // 2. Joint head fails minRole: head
    const mwHead = requireWorkspaceMembership({ minRole: 'head' });
    const req2 = {
      user: { _id: fakeMembership.userId },
      headers: { 'x-workspace-id': wsId },
      params: {},
      query: {},
      body: {},
    };
    const res2 = createMockRes();
    let nextCalled2 = false;
    await mwHead(req2, res2, () => { nextCalled2 = true; });
    assert.strictEqual(res2.statusCode, 403);
    assert.strictEqual(res2.body.error, 'Insufficient role');
    assert.strictEqual(nextCalled2, false);
  } finally {
    membershipsModel.findMembership = origFindMembership;
  }
});
