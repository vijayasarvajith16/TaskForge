const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireWorkspaceMembership } = require('../middleware/requireWorkspaceMembership');
const {
  createTemplate, findByWorkspace, findTemplateById,
  updateTemplate, deleteTemplate,
} = require('../models/templates');

const router = express.Router();

/**
 * Validate taskBlueprint array:
 * - Each item must have blueprintId and title.
 * - dependsOnBlueprintIds must reference earlier blueprintIds only.
 * - Returns { valid: boolean, error?: string }
 */
function validateBlueprint(blueprint) {
  if (!Array.isArray(blueprint)) return { valid: false, error: 'taskBlueprint must be an array' };

  const seenIds = new Set();

  for (let i = 0; i < blueprint.length; i++) {
    const item = blueprint[i];

    if (!item.blueprintId || typeof item.blueprintId !== 'string') {
      return { valid: false, error: `Item at index ${i} is missing a string blueprintId` };
    }
    if (!item.title || typeof item.title !== 'string') {
      return { valid: false, error: `Item at index ${i} is missing a title` };
    }
    if (seenIds.has(item.blueprintId)) {
      return { valid: false, error: `Duplicate blueprintId: ${item.blueprintId}` };
    }

    if (item.dependsOnBlueprintIds && Array.isArray(item.dependsOnBlueprintIds)) {
      for (const depId of item.dependsOnBlueprintIds) {
        if (!seenIds.has(depId)) {
          return {
            valid: false,
            error: `Task "${item.blueprintId}" depends on "${depId}", which is not declared before it`,
          };
        }
      }
    }

    seenIds.add(item.blueprintId);
  }

  return { valid: true };
}

// GET /api/templates?workspaceId= — list templates for workspace
router.get('/', authenticate, requireWorkspaceMembership(), async (req, res) => {
  try {
    const templates = await findByWorkspace(req.workspaceId);
    res.json(templates);
  } catch (err) {
    console.error('Get templates error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/templates — create a template (head/joint_head only)
router.post('/', authenticate, requireWorkspaceMembership({ minRole: 'joint_head' }), async (req, res) => {
  try {
    const { name, taskBlueprint } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    if (taskBlueprint && taskBlueprint.length > 0) {
      const validation = validateBlueprint(taskBlueprint);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
    }

    const template = await createTemplate({ workspaceId: req.workspaceId, name, taskBlueprint: taskBlueprint || [] });
    res.status(201).json(template);
  } catch (err) {
    console.error('Create template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/templates/:id — update a template (head/joint_head only)
router.patch('/:id', authenticate, requireWorkspaceMembership({ minRole: 'joint_head', fromTemplate: true }), async (req, res) => {
  try {
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
router.delete('/:id', authenticate, requireWorkspaceMembership({ minRole: 'joint_head', fromTemplate: true }), async (req, res) => {
  try {
    await deleteTemplate(req.params.id);
    res.json({ message: 'Template deleted' });
  } catch (err) {
    console.error('Delete template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
