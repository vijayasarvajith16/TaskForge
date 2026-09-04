import { useState, useEffect } from 'react';
import { Modal, Alert } from 'react-bootstrap';

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
      const date = new Date(eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
        <Modal.Title style={{ fontSize: 17, fontWeight: 650, color: 'var(--tf-ink)' }}>
          Instantiate from Blueprint.
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ padding: 24 }}>
        <form onSubmit={handleSubmit}>
          {error && <Alert variant="danger" className="py-2 mb-3">{error}</Alert>}

          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Sprint / Architecture Blueprint</label>
            <select
              className="form-select"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              required
            >
              <option value="">Select a blueprint…</option>
              {templates.map((t) => (
                <option key={t._id.toString()} value={t._id.toString()}>
                  {t.name} ({t.taskBlueprint?.length || 0} tasks)
                </option>
              ))}
            </select>
          </div>

          {/* Blueprint preview */}
          {selectedTemplate && (
            <div style={{
              marginBottom: 16,
              padding: '14px 16px',
              backgroundColor: 'var(--tf-canvas-soft)',
              borderRadius: 'var(--tf-radius-sm)',
              border: '1px solid var(--tf-hairline-soft)',
              fontSize: '12.5px',
            }}>
              <div className="tf-eyebrow" style={{ marginBottom: 8 }}>Blueprint Sequence</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selectedTemplate.taskBlueprint?.map((bp, i) => (
                  <div key={bp.blueprintId || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500, color: 'var(--tf-ink)' }}>{bp.title}</span>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {bp.role && <span className="tf-chip">{bp.role}</span>}
                      <span className="tf-chip">
                        {bp.offsetDaysFromEvent > 0 ? '+' : ''}{bp.offsetDaysFromEvent}d
                      </span>
                      {bp.dependsOn?.length > 0 && (
                        <span className="tf-chip dep">
                          {bp.dependsOn.length} dep{bp.dependsOn.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Target Milestone / Release Date</label>
            <input
              type="date"
              className="form-control"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label className="form-label">New Board Identifier</label>
            <input
              type="text"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Auto-filled from template + date"
              required
            />
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
              Deploy Board
            </button>
          </div>
        </form>
      </Modal.Body>
    </Modal>
  );
}
