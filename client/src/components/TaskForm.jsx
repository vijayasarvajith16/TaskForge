import { useState, useEffect } from 'react';
import { Modal, Row, Col } from 'react-bootstrap';
import { X, Link2 } from 'lucide-react';

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
        <Modal.Title style={{ fontSize: 17, fontWeight: 650, color: 'var(--tf-ink)' }}>
          {task ? 'Edit Issue.' : 'Create New Issue.'}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ padding: 24 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Issue Title</label>
            <input
              type="text"
              className="form-control"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Implement OAuth token revocation endpoint"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Description & Acceptance Criteria</label>
            <textarea
              className="form-control"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide technical context, steps to reproduce, or requirements…"
            />
          </div>

          <Row className="mb-3">
            <Col sm={6}>
              <label className="form-label">Target Stage / Column</label>
              <select
                className="form-select"
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
              >
                {columns?.map((c) => (
                  <option key={c._id.toString()} value={c._id.toString()}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Col>
            <Col sm={6}>
              <label className="form-label">Assignee</label>
              <select
                className="form-select"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
              >
                <option value="">Unassigned</option>
                {members?.map((m) => (
                  <option key={m._id.toString()} value={m._id.toString()}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Col>
          </Row>

          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Target Completion Date</label>
            <input
              type="date"
              className="form-control"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* Dependencies multi-select */}
          <div style={{ marginBottom: 24 }}>
            <label className="form-label">Dependencies (prerequisite issues)</label>

            {dependsOn.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {dependsOn.map((depId) => (
                  <span
                    key={depId}
                    className="tf-chip dep"
                    style={{ cursor: 'pointer' }}
                    onClick={() => removeDependency(depId)}
                    title="Click to remove"
                  >
                    <Link2 size={11} />
                    {getTaskTitle(depId)}
                    <X size={11} style={{ marginLeft: 3 }} />
                  </span>
                ))}
              </div>
            )}

            <select
              className="form-select"
              value=""
              onChange={(e) => {
                if (e.target.value) addDependency(e.target.value);
              }}
            >
              <option value="">+ Link prerequisite issue…</option>
              {availableTasks
                .filter((t) => !dependsOn.includes(t._id.toString()))
                .map((t) => (
                  <option key={t._id.toString()} value={t._id.toString()}>
                    {t.title} {t.status === 'done' ? '✓' : ''}
                  </option>
                ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 14, borderTop: '1px solid var(--tf-hairline-soft)' }}>
            <button
              type="button"
              className="btn button-outline"
              onClick={onHide}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn button-primary"
            >
              {task ? 'Update Issue' : 'Submit Issue'}
            </button>
          </div>
        </form>
      </Modal.Body>
    </Modal>
  );
}
