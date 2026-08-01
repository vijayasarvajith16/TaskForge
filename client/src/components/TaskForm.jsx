import { useState, useEffect } from 'react';
import { Modal, Form, Button, Row, Col } from 'react-bootstrap';

export default function TaskForm({ show, onHide, onSubmit, task, columns, members }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [columnId, setColumnId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setColumnId(task.columnId?.toString() || '');
      setAssignedTo(task.assignedTo?.toString() || '');
      setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
    } else {
      setTitle('');
      setDescription('');
      setColumnId(columns?.[0]?._id?.toString() || '');
      setAssignedTo('');
      setDueDate('');
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
    });
  };

  return (
    <Modal show={show} onHide={onHide} centered contentClassName="bg-dark text-light border-secondary">
      <Modal.Header closeButton closeVariant="white" className="border-secondary">
        <Modal.Title className="fs-5 fw-bold">{task ? 'Edit Task' : 'New Task'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label className="small text-secondary">Title</Form.Label>
            <Form.Control
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="bg-dark text-light border-secondary"
              placeholder="Task title"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="small text-secondary">Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-dark text-light border-secondary"
              placeholder="Optional details…"
            />
          </Form.Group>

          <Row className="mb-3">
            <Col>
              <Form.Label className="small text-secondary">Column</Form.Label>
              <Form.Select
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
                className="bg-dark text-light border-secondary"
              >
                {columns?.map((c) => (
                  <option key={c._id.toString()} value={c._id.toString()}>
                    {c.name}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col>
              <Form.Label className="small text-secondary">Assignee</Form.Label>
              <Form.Select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="bg-dark text-light border-secondary"
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
            <Form.Label className="small text-secondary">Due Date</Form.Label>
            <Form.Control
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-dark text-light border-secondary"
            />
          </Form.Group>

          <div className="d-flex gap-2 justify-content-end">
            <Button variant="outline-secondary" onClick={onHide}>Cancel</Button>
            <Button variant="primary" type="submit">{task ? 'Save' : 'Create'}</Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
}
