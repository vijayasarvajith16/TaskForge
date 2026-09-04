import { OverlayTrigger, Tooltip } from 'react-bootstrap';
import { Calendar, Lock, CheckCircle, Edit2, Trash2, Link2 } from 'lucide-react';

const STATUS_CONFIG = {
  open:        { label: 'Open',        color: 'var(--col-todo)',       bg: 'var(--tf-canvas-soft)' },
  in_progress: { label: 'In Progress', color: 'var(--col-inprogress)', bg: 'var(--tf-canvas-soft)' },
  blocked:     { label: 'Blocked',     color: 'var(--col-blocked)',    bg: 'var(--tf-canvas-soft)' },
  done:        { label: 'Done',        color: 'var(--col-done)',       bg: 'var(--tf-canvas-soft)' },
  locked:      { label: 'Locked',      color: 'var(--tf-text-muted)',  bg: 'var(--tf-canvas-soft)' },
};

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

const formatDate = (d) => {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function TaskCard({
  task, members, allTasks = [],
  onEdit, onDelete, onComplete, canEdit, isDragging = false, onTaskClick,
}) {
  const assignee  = members.find((m) => m._id.toString() === task.assignedTo?.toString());
  const isLocked  = task.status === 'locked';
  const isDone    = task.status === 'done';
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isDone;

  const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.open;
  const issueId = `TF-${task._id.toString().slice(-4).toUpperCase()}`;

  // Blocker names for tooltip
  const blockerNames = [];
  if (isLocked && task.dependsOn?.length > 0) {
    for (const depId of task.dependsOn) {
      const dep = allTasks.find((t) => t._id.toString() === depId.toString());
      if (dep && dep.status !== 'done') blockerNames.push(dep.title);
    }
  }

  // Dependency names
  const depNames = [];
  if (task.dependsOn?.length > 0) {
    for (const depId of task.dependsOn) {
      const dep = allTasks.find((t) => t._id.toString() === depId.toString());
      if (dep) depNames.push(dep.title);
    }
  }

  return (
    <div
      className={`tf-card ${isDragging ? 'is-dragging' : ''} ${isLocked ? 'is-locked' : ''} ${isDone ? 'is-done' : ''}`}
      onClick={() => !isLocked && onTaskClick?.(task._id.toString())}
    >
      {/* ── Metadata Top Row ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="tf-badge-id">
            {issueId}
          </span>

          {isLocked && (
            <OverlayTrigger
              placement="top"
              overlay={
                <Tooltip>
                  <strong>Blocked by:</strong><br />
                  {blockerNames.length > 0 ? blockerNames.join(', ') : 'Unresolved dependencies'}
                </Tooltip>
              }
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, color: 'var(--col-blocked)', fontWeight: 600 }}>
                <Lock size={11} /> Blocked
              </span>
            </OverlayTrigger>
          )}
        </div>

        {/* Status pill */}
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            padding: '1px 7px',
            borderRadius: 'var(--tf-radius-full)',
            background: statusCfg.bg,
            color: statusCfg.color,
            border: '1px solid var(--tf-hairline-soft)',
          }}
        >
          {statusCfg.label}
        </span>
      </div>

      {/* ── Issue Title ── */}
      <h5 className={`tf-card-title ${isDone ? 'done' : ''}`}>
        {task.title}
      </h5>

      {/* ── Description Preview ── */}
      {task.description && (
        <p className="tf-card-desc">
          {task.description.length > 85 ? task.description.slice(0, 85) + '…' : task.description}
        </p>
      )}

      {/* ── Dependencies Chip ── */}
      {depNames.length > 0 && (
        <OverlayTrigger
          placement="top"
          overlay={<Tooltip><strong>Dependencies:</strong><br />{depNames.join(', ')}</Tooltip>}
        >
          <span className="tf-chip dep" style={{ marginBottom: 8, cursor: 'help' }}>
            <Link2 size={10} /> {depNames.length} dep{depNames.length > 1 ? 's' : ''}
          </span>
        </OverlayTrigger>
      )}

      {/* ── Footer ── */}
      <div className="tf-card-footer">
        <div className="tf-card-meta">
          {task.dueDate && (
            <span className={`tf-chip ${isOverdue ? 'overdue' : ''}`}>
              <Calendar size={10} /> {formatDate(task.dueDate)}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Assignee Avatar */}
          {assignee && (
            <OverlayTrigger placement="top" overlay={<Tooltip>Assigned to {assignee.name}</Tooltip>}>
              <div className="tf-member-avatar">
                {initials(assignee.name)}
              </div>
            </OverlayTrigger>
          )}

          {/* Quick Hover Actions */}
          <div className="tf-card-actions">
            {canEdit && !isDone && !isLocked && (
              <OverlayTrigger placement="top" overlay={<Tooltip>Mark resolved</Tooltip>}>
                <button
                  className="tf-icon-btn complete"
                  onClick={(e) => { e.stopPropagation(); onComplete?.(task._id); }}
                >
                  <CheckCircle size={12} />
                </button>
              </OverlayTrigger>
            )}
            {canEdit && !isLocked && (
              <>
                <button
                  className="tf-icon-btn"
                  onClick={(e) => { e.stopPropagation(); onEdit(task); }}
                  title="Edit issue"
                >
                  <Edit2 size={11} />
                </button>
                <button
                  className="tf-icon-btn delete"
                  onClick={(e) => { e.stopPropagation(); onDelete(task._id); }}
                  title="Delete issue"
                >
                  <Trash2 size={11} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
