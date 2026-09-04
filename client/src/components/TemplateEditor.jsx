import { useState, useEffect } from 'react';
import { Modal, Alert } from 'react-bootstrap';
import { Plus, Trash2, X } from 'lucide-react';

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
    <Modal show={show} onHide={onHide} centered size="xl">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: 17, fontWeight: 650, color: 'var(--tf-ink)' }}>
          {template ? 'Edit Sprint Blueprint.' : 'New Sprint Blueprint.'}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ padding: 24 }}>
        <form onSubmit={handleSubmit}>
          {error && <Alert variant="danger" className="py-2.5 px-3 mb-3">{error}</Alert>}

          <div style={{ marginBottom: 20 }}>
            <label className="form-label">Blueprint Identifier</label>
            <input
              type="text"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. "Release Cycle Pipeline"'
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span className="tf-eyebrow" style={{ margin: 0 }}>Blueprint Stage Tasks ({rows.length})</span>
            <button type="button" className="btn button-outline" style={{ height: 32, fontSize: 12.5 }} onClick={addRow}>
              <Plus size={13} style={{ display: 'inline', marginRight: 4 }} /> Add Step
            </button>
          </div>

          {rows.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '36px 20px',
              background: 'var(--tf-canvas-soft)', borderRadius: 'var(--tf-radius-sm)',
              border: '1px dashed var(--tf-hairline)', color: 'var(--tf-text-muted)', fontSize: 13,
            }}>
              No steps added yet. Click "+ Add Step" to construct the blueprint sequence.
            </div>
          ) : (
            <div style={{ maxHeight: 420, overflowY: 'auto', borderRadius: 'var(--tf-radius-sm)', border: '1px solid var(--tf-hairline)' }}>
              <table className="tf-data-table">
                <thead>
                  <tr>
                    <th style={{ width: '28%' }}>Task Title</th>
                    <th style={{ width: '18%' }}>Target Role</th>
                    <th style={{ width: '14%' }}>Day Offset</th>
                    <th style={{ width: '32%' }}>Dependencies</th>
                    <th style={{ width: '8%', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.blueprintId}>
                      <td>
                        <input
                          type="text"
                          className="form-control"
                          style={{ padding: '6px 10px', fontSize: 12.5 }}
                          value={row.title}
                          onChange={(e) => updateRow(row.blueprintId, 'title', e.target.value)}
                          placeholder="Task name"
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-control"
                          style={{ padding: '6px 10px', fontSize: 12.5 }}
                          value={row.role}
                          onChange={(e) => updateRow(row.blueprintId, 'role', e.target.value)}
                          placeholder="Role (e.g. backend)"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="form-control"
                          style={{ padding: '6px 10px', fontSize: 12.5 }}
                          value={row.offsetDaysFromEvent}
                          onChange={(e) => updateRow(row.blueprintId, 'offsetDaysFromEvent', parseInt(e.target.value) || 0)}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {row.dependsOn.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {row.dependsOn.map((depId) => (
                                <span
                                  key={depId}
                                  className="tf-chip dep"
                                  style={{ cursor: 'pointer', fontSize: 10.5 }}
                                  onClick={() => removeDep(row.blueprintId, depId)}
                                >
                                  {getTitle(depId)}
                                  <X size={10} style={{ marginLeft: 2 }} />
                                </span>
                              ))}
                            </div>
                          )}
                          <select
                            className="form-select"
                            style={{ padding: '5px 8px', fontSize: 12 }}
                            value=""
                            onChange={(e) => {
                              if (e.target.value) addDep(row.blueprintId, e.target.value);
                            }}
                          >
                            <option value="">+ Add dependency…</option>
                            {rows
                              .filter((r) => r.blueprintId !== row.blueprintId && !row.dependsOn.includes(r.blueprintId))
                              .map((r) => (
                                <option key={r.blueprintId} value={r.blueprintId}>
                                  {r.title || '(untitled)'}
                                </option>
                              ))}
                          </select>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="tf-icon-btn delete"
                          onClick={() => removeRow(row.blueprintId)}
                          title="Remove row"
                          style={{ margin: '0 auto' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--tf-hairline-soft)', marginTop: 20 }}>
            <button type="button" className="btn button-outline" onClick={onHide}>
              Cancel
            </button>
            <button type="submit" className="btn button-primary">
              Save Blueprint
            </button>
          </div>
        </form>
      </Modal.Body>
    </Modal>
  );
}
