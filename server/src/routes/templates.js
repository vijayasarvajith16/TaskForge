const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { createTemplate, findByWorkspace, findTemplateById, updateTemplate, deleteTemplate } = require('../models/templates');

const router = express.Router();

/**
 * Validate blueprint dependencies: no self-deps, all refs exist, no cycles.
 */
function validateBlueprint(taskBlueprint) {
  const ids = new Set(taskBlueprint.map((bp) => bp.blueprintId));

  // Check all dependsOn refs exist and no self-dep
  for (const bp of taskBlueprint) {
    for (const depId of bp.dependsOn || []) {
      if (depId === bp.blueprintId) {
        return { valid: false, error: `Task "${bp.title}" cannot depend on itself` };
      }
      if (!ids.has(depId)) {
        return { valid: false, error: `Task "${bp.title}" depends on unknown blueprint entry "${depId}"` };
      }
    }
  }

  // Cycle detection via DFS
  const adjMap = new Map();
  for (const bp of taskBlueprint) {
    adjMap.set(bp.blueprintId, bp.dependsOn || []);
  }

  const visited = new Set();
  const inStack = new Set();

  function hasCycle(nodeId) {
    if (inStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);
    inStack.add(nodeId);
    for (const dep of adjMap.get(nodeId) || []) {
      if (hasCycle(dep)) return true;
    }
    inStack.delete(nodeId);
    return false;
  }

  for (const bp of taskBlueprint) {
    if (hasCycle(bp.blueprintId)) {
      return { valid: false, error: 'Blueprint contains a circular dependency' };
    }
  }

  return { valid: true };
}

// GET /api/templates?workspaceId= — list templates for workspace
router.get('/', authenticate, async (req, res) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId query param required' });

    if (!req.user.workspaceId || req.user.workspaceId.toString() !== workspaceId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const templates = await findByWorkspace(workspaceId);
    res.json(templates);
  } catch (err) {
    console.error('Get templates error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/templates — create a template (head/joint_head only)
router.post('/', authenticate, authorize('head', 'joint_head'), async (req, res) => {
  try {
    const { workspaceId, name, taskBlueprint } = req.body;
    if (!workspaceId || !name) {
      return res.status(400).json({ error: 'workspaceId and name are required' });
    }

    if (!req.user.workspaceId || req.user.workspaceId.toString() !== workspaceId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (taskBlueprint && taskBlueprint.length > 0) {
      const validation = validateBlueprint(taskBlueprint);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
    }

    const template = await createTemplate({ workspaceId, name, taskBlueprint: taskBlueprint || [] });
    res.status(201).json(template);
  } catch (err) {
    console.error('Create template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/templates/:id — update a template (head/joint_head only)
router.patch('/:id', authenticate, authorize('head', 'joint_head'), async (req, res) => {
  try {
    const template = await findTemplateById(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });

    if (!req.user.workspaceId || req.user.workspaceId.toString() !== template.workspaceId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.taskBlueprint !== undefined) {
      const validation = validateBlueprint(req.body.taskBlueprint);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
      updates.taskBlueprint = req.body.taskBlueprint;
    }

    const updated = await updateTemplate(req.params.id, updates);
    res.json(updated);
  } catch (err) {
    console.error('Update template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/templates/:id — delete a template (head/joint_head only)
router.delete('/:id', authenticate, authorize('head', 'joint_head'), async (req, res) => {
  try {
    const template = await findTemplateById(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });

    if (!req.user.workspaceId || req.user.workspaceId.toString() !== template.workspaceId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await deleteTemplate(req.params.id);
    res.json({ message: 'Template deleted' });
  } catch (err) {
    console.error('Delete template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
