import { Card, Badge, Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { Calendar, User, Trash2, Edit2 } from 'lucide-react';

export default function TaskCard({ task, members, onEdit, onDelete, canEdit, isDragging = false }) {
  const assignee = members.find((m) => m._id.toString() === task.assignedTo?.toString());

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';

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

  return (
    <Card
      className={`bg-dark border-secondary mb-2 shadow-sm task-card ${isDragging ? 'shadow-lg' : ''}`}
      style={{
        transition: 'transform 0.15s, box-shadow 0.15s',
        borderColor: isDragging ? '#6366f1' : undefined,
        boxShadow: isDragging ? '0 8px 25px rgba(99, 102, 241, 0.3)' : undefined,
        cursor: 'grab',
      }}
    >
      <Card.Body className="p-3">
        <div className="d-flex justify-content-between align-items-start mb-1">
          <h6 className="mb-0 fw-semibold text-light" style={{ fontSize: '0.9rem' }}>
            {task.title}
          </h6>
          <Badge bg={statusColors[task.status] || 'secondary'} className="text-capitalize" style={{ fontSize: '0.65rem' }}>
            {task.status.replace('_', ' ')}
          </Badge>
        </div>

        {task.description && (
          <p className="text-secondary small mb-2" style={{ fontSize: '0.78rem' }}>
            {task.description.length > 80 ? task.description.slice(0, 80) + '…' : task.description}
          </p>
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

          {canEdit && (
            <div className="d-flex gap-1">
              <Button variant="link" size="sm" className="p-0 text-secondary" onClick={() => onEdit(task)}>
                <Edit2 size={13} />
              </Button>
              <Button variant="link" size="sm" className="p-0 text-danger" onClick={() => onDelete(task._id)}>
                <Trash2 size={13} />
              </Button>
            </div>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}
