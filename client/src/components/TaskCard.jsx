import { OverlayTrigger, Tooltip } from 'react-bootstrap';
import { Calendar, Lock, CheckCircle, Edit2, Trash2, Link2 } from 'lucide-react';

const STATUS_COLORS = {
  open:        { bg: '#eff6ff', color: 'var(--col-todo)',       label: 'Open' },
  in_progress: { bg: '#f0f9ff', color: 'var(--col-inprogress)', label: 'In Progress' },
  blocked:     { bg: '#fffbeb', color: 'var(--col-blocked)',    label: 'Blocked' },
  done:        { bg: '#f0fdf4', color: 'var(--col-done)',       label: 'Done' },
  locked:      { bg: '#f3f3f3', color: 'var(--tf-text-muted)',  label: 'Locked' },
};

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

const formatDate = (d) => {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export default function TaskCard({
  task, members, allTasks = [],
  onEdit, onDelete, onComplete, canEdit, isDragging = false, onTaskClick,
}) {
  const assignee  = members.find((m) => m._id.toString() === task.assignedTo?.toString());
  const isLocked  = task.status === 'locked';
  const isDone    = task.status === 'done';
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isDone;

  const statusStyle = STATUS_COLORS[task.status] || STATUS_COLORS.open;

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
      {/* Status label bar (colored strip at top) */}
      <div
        style={{
          height: 3,
          borderRadius: '4px 4px 0 0',
          background: statusStyle.color,
          opacity: 0.7,
          margin: '-10px -12px 8px',
          width: 'calc(100% + 24px)',
        }}
      />

      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
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
            <Lock size={11} style={{ color: 'var(--tf-text-muted)', marginTop: 2, flexShrink: 0 }} />
          </OverlayTrigger>
        )}
        <p className={`tf-card-title ${isDone ? 'done' : ''}`} style={{ flex: 1, margin: 0 }}>
          {task.title}
        </p>
      </div>

      {/* Description snippet */}
      {task.description && (
        <p className="tf-card-desc">
          {task.description.length > 90 ? task.description.slice(0, 90) + '…' : task.description}
        </p>
      )}

      {/* Deps chip */}
      {depNames.length > 0 && (
        <OverlayTrigger
          placement="top"
          overlay={<Tooltip><strong>Depends on:</strong><br />{depNames.join(', ')}</Tooltip>}
        >
          <span className="tf-chip dep" style={{ marginBottom: 7, cursor: 'help' }}>
            <Link2 size={10} /> {depNames.length} dep{depNames.length > 1 ? 's' : ''}
          </span>
        </OverlayTrigger>
      )}

      {/* Footer: meta + actions */}
      <div className="tf-card-footer">
        <div className="tf-card-meta">
          {/* Due date */}
          {task.dueDate && (
            <span className={`tf-chip ${isOverdue ? 'overdue' : ''}`}>
              <Calendar size={10} /> {formatDate(task.dueDate)}
            </span>
          )}
          {/* Status chip (small) */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 7px',
              borderRadius: 20,
              fontSize: 10,
              fontWeight: 600,
              background: statusStyle.bg,
              color: statusStyle.color,
              border: `1px solid ${statusStyle.color}30`,
              whiteSpace: 'nowrap',
            }}
          >
            {statusStyle.label}
          </span>
        </div>

        <div className="tf-card-actions" style={{ display: 'flex', alignItems: 'center', gap: 2, opacity: undefined }}>
          {/* Assignee avatar */}
          {assignee && (
            <OverlayTrigger placement="top" overlay={<Tooltip>{assignee.name}</Tooltip>}>
              <div className="tf-member-avatar" style={{ marginRight: 4 }}>
                {initials(assignee.name)}
              </div>
            </OverlayTrigger>
          )}
          {/* Action icons */}
          {canEdit && !isDone && !isLocked && (
            <OverlayTrigger placement="top" overlay={<Tooltip>Mark done</Tooltip>}>
              <button
                className="tf-icon-btn complete"
                onClick={(e) => { e.stopPropagation(); onComplete?.(task._id); }}
              >
                <CheckCircle size={13} />
              </button>
            </OverlayTrigger>
          )}
          {canEdit && !isLocked && (
            <>
              <button
                className="tf-icon-btn"
                onClick={(e) => { e.stopPropagation(); onEdit(task); }}
              >
                <Edit2 size={12} />
              </button>
              <button
                className="tf-icon-btn delete"
                onClick={(e) => { e.stopPropagation(); onDelete(task._id); }}
              >
                <Trash2 size={12} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
