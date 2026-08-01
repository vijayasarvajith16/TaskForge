const { ObjectId } = require('mongodb');
const { getDb } = require('../db');

function col() {
  return getDb().collection('eventTemplates');
}

async function createTemplate({ workspaceId, name, taskBlueprint = [] }) {
  const now = new Date();
  const doc = {
    workspaceId: new ObjectId(workspaceId),
    name,
    taskBlueprint: taskBlueprint.map((bp) => ({
      blueprintId: bp.blueprintId || new ObjectId().toString(),
      title: bp.title,
      role: bp.role || '',
      offsetDaysFromEvent: bp.offsetDaysFromEvent ?? 0,
      dependsOn: bp.dependsOn || [],
    })),
    createdAt: now,
    updatedAt: now,
  };
  const result = await col().insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

async function findByWorkspace(workspaceId) {
  return col().find({ workspaceId: new ObjectId(workspaceId) }).sort({ createdAt: -1 }).toArray();
}

async function findTemplateById(id) {
  return col().findOne({ _id: new ObjectId(id) });
}

async function updateTemplate(id, updates) {
  updates.updatedAt = new Date();
  if (updates.taskBlueprint) {
    updates.taskBlueprint = updates.taskBlueprint.map((bp) => ({
      blueprintId: bp.blueprintId || new ObjectId().toString(),
      title: bp.title,
      role: bp.role || '',
      offsetDaysFromEvent: bp.offsetDaysFromEvent ?? 0,
      dependsOn: bp.dependsOn || [],
    }));
  }
  await col().updateOne({ _id: new ObjectId(id) }, { $set: updates });
  return findTemplateById(id);
}

async function deleteTemplate(id) {
  await col().deleteOne({ _id: new ObjectId(id) });
}

module.exports = { createTemplate, findByWorkspace, findTemplateById, updateTemplate, deleteTemplate };
