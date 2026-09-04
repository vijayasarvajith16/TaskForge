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
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: 18, fontWeight: 650, color: 'var(--tf-ink)' }}>
          Create Board from Template
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ padding: 24 }}>
        <Form onSubmit={handleSubmit}>
          {error && <Alert variant="danger" className="py-2 mb-3">{error}</Alert>}

          <Form.Group className="mb-3">
            <Form.Label className="form-label">Template</Form.Label>
            <Form.Select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
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
            <div className="mb-3 p-3" style={{ backgroundColor: 'var(--tf-canvas-soft)', borderRadius: 16, border: '1px solid var(--tf-hairline-soft)', fontSize: '0.82rem' }}>
              <div className="form-label mb-2">Blueprint preview:</div>
              {selectedTemplate.taskBlueprint?.map((bp, i) => (
                <div key={bp.blueprintId || i} className="d-flex justify-content-between align-items-center py-1">
                  <span style={{ fontWeight: 500, color: 'var(--tf-ink)' }}>{bp.title}</span>
                  <div className="d-flex gap-1 align-items-center">
                    {bp.role && <span className="tf-chip" style={{ fontSize: '10px' }}>{bp.role}</span>}
                    <span className="tf-chip" style={{ fontSize: '10px' }}>
                      {bp.offsetDaysFromEvent > 0 ? '+' : ''}{bp.offsetDaysFromEvent}d
                    </span>
                    {bp.dependsOn?.length > 0 && (
                      <span className="tf-chip dep" style={{ fontSize: '10px' }}>
                        {bp.dependsOn.length} dep{bp.dependsOn.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Form.Group className="mb-3">
            <Form.Label className="form-label">Event Date</Form.Label>
            <Form.Control
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
            />
          </Form.Group>

          <Form.Group className="mb-4">
            <Form.Label className="form-label">Board Name</Form.Label>
            <Form.Control
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
