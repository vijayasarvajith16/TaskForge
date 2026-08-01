import { useMemo, useRef, useEffect, useState } from 'react';

const STATUS_COLORS = {
  open: '#6366f1',
  in_progress: '#06b6d4',
  blocked: '#f59e0b',
  done: '#10b981',
  locked: '#6b7280',
};

/**
 * Simple layered graph layout using topological sort.
 * Places tasks in layers based on dependency depth.
 */
function computeLayout(tasks) {
  const taskMap = new Map();
  tasks.forEach((t) => taskMap.set(t._id.toString(), t));

  // Compute depth (layer) for each task via BFS from roots
  const depths = new Map();
  const adjList = new Map(); // taskId -> tasks that depend ON this task

  tasks.forEach((t) => {
    const id = t._id.toString();
    if (!adjList.has(id)) adjList.set(id, []);
    (t.dependsOn || []).forEach((depId) => {
      const depStr = depId.toString();
      if (!adjList.has(depStr)) adjList.set(depStr, []);
      adjList.get(depStr).push(id);
    });
  });

  // Find roots (tasks with no dependencies)
  const roots = tasks.filter((t) => !t.dependsOn || t.dependsOn.length === 0);
  const queue = roots.map((t) => ({ id: t._id.toString(), depth: 0 }));
  const visited = new Set();

  while (queue.length > 0) {
    const { id, depth } = queue.shift();
    if (visited.has(id)) {
      // Update depth if we found a longer path
      if (depth > (depths.get(id) || 0)) {
        depths.set(id, depth);
      }
      continue;
    }
    visited.add(id);
    depths.set(id, Math.max(depth, depths.get(id) || 0));

    const children = adjList.get(id) || [];
    for (const childId of children) {
      const newDepth = depth + 1;
      if (!visited.has(childId) || newDepth > (depths.get(childId) || 0)) {
        depths.set(childId, newDepth);
        queue.push({ id: childId, depth: newDepth });
      }
    }
  }

  // Tasks not reachable (isolated or in cycles) get depth 0
  tasks.forEach((t) => {
    if (!depths.has(t._id.toString())) depths.set(t._id.toString(), 0);
  });

  // Group by depth
  const layers = new Map();
  tasks.forEach((t) => {
    const d = depths.get(t._id.toString()) || 0;
    if (!layers.has(d)) layers.set(d, []);
    layers.get(d).push(t);
  });

  const NODE_W = 220;
  const NODE_H = 64;
  const H_GAP = 140;
  const V_GAP = 36;
  const PADDING = 60;

  const maxLayer = Math.max(...layers.keys(), 0);
  const nodes = [];

  for (let d = 0; d <= maxLayer; d++) {
    const layerTasks = layers.get(d) || [];
    const x = PADDING + d * (NODE_W + H_GAP);
    layerTasks.forEach((t, i) => {
      const y = PADDING + i * (NODE_H + V_GAP);
      nodes.push({
        id: t._id.toString(),
        task: t,
        x,
        y,
        w: NODE_W,
        h: NODE_H,
      });
    });
  }

  // Compute edges
  const edges = [];
  const nodeMap = new Map();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  tasks.forEach((t) => {
    (t.dependsOn || []).forEach((depId) => {
      const fromNode = nodeMap.get(depId.toString());
      const toNode = nodeMap.get(t._id.toString());
      if (fromNode && toNode) {
        edges.push({
          from: fromNode,
          to: toNode,
          isDone: fromNode.task.status === 'done',
        });
      }
    });
  });

  // Canvas size
  const maxX = nodes.reduce((m, n) => Math.max(m, n.x + n.w), 0) + PADDING;
  const maxY = nodes.reduce((m, n) => Math.max(m, n.y + n.h), 0) + PADDING;

  return { nodes, edges, width: Math.max(maxX, 400), height: Math.max(maxY, 300) };
}

export default function DependencyGraph({ tasks }) {
  const containerRef = useRef(null);
  const [hoveredNode, setHoveredNode] = useState(null);

  const { nodes, edges, width, height } = useMemo(() => computeLayout(tasks), [tasks]);

  // Only show graph if there are tasks with dependencies
  const hasDependencies = tasks.some((t) => t.dependsOn && t.dependsOn.length > 0);

  if (tasks.length === 0) {
    return (
      <div className="d-flex align-items-center justify-content-center text-secondary" style={{ minHeight: 300 }}>
        <p>No tasks on this board</p>
      </div>
    );
  }

  if (!hasDependencies) {
    return (
      <div className="d-flex align-items-center justify-content-center text-secondary" style={{ minHeight: 300 }}>
        <div className="text-center">
          <p className="mb-1">No dependencies configured</p>
          <p className="small" style={{ opacity: 0.6 }}>Edit a task and add dependencies to see the graph</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ overflow: 'auto', maxHeight: 'calc(100vh - 120px)' }}>
      <svg
        width={width}
        height={height}
        style={{ backgroundColor: 'rgba(15, 15, 25, 0.5)', borderRadius: 8 }}
      >
        <defs>
          {/* Arrowhead marker */}
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
            fill="#6366f1"
          >
            <polygon points="0 0, 10 3.5, 0 7" />
          </marker>
          <marker
            id="arrowhead-done"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
            fill="#10b981"
          >
            <polygon points="0 0, 10 3.5, 0 7" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((edge, i) => {
          const x1 = edge.from.x + edge.from.w;
          const y1 = edge.from.y + edge.from.h / 2;
          const x2 = edge.to.x;
          const y2 = edge.to.y + edge.to.h / 2;
          const midX = (x1 + x2) / 2;

          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke={edge.isDone ? '#10b981' : '#6366f1'}
              strokeWidth={2}
              strokeOpacity={0.6}
              markerEnd={edge.isDone ? 'url(#arrowhead-done)' : 'url(#arrowhead)'}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const color = STATUS_COLORS[node.task.status] || '#6b7280';
          const isHovered = hoveredNode === node.id;

          return (
            <g
              key={node.id}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Node background */}
              <rect
                x={node.x}
                y={node.y}
                width={node.w}
                height={node.h}
                rx={8}
                ry={8}
                fill={isHovered ? 'rgba(40, 40, 60, 0.95)' : 'rgba(30, 30, 46, 0.9)'}
                stroke={color}
                strokeWidth={isHovered ? 2 : 1.5}
                strokeOpacity={isHovered ? 1 : 0.7}
              />

              {/* Status indicator dot */}
              <circle
                cx={node.x + 14}
                cy={node.y + node.h / 2}
                r={5}
                fill={color}
              />

              {/* Task title (truncated) */}
              <text
                x={node.x + 26}
                y={node.y + 26}
                fill="#e0e0e0"
                fontSize={12}
                fontWeight={600}
                fontFamily="Inter, sans-serif"
              >
                {node.task.title.length > 24 ? node.task.title.slice(0, 24) + '…' : node.task.title}
              </text>

              {/* Status label */}
              <text
                x={node.x + 26}
                y={node.y + 46}
                fill={color}
                fontSize={10}
                fontFamily="Inter, sans-serif"
                textTransform="capitalize"
              >
                {node.task.status.replace('_', ' ')}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
