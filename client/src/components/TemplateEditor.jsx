import { useState, useEffect } from 'react';
import { Modal, Form, Button, Table, Badge, Alert } from 'react-bootstrap';
import { Plus, Trash2, X } from 'lucide-react';

/**
 * Generate a short unique ID for blueprint entries (client-side only).
 */
function genBpId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function TemplateEditor({ show, onHide, onSave, template }) {
  const [name, setName] = useState('');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (template) {
      setName(template.name || '');
      setRows(
        (template.taskBlueprint || []).map((bp) => ({
          blueprintId: bp.blueprintId || genBpId(),
          title: bp.title || '',
          role: bp.role || '',
          offsetDaysFromEvent: bp.offsetDaysFromEvent ?? 0,
          dependsOn: bp.dependsOn || [],
        }))
      );
    } else {
      setName('');
      setRows([]);
    }
    setError('');
  }, [template, show]);

  const addRow = () => {
    setRows([...rows, { blueprintId: genBpId(), title: '', role: '', offsetDaysFromEvent: 0, dependsOn: [] }]);
  };

  const removeRow = (bpId) => {
    setRows((prev) => {
      const without = prev.filter((r) => r.blueprintId !== bpId);
      // Also remove this bpId from any other row's dependsOn
      return without.map((r) => ({
        ...r,
        dependsOn: r.dependsOn.filter((d) => d !== bpId),
      }));
    });
  };

  const updateRow = (bpId, field, value) => {
    setRows((prev) => prev.map((r) => r.blueprintId === bpId ? { ...r, [field]: value } : r));
  };

  const addDep = (bpId, depId) => {
    setRows((prev) => prev.map((r) => {
      if (r.blueprintId === bpId && !r.dependsOn.includes(depId)) {
        return { ...r, dependsOn: [...r.dependsOn, depId] };
      }
      return r;
    }));
  };

  const removeDep = (bpId, depId) => {
    setRows((prev) => prev.map((r) => {
      if (r.blueprintId === bpId) {
        return { ...r, dependsOn: r.dependsOn.filter((d) => d !== depId) };
      }
      return r;
    }));
  };

  const getTitle = (bpId) => {
    const r = rows.find((r) => r.blueprintId === bpId);
    return r ? r.title || '(untitled)' : bpId;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('Template name is required'); return; }
    if (rows.length === 0) { setError('Add at least one task to the blueprint'); return; }
    for (const r of rows) {
      if (!r.title.trim()) { setError('All tasks must have a title'); return; }
    }

    onSave({ name: name.trim(), taskBlueprint: rows });
  };

  return (
    <Modal show={show} onHide={onHide} centered size="xl" contentClassName="bg-dark text-light border-secondary">
      <Modal.Header closeButton closeVariant="white" className="border-secondary">
        <Modal.Title className="fs-5 fw-bold">{template ? 'Edit Template' : 'New Template'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}

          <Form.Group className="mb-3">
            <Form.Label className="small text-secondary">Template Name</Form.Label>
            <Form.Control
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-dark text-light border-secondary"
              placeholder='e.g. "Freshers Induction"'
              required
            />
          </Form.Group>

          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="small text-secondary fw-semibold">Task Blueprint</span>
            <Button variant="outline-primary" size="sm" onClick={addRow}>
              <Plus size={14} className="me-1" /> Add Task
            </Button>
          </div>

          {rows.length === 0 ? (
            <p className="text-secondary text-center small py-3">No tasks yet. Click "Add Task" to start.</p>
          ) : (
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              <Table size="sm" variant="dark" bordered className="mb-0" style={{ fontSize: '0.82rem' }}>
                <thead>
                  <tr className="text-secondary">
                    <th style={{ width: '28%' }}>Title</th>
                    <th style={{ width: '16%' }}>Role</th>
                    <th style={{ width: '12%' }}>Offset (days)</th>
                    <th style={{ width: '36%' }}>Depends On</th>
                    <th style={{ width: '8%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.blueprintId}>
                      <td>
                        <Form.Control
                          size="sm"
                          value={row.title}
                          onChange={(e) => updateRow(row.blueprintId, 'title', e.target.value)}
                          className="bg-dark text-light border-secondary"
                          placeholder="Task title"
                        />
                      </td>
                      <td>
                        <Form.Select
                          size="sm"
                          value={row.role}
                          onChange={(e) => updateRow(row.blueprintId, 'role', e.target.value)}
                          className="bg-dark text-light border-secondary"
                        >
                          <option value="">Any</option>
                          <option value="head">Head</option>
                          <option value="joint_head">Joint Head</option>
                          <option value="member">Member</option>
                        </Form.Select>
                      </td>
                      <td>
                        <Form.Control
                          size="sm"
                          type="number"
                          value={row.offsetDaysFromEvent}
                          onChange={(e) => updateRow(row.blueprintId, 'offsetDaysFromEvent', parseInt(e.target.value) || 0)}
                          className="bg-dark text-light border-secondary"
                        />
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-1 mb-1">
                          {row.dependsOn.map((depId) => (
                            <Badge
                              key={depId}
                              bg="secondary"
                              className="d-inline-flex align-items-center gap-1 py-1 px-2"
                              style={{ fontSize: '0.7rem', cursor: 'pointer' }}
                              onClick={() => removeDep(row.blueprintId, depId)}
                            >
                              {getTitle(depId)} <X size={10} />
                            </Badge>
                          ))}
                        </div>
                        <Form.Select
                          size="sm"
                          value=""
                          onChange={(e) => { if (e.target.value) addDep(row.blueprintId, e.target.value); }}
                          className="bg-dark text-light border-secondary"
                        >
                          <option value="">+ Add…</option>
                          {rows
                            .filter((r) => r.blueprintId !== row.blueprintId && !row.dependsOn.includes(r.blueprintId))
                            .map((r) => (
                              <option key={r.blueprintId} value={r.blueprintId}>
                                {r.title || '(untitled)'}
                              </option>
                            ))}
                        </Form.Select>
                      </td>
                      <td className="text-center">
                        <Button variant="link" size="sm" className="p-0 text-danger" onClick={() => removeRow(row.blueprintId)}>
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}

          <div className="d-flex gap-2 justify-content-end mt-3">
            <Button variant="outline-secondary" onClick={onHide}>Cancel</Button>
            <Button variant="primary" type="submit">{template ? 'Save' : 'Create'}</Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
}
