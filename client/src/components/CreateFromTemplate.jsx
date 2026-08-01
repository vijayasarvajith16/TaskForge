import { useState, useEffect } from 'react';
import { Modal, Form, Button, Alert, Badge } from 'react-bootstrap';

export default function CreateFromTemplate({ show, onHide, templates, onSubmit }) {
  const [templateId, setTemplateId] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const selectedTemplate = templates.find((t) => t._id.toString() === templateId);

  useEffect(() => {
    if (show) {
      setTemplateId('');
      setEventDate('');
      setName('');
      setError('');
    }
  }, [show]);

  // Auto-fill name when template is selected
  useEffect(() => {
    if (selectedTemplate && eventDate) {
      const date = new Date(eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      setName(`${selectedTemplate.name} — ${date}`);
    }
  }, [templateId, eventDate, selectedTemplate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!templateId || !eventDate || !name.trim()) {
      setError('All fields are required');
      return;
    }
    try {
      await onSubmit({ templateId, eventDate, name: name.trim() });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create board');
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered contentClassName="bg-dark text-light border-secondary">
      <Modal.Header closeButton closeVariant="white" className="border-secondary">
        <Modal.Title className="fs-5 fw-bold">Create Board from Template</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}

          <Form.Group className="mb-3">
            <Form.Label className="small text-secondary">Template</Form.Label>
            <Form.Select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="bg-dark text-light border-secondary"
              required
            >
              <option value="">Select a template…</option>
              {templates.map((t) => (
                <option key={t._id.toString()} value={t._id.toString()}>
                  {t.name} ({t.taskBlueprint?.length || 0} tasks)
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          {/* Blueprint preview */}
          {selectedTemplate && (
            <div className="mb-3 p-2 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.03)', fontSize: '0.78rem' }}>
              <div className="text-secondary small fw-semibold mb-1">Blueprint preview:</div>
              {selectedTemplate.taskBlueprint?.map((bp, i) => (
                <div key={bp.blueprintId || i} className="d-flex justify-content-between align-items-center py-1">
                  <span className="text-light">{bp.title}</span>
                  <div className="d-flex gap-1 align-items-center">
                    {bp.role && <Badge bg="info" style={{ fontSize: '0.6rem' }}>{bp.role}</Badge>}
                    <Badge bg="secondary" style={{ fontSize: '0.6rem' }}>
                      {bp.offsetDaysFromEvent > 0 ? '+' : ''}{bp.offsetDaysFromEvent}d
                    </Badge>
                    {bp.dependsOn?.length > 0 && (
                      <Badge bg="warning" text="dark" style={{ fontSize: '0.6rem' }}>
                        {bp.dependsOn.length} dep{bp.dependsOn.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Form.Group className="mb-3">
            <Form.Label className="small text-secondary">Event Date</Form.Label>
            <Form.Control
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="bg-dark text-light border-secondary"
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="small text-secondary">Board Name</Form.Label>
            <Form.Control
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-dark text-light border-secondary"
              placeholder="Auto-filled from template + date"
              required
            />
          </Form.Group>

          <div className="d-flex gap-2 justify-content-end">
            <Button variant="outline-secondary" onClick={onHide}>Cancel</Button>
            <Button variant="primary" type="submit">Create Board</Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
}
