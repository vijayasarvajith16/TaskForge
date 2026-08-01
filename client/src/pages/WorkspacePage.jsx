import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createWorkspace, joinWorkspace, generateInvite } from '../api';
import {
  Container, Row, Col, Card, Form, Button, Alert, Badge, ListGroup,
} from 'react-bootstrap';
import { Users, Copy, RefreshCw, LogOut } from 'lucide-react';

export default function WorkspacePage() {
  const { user, workspace, logout, refreshWorkspace, updateLocalUser } = useAuth();
  const navigate = useNavigate();

  const [wsName, setWsName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.workspaceId && !workspace) {
      refreshWorkspace();
    }
  }, [user]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await createWorkspace({ name: wsName });
      updateLocalUser({ workspaceId: res.data._id, role: 'head' });
      await refreshWorkspace();
      setSuccess('Workspace created!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create workspace');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await joinWorkspace(joinCode);
      updateLocalUser({ workspaceId: res.data.workspace._id });
      await refreshWorkspace();
      setSuccess('Joined workspace!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join workspace');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenInvite = async () => {
    try {
      await generateInvite(workspace._id);
      await refreshWorkspace();
      setSuccess('Invite code regenerated!');
    } catch {
      setError('Failed to regenerate invite');
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(workspace.inviteCode);
    setSuccess('Invite code copied!');
    setTimeout(() => setSuccess(''), 2000);
  };

  // ── If user has a workspace, show its details ──
  if (workspace) {
    return (
      <div className="min-vh-100 bg-dark text-light">
        <nav className="navbar navbar-dark bg-dark border-bottom border-secondary px-3">
          <span className="navbar-brand fw-bold d-flex align-items-center gap-2">
            <img src="/logo.png" alt="TaskForge Logo" style={{ width: 24, height: 24 }} />
            <span><span className="text-primary">Task</span>Forge</span>
          </span>
          <div className="d-flex align-items-center gap-3">
            <Button variant="outline-light" size="sm" onClick={() => navigate('/boards')}>
              Boards
            </Button>
            <Badge bg="secondary" className="text-capitalize">{user.role.replace('_', ' ')}</Badge>
            <Button variant="outline-danger" size="sm" onClick={logout}>
              <LogOut size={14} className="me-1" /> Logout
            </Button>
          </div>
        </nav>

        <Container className="py-4" style={{ maxWidth: 700 }}>
          {success && <Alert variant="success" className="py-2 small" dismissible onClose={() => setSuccess('')}>{success}</Alert>}
          {error && <Alert variant="danger" className="py-2 small" dismissible onClose={() => setError('')}>{error}</Alert>}

          <Card className="bg-dark border-secondary mb-4">
            <Card.Body>
              <h4 className="fw-bold mb-1">
                <Users size={20} className="me-2 text-primary" />
                {workspace.name}
              </h4>
              <p className="text-secondary small mb-3">
                {workspace.members?.length || 0} members
              </p>

              <div className="d-flex align-items-center gap-2 mb-3">
                <span className="text-secondary small">Invite Code:</span>
                <code className="bg-secondary bg-opacity-25 px-2 py-1 rounded text-info fw-bold">
                  {workspace.inviteCode}
                </code>
                <Button variant="outline-info" size="sm" onClick={copyCode} title="Copy">
                  <Copy size={14} />
                </Button>
                {(user.role === 'head' || user.role === 'joint_head') && (
                  <Button variant="outline-warning" size="sm" onClick={handleRegenInvite} title="Regenerate">
                    <RefreshCw size={14} />
                  </Button>
                )}
              </div>

              <h6 className="text-secondary">Members</h6>
              <ListGroup variant="flush">
                {workspace.members?.map((m) => (
                  <ListGroup.Item
                    key={m._id}
                    className="bg-dark text-light border-secondary d-flex justify-content-between align-items-center"
                  >
                    <span>{m.name} <span className="text-secondary small">({m.email})</span></span>
                    <Badge bg={m.role === 'head' ? 'primary' : m.role === 'joint_head' ? 'info' : 'secondary'} className="text-capitalize">
                      {m.role.replace('_', ' ')}
                    </Badge>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </Card.Body>
          </Card>
        </Container>
      </div>
    );
  }

  // ── No workspace yet — create or join ──
  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-dark">
      <Container style={{ maxWidth: 800 }}>
        <div className="text-center mb-4">
          <h2 className="fw-bold text-light">
            <span className="text-primary">Task</span>Forge
          </h2>
          <p className="text-secondary">Create a workspace or join one with an invite code</p>
        </div>

        {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
        {success && <Alert variant="success" className="py-2 small">{success}</Alert>}

        <Row className="g-4">
          <Col md={6}>
            <Card className="bg-dark text-light border-secondary h-100">
              <Card.Body className="p-4">
                <h5 className="fw-bold mb-3">Create Workspace</h5>
                <Form onSubmit={handleCreate}>
                  <Form.Group className="mb-3">
                    <Form.Label className="small text-secondary">Workspace Name</Form.Label>
                    <Form.Control
                      type="text"
                      value={wsName}
                      onChange={(e) => setWsName(e.target.value)}
                      required
                      className="bg-dark text-light border-secondary"
                      placeholder="e.g. HR Team Alpha"
                    />
                  </Form.Group>
                  <Button type="submit" variant="primary" className="w-100" disabled={loading}>
                    {loading ? 'Creating…' : 'Create'}
                  </Button>
                </Form>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6}>
            <Card className="bg-dark text-light border-secondary h-100">
              <Card.Body className="p-4">
                <h5 className="fw-bold mb-3">Join Workspace</h5>
                <Form onSubmit={handleJoin}>
                  <Form.Group className="mb-3">
                    <Form.Label className="small text-secondary">Invite Code</Form.Label>
                    <Form.Control
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      required
                      className="bg-dark text-light border-secondary"
                      placeholder="e.g. A1B2C3D4"
                    />
                  </Form.Group>
                  <Button type="submit" variant="outline-primary" className="w-100" disabled={loading}>
                    {loading ? 'Joining…' : 'Join'}
                  </Button>
                </Form>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <div className="text-center mt-3">
          <Button variant="link" className="text-secondary text-decoration-none small" onClick={logout}>
            <LogOut size={14} className="me-1" /> Sign out
          </Button>
        </div>
      </Container>
    </div>
  );
}
