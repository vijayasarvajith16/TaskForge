const { ObjectId } = require('mongodb');

/**
 * Compute the effective status of a task based on its dependencies.
 *
 * Returns "locked" if ANY task in task.dependsOn has status !== "done".
 * Otherwise returns the task's current non-locked status ("open" by default).
 *
 * This module is standalone — reusable by route handlers, templates (Phase 4),
 * escalation engine (Phase 5), etc.
 *
 * @param {Object} task - The task document
 * @param {Object[]} allTasks - All tasks on the same board
 * @returns {string} The computed status
 */
function computeStatus(task, allTasks) {
  // No dependencies → keep current status (or default to 'open')
  if (!task.dependsOn || task.dependsOn.length === 0) {
    return task.status === 'locked' ? 'open' : (task.status || 'open');
  }

  // If the task is already done, don't re-lock it
  if (task.status === 'done') {
    return 'done';
  }

  // Build a lookup map for quick access
  const taskMap = new Map();
  for (const t of allTasks) {
    taskMap.set(t._id.toString(), t);
  }

  // Check if ALL dependencies are done
  for (const depId of task.dependsOn) {
    const dep = taskMap.get(depId.toString());
    if (!dep || dep.status !== 'done') {
      return 'locked';
    }
  }

  // All dependencies are done — unlock
  // If the task was locked, set it to 'open'; otherwise keep its current status
  return task.status === 'locked' ? 'open' : (task.status || 'open');
}

/**
 * Find all tasks on a board that directly depend on the given taskId.
 *
 * @param {string} taskId - The ID of the completed task
 * @param {Object[]} allTasks - All tasks on the same board
 * @returns {Object[]} Tasks whose dependsOn includes taskId
 */
function findDirectDependents(taskId, allTasks) {
  const id = taskId.toString();
  return allTasks.filter((t) =>
    t.dependsOn && t.dependsOn.some((depId) => depId.toString() === id)
  );
}

/**
 * Detect circular dependencies.
 * Returns true if adding `newDepId` to `taskId.dependsOn` would create a cycle.
 *
 * Uses DFS from newDepId following dependsOn edges to see if we can reach taskId.
 *
 * @param {string} taskId - The task that wants to add a dependency
 * @param {string} newDepId - The proposed dependency
 * @param {Object[]} allTasks - All tasks on the same board
 * @returns {boolean} True if a cycle would be created
 */
function wouldCreateCycle(taskId, newDepId, allTasks) {
  const targetId = taskId.toString();

  // Build adjacency: task -> list of tasks it depends on
  const depsMap = new Map();
  for (const t of allTasks) {
    depsMap.set(t._id.toString(), (t.dependsOn || []).map((d) => d.toString()));
  }

  // DFS from newDepId: can we reach taskId by following dependsOn edges?
  // (If newDepId depends on X, and X depends on taskId → cycle)
  const visited = new Set();
  const stack = [newDepId.toString()];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === targetId) return true; // Cycle detected!
    if (visited.has(current)) continue;
    visited.add(current);

    const deps = depsMap.get(current) || [];
    for (const dep of deps) {
      if (!visited.has(dep)) stack.push(dep);
    }
  }

  return false;
}

/**
 * Validate a list of dependency IDs for a task.
 * - All IDs must exist on the same board
 * - No self-dependency
 * - No circular dependencies
 *
 * @param {string} taskId - The task being updated
 * @param {string[]} dependsOnIds - Proposed dependency IDs
 * @param {Object[]} allTasks - All tasks on the same board
 * @returns {{ valid: boolean, error?: string }}
 */
function validateDependencies(taskId, dependsOnIds, allTasks) {
  const taskIdStr = taskId.toString();
  const boardTaskIds = new Set(allTasks.map((t) => t._id.toString()));

  for (const depId of dependsOnIds) {
    const depStr = depId.toString();

    // Self-dependency
    if (depStr === taskIdStr) {
      return { valid: false, error: 'A task cannot depend on itself' };
    }

    // Must exist on the same board
    if (!boardTaskIds.has(depStr)) {
      return { valid: false, error: `Dependency ${depStr} not found on this board` };
    }

    // Circular dependency check
    if (wouldCreateCycle(taskIdStr, depStr, allTasks)) {
      return { valid: false, error: `Adding dependency on "${depStr}" would create a circular dependency` };
    }
  }

  return { valid: true };
}

module.exports = { computeStatus, findDirectDependents, wouldCreateCycle, validateDependencies };
