import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getBoards, createBoard, deleteBoard } from '../api';
import {
  Container, Card, Row, Col, Button, Form, Alert, Badge, Spinner,
} from 'react-bootstrap';
import { LayoutDashboard, Plus, Trash2, LogOut, Users } from 'lucide-react';

export default function BoardsPage() {
  const { user, workspace, logout, refreshWorkspace } = useAuth();
  const navigate = useNavigate();

  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [boardName, setBoardName] = useState('');
  const [error, setError] = useState('');

  const canManage = user?.role === 'head' || user?.role === 'joint_head';

  useEffect(() => {
    if (!user?.workspaceId) {
      navigate('/workspace');
      return;
    }
    loadBoards();
    if (!workspace) refreshWorkspace();
  }, [user]);

  const loadBoards = async () => {
    try {
      const res = await getBoards(user.workspaceId);
      setBoards(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load boards');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await createBoard({ name: boardName, workspaceId: user.workspaceId });
      setBoards((prev) => [...prev, res.data]);
      setBoardName('');
      setShowCreate(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create board');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteBoard(id);
      setBoards((prev) => prev.filter((b) => b._id.toString() !== id.toString()));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete board');
    }
  };

  return (
    <div className="min-vh-100 bg-dark text-light">
      {/* Navbar */}
      <nav className="navbar navbar-dark bg-dark border-bottom border-secondary px-3">
        <span className="navbar-brand fw-bold">
          <span className="text-primary">Task</span>Forge
        </span>
        <div className="d-flex align-items-center gap-3">
          <Button variant="outline-light" size="sm" onClick={() => navigate('/workspace')}>
            <Users size={14} className="me-1" /> Workspace
          </Button>
          <Badge bg="secondary" className="text-capitalize">{user?.role?.replace('_', ' ')}</Badge>
          <span className="text-secondary small">{user?.name}</span>
          <Button variant="outline-danger" size="sm" onClick={logout}>
            <LogOut size={14} />
          </Button>
        </div>
      </nav>

      <Container className="py-4" style={{ maxWidth: 900 }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4 className="fw-bold mb-0">
            <LayoutDashboard size={22} className="me-2 text-primary" />
            Boards
          </h4>
          {canManage && (
            <Button variant="primary" size="sm" onClick={() => setShowCreate(!showCreate)}>
              <Plus size={14} className="me-1" /> New Board
            </Button>
          )}
        </div>

        {error && <Alert variant="danger" className="py-2 small" dismissible onClose={() => setError('')}>{error}</Alert>}

        {showCreate && (
          <Card className="bg-dark border-secondary mb-4">
            <Card.Body>
              <Form onSubmit={handleCreate} className="d-flex gap-2">
                <Form.Control
                  type="text"
                  value={boardName}
                  onChange={(e) => setBoardName(e.target.value)}
                  required
                  className="bg-dark text-light border-secondary"
                  placeholder="Board name"
                />
                <Button type="submit" variant="primary">Create</Button>
                <Button variant="outline-secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
              </Form>
            </Card.Body>
          </Card>
        )}

        {loading ? (
          <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>
        ) : boards.length === 0 ? (
          <Card className="bg-dark border-secondary text-center py-5">
            <Card.Body>
              <LayoutDashboard size={40} className="text-secondary mb-3" />
              <p className="text-secondary">No boards yet.{canManage && ' Create one to get started!'}</p>
            </Card.Body>
          </Card>
        ) : (
          <Row className="g-3">
            {boards.map((board) => (
              <Col md={6} lg={4} key={board._id.toString()}>
                <Card
                  className="bg-dark border-secondary h-100 shadow-sm"
                  style={{ cursor: 'pointer', transition: 'transform 0.15s, border-color 0.15s' }}
                  onClick={() => navigate(`/board/${board._id}`)}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = '#6366f1'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = ''; }}
                >
                  <Card.Body className="d-flex flex-column">
                    <h6 className="fw-bold text-light mb-2">{board.name}</h6>
                    <div className="d-flex gap-1 flex-wrap mb-2">
                      {board.columns?.map((c) => (
                        <Badge key={c._id.toString()} bg="secondary" className="fw-normal" style={{ fontSize: '0.65rem' }}>
                          {c.name}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-auto d-flex justify-content-between align-items-center">
                      <span className="text-secondary" style={{ fontSize: '0.7rem' }}>
                        {new Date(board.createdAt).toLocaleDateString()}
                      </span>
                      {canManage && (
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 text-danger"
                          onClick={(e) => { e.stopPropagation(); handleDelete(board._id); }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Container>
    </div>
  );
}
