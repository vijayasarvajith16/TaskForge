import { useState, useEffect } from 'react';
import { Modal, Form, Button, Row, Col, Badge } from 'react-bootstrap';
import { X } from 'lucide-react';

export default function TaskForm({ show, onHide, onSubmit, task, columns, members, allTasks = [] }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [columnId, setColumnId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dependsOn, setDependsOn] = useState([]);

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setColumnId(task.columnId?.toString() || '');
      setAssignedTo(task.assignedTo?.toString() || '');
      setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
      setDependsOn(task.dependsOn?.map((id) => id.toString()) || []);
    } else {
      setTitle('');
      setDescription('');
      setColumnId(columns?.[0]?._id?.toString() || '');
      setAssignedTo('');
      setDueDate('');
      setDependsOn([]);
    }
  }, [task, show, columns]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      title,
      description,
      columnId,
      assignedTo: assignedTo || null,
      dueDate: dueDate || null,
      dependsOn,
    });
  };

  // Available tasks for dependency selection (exclude self if editing)
  const availableTasks = allTasks.filter((t) => {
    if (task && t._id.toString() === task._id.toString()) return false;
    return true;
  });

  const addDependency = (taskId) => {
    if (!dependsOn.includes(taskId)) {
      setDependsOn([...dependsOn, taskId]);
    }
  };

  const removeDependency = (taskId) => {
    setDependsOn(dependsOn.filter((id) => id !== taskId));
  };

  const getTaskTitle = (taskId) => {
    const t = allTasks.find((t) => t._id.toString() === taskId);
    return t ? t.title : taskId;
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: 18, fontWeight: 650, color: 'var(--tf-ink)' }}>
          {task ? 'Edit Task' : 'New Task'}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ padding: 24 }}>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label className="form-label">Title</Form.Label>
            <Form.Control
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Task title"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="form-label">Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details…"
            />
          </Form.Group>

          <Row className="mb-3">
            <Col>
              <Form.Label className="form-label">Column</Form.Label>
              <Form.Select
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
              >
                {columns?.map((c) => (
                  <option key={c._id.toString()} value={c._id.toString()}>
                    {c.name}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col>
              <Form.Label className="form-label">Assignee</Form.Label>
              <Form.Select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
              >
                <option value="">Unassigned</option>
                {members?.map((m) => (
                  <option key={m._id.toString()} value={m._id.toString()}>
                    {m.name}
                  </option>
                ))}
              </Form.Select>
            </Col>
          </Row>

          <Form.Group className="mb-3">
            <Form.Label className="form-label">Due Date</Form.Label>
            <Form.Control
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </Form.Group>

          {/* Dependencies multi-select */}
          <Form.Group className="mb-4">
            <Form.Label className="form-label">Depends On (prerequisites)</Form.Label>

            {/* Selected dependencies */}
            {dependsOn.length > 0 && (
              <div className="d-flex flex-wrap gap-2 mb-2">
                {dependsOn.map((depId) => (
                  <span
                    key={depId}
                    className="tf-chip dep"
                    style={{ cursor: 'pointer' }}
                    onClick={() => removeDependency(depId)}
                  >
                    {getTaskTitle(depId)}
                    <X size={12} />
                  </span>
                ))}
              </div>
            )}

            {/* Dropdown to add dependencies */}
            <Form.Select
              value=""
              onChange={(e) => {
                if (e.target.value) addDependency(e.target.value);
              }}
            >
              <option value="">+ Add dependency…</option>
              {availableTasks
                .filter((t) => !dependsOn.includes(t._id.toString()))
                .map((t) => (
                  <option key={t._id.toString()} value={t._id.toString()}>
                    {t.title} {t.status === 'done' ? '✓' : ''}
                  </option>
                ))}
            </Form.Select>
          </Form.Group>

          <div className="d-flex gap-2 justify-content-end">
            <Button variant="outline-secondary" onClick={onHide}>Cancel</Button>
            <Button variant="primary" type="submit">{task ? 'Save Changes' : 'Create Task'}</Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
}
