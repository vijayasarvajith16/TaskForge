const membershipsModel = require('../models/memberships');
const boardsModel = require('../models/boards');
const tasksModel = require('../models/tasks');
const templatesModel = require('../models/templates');
const pollsModel = require('../models/polls');

const ROLE_RANK = {
  member: 1,
  joint_head: 2,
  head: 3,
};

function roleSatisfies(userRole, minRole) {
  if (!minRole) return true;
  return (ROLE_RANK[userRole] || 0) >= (ROLE_RANK[minRole] || 0);
}

/**
 * Middleware that verifies the authenticated user has explicit membership in the workspace.
 * Attaches req.membership and req.workspaceId for downstream route handlers.
 *
 * Options:
 * - minRole: 'member' | 'joint_head' | 'head' (enforces role hierarchy)
 * - fromBoard: boolean (resolves workspaceId from boardId / :id)
 * - fromTask: boolean (resolves workspaceId from taskId / :id -> board -> workspace)
 * - fromTemplate: boolean (resolves workspaceId from templateId / :id)
 * - fromPoll: boolean (resolves workspaceId from pollId / :id -> board -> workspace)
 * - resolveWorkspaceId: async (req) => workspaceId
 */
function requireWorkspaceMembership(options = {}) {
  return async (req, res, next) => {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let workspaceId = null;

    if (typeof options.resolveWorkspaceId === 'function') {
      try {
        workspaceId = await options.resolveWorkspaceId(req);
      } catch (err) {
        return res.status(500).json({ error: 'Failed to resolve workspace' });
      }
    } else if (options.fromTask) {
      const taskId = req.params.id || req.params.taskId || req.body.taskId;
      if (!taskId) return res.status(400).json({ error: 'Task ID required' });
      const task = await tasksModel.findTaskById(taskId);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      const board = await boardsModel.findBoardById(task.boardId);
      if (!board) return res.status(404).json({ error: 'Board not found' });
      workspaceId = board.workspaceId;
      req.task = task;
      req.board = board;
    } else if (options.fromBoard) {
      const boardId = req.params.boardId || req.params.id || req.query.boardId || req.body.boardId;
      if (!boardId) return res.status(400).json({ error: 'Board ID required' });
      const board = await boardsModel.findBoardById(boardId);
      if (!board) return res.status(404).json({ error: 'Board not found' });
      workspaceId = board.workspaceId;
      req.board = board;
    } else if (options.fromTemplate) {
      const templateId = req.params.id || req.params.templateId || req.body.templateId;
      if (!templateId) return res.status(400).json({ error: 'Template ID required' });
      const template = await templatesModel.findTemplateById(templateId);
      if (!template) return res.status(404).json({ error: 'Template not found' });
      workspaceId = template.workspaceId;
      req.template = template;
    } else if (options.fromPoll) {
      const pollId = req.params.id || req.params.pollId;
      if (!pollId) return res.status(400).json({ error: 'Poll ID required' });
      const poll = await pollsModel.findPollById(pollId);
      if (!poll) return res.status(404).json({ error: 'Poll not found' });
      const board = await boardsModel.findBoardById(poll.boardId);
      if (!board) return res.status(404).json({ error: 'Board not found' });
      workspaceId = board.workspaceId;
      req.poll = poll;
      req.board = board;
    } else {
      // Direct extraction
      workspaceId =
        req.params.workspaceId ||
        req.query.workspaceId ||
        req.body.workspaceId ||
        (req.baseUrl && req.baseUrl.includes('/workspaces') ? req.params.id : null) ||
        req.headers?.['x-workspace-id'];
    }

    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId required' });
    }

    try {
      const membership = await membershipsModel.findMembership(req.user._id, workspaceId);
      if (!membership) {
        return res.status(403).json({ error: 'Not a member of this workspace' });
      }

      if (options.minRole && !roleSatisfies(membership.role, options.minRole)) {
        return res.status(403).json({ error: 'Insufficient role' });
      }

      req.membership = membership;
      req.workspaceId = workspaceId.toString();
      next();
    } catch (err) {
      console.error('Membership check error:', err);
      return res.status(500).json({ error: 'Internal authorization error' });
    }
  };
}

module.exports = {
  requireWorkspaceMembership,
  roleSatisfies,
  ROLE_RANK,
};
