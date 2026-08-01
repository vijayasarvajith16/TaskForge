import { Card, Badge, Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { Calendar, User, Trash2, Edit2, Lock, CheckCircle, Link2 } from 'lucide-react';

export default function TaskCard({ task, members, allTasks = [], onEdit, onDelete, onComplete, canEdit, isDragging = false }) {
  const assignee = members.find((m) => m._id.toString() === task.assignedTo?.toString());
  const isLocked = task.status === 'locked';
  const isDone = task.status === 'done';
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isDone;

  const statusColors = {
    open: 'primary',
    in_progress: 'info',
    blocked: 'warning',
    done: 'success',
    locked: 'secondary',
  };

  const formatDate = (d) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  // Get blocker names for locked tasks
  const blockerNames = [];
  if (isLocked && task.dependsOn?.length > 0 && allTasks.length > 0) {
    for (const depId of task.dependsOn) {
      const dep = allTasks.find((t) => t._id.toString() === depId.toString());
      if (dep && dep.status !== 'done') {
        blockerNames.push(dep.title);
      }
    }
  }

  // Get all dependency names for tooltip
  const depNames = [];
  if (task.dependsOn?.length > 0 && allTasks.length > 0) {
    for (const depId of task.dependsOn) {
      const dep = allTasks.find((t) => t._id.toString() === depId.toString());
      if (dep) depNames.push(dep.title);
    }
  }

  return (
    <Card
      className={`mb-2 shadow-sm task-card ${isDragging ? 'shadow-lg' : ''}`}
      style={{
        transition: 'transform 0.15s, box-shadow 0.15s, opacity 0.2s',
        borderColor: isDragging ? '#6366f1' : isLocked ? '#4a4a5a' : undefined,
        boxShadow: isDragging ? '0 8px 25px rgba(99, 102, 241, 0.3)' : undefined,
        cursor: isLocked ? 'not-allowed' : 'grab',
        opacity: isLocked ? 0.5 : 1,
        backgroundColor: isLocked ? '#1a1a2e' : '#1e1e2e',
        border: `1px solid ${isLocked ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      <Card.Body className="p-3">
        <div className="d-flex justify-content-between align-items-start mb-1">
          <div className="d-flex align-items-center gap-1">
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
                <Lock size={13} className="text-secondary me-1 flex-shrink-0" />
              </OverlayTrigger>
            )}
            <h6 className={`mb-0 fw-semibold ${isLocked ? 'text-secondary' : 'text-light'}`} style={{ fontSize: '0.9rem' }}>
              {task.title}
            </h6>
          </div>
          <Badge bg={statusColors[task.status] || 'secondary'} className="text-capitalize flex-shrink-0 ms-1" style={{ fontSize: '0.65rem' }}>
            {task.status.replace('_', ' ')}
          </Badge>
        </div>

        {task.description && (
          <p className="text-secondary small mb-2" style={{ fontSize: '0.78rem' }}>
            {task.description.length > 80 ? task.description.slice(0, 80) + '…' : task.description}
          </p>
        )}

        {/* Dependency indicator */}
        {depNames.length > 0 && (
          <OverlayTrigger
            placement="top"
            overlay={
              <Tooltip>
                <strong>Depends on:</strong><br />
                {depNames.join(', ')}
              </Tooltip>
            }
          >
            <span className="d-inline-flex align-items-center text-secondary mb-2" style={{ fontSize: '0.7rem', cursor: 'help' }}>
              <Link2 size={11} className="me-1" /> {depNames.length} {depNames.length === 1 ? 'dependency' : 'dependencies'}
            </span>
          </OverlayTrigger>
        )}

        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            {assignee && (
              <OverlayTrigger placement="top" overlay={<Tooltip>{assignee.name}</Tooltip>}>
                <span className="d-inline-flex align-items-center text-secondary" style={{ fontSize: '0.75rem' }}>
                  <User size={12} className="me-1" /> {assignee.name.split(' ')[0]}
                </span>
              </OverlayTrigger>
            )}
            {task.dueDate && (
              <span className={`d-inline-flex align-items-center ${isOverdue ? 'text-danger' : 'text-secondary'}`} style={{ fontSize: '0.75rem' }}>
                <Calendar size={12} className="me-1" /> {formatDate(task.dueDate)}
              </span>
            )}
          </div>

          <div className="d-flex gap-1">
            {/* Complete button — shown when task is not done and not locked */}
            {canEdit && !isDone && !isLocked && (
              <OverlayTrigger placement="top" overlay={<Tooltip>Mark as done</Tooltip>}>
                <Button
                  variant="link" size="sm" className="p-0 text-success"
                  onClick={(e) => { e.stopPropagation(); onComplete?.(task._id); }}
                >
                  <CheckCircle size={14} />
                </Button>
              </OverlayTrigger>
            )}
            {canEdit && !isLocked && (
              <>
                <Button variant="link" size="sm" className="p-0 text-secondary" onClick={() => onEdit(task)}>
                  <Edit2 size={13} />
                </Button>
                <Button variant="link" size="sm" className="p-0 text-danger" onClick={() => onDelete(task._id)}>
                  <Trash2 size={13} />
                </Button>
              </>
            )}
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}
