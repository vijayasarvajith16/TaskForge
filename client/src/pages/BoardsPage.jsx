import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getBoards, createBoard, deleteBoard, getTemplates, createTemplate, updateTemplate, deleteTemplate, createBoardFromTemplate } from '../api';
import TemplateEditor from '../components/TemplateEditor';
import CreateFromTemplate from '../components/CreateFromTemplate';
import NotificationBell from '../components/NotificationBell';
import {
  Container, Card, Row, Col, Button, Form, Alert, Badge, Spinner, Tab, Nav,
} from 'react-bootstrap';
import { LayoutDashboard, Plus, Trash2, LogOut, Users, FileText, Edit2, Copy, BarChart3 } from 'lucide-react';

export default function BoardsPage() {
  const { user, workspace, logout, refreshWorkspace } = useAuth();
  const navigate = useNavigate();

  const [boards, setBoards] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [boardName, setBoardName] = useState('');
  const [error, setError] = useState('');

  // Template editor state
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  // Create from template state
  const [showFromTemplate, setShowFromTemplate] = useState(false);

  const canManage = user?.role === 'head' || user?.role === 'joint_head';

  useEffect(() => {
    if (!user?.workspaceId) {
      navigate('/workspace');
      return;
    }
    loadData();
    if (!workspace) refreshWorkspace();
  }, [user]);

  const loadData = async () => {
    try {
      const [boardsRes, templatesRes] = await Promise.all([
        getBoards(user.workspaceId),
        getTemplates(user.workspaceId),
      ]);
      setBoards(boardsRes.data);
      setTemplates(templatesRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBoard = async (e) => {
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

  const handleDeleteBoard = async (id) => {
    try {
      await deleteBoard(id);
      setBoards((prev) => prev.filter((b) => b._id.toString() !== id.toString()));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete board');
    }
  };

  const handleSaveTemplate = async (data) => {
    try {
      if (editingTemplate) {
        const res = await updateTemplate(editingTemplate._id, data);
        setTemplates((prev) => prev.map((t) => t._id.toString() === editingTemplate._id.toString() ? res.data : t));
      } else {
        const res = await createTemplate({ ...data, workspaceId: user.workspaceId });
        setTemplates((prev) => [res.data, ...prev]);
      }
      setShowTemplateEditor(false);
      setEditingTemplate(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save template');
    }
  };

  const handleDeleteTemplate = async (id) => {
    try {
      await deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t._id.toString() !== id.toString()));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete template');
    }
  };

  const handleCreateFromTemplate = async (data) => {
    const res = await createBoardFromTemplate(data);
    setBoards((prev) => [...prev, res.data.board]);
    setShowFromTemplate(false);
    navigate(`/board/${res.data.board._id}`);
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
          <Button variant="outline-info" size="sm" onClick={() => navigate('/dashboard')}>
            <BarChart3 size={14} className="me-1" /> Dashboard
          </Button>
          <NotificationBell token={localStorage.getItem('token')} />
          <Badge bg="secondary" className="text-capitalize">{user?.role?.replace('_', ' ')}</Badge>
          <span className="text-secondary small">{user?.name}</span>
          <Button variant="outline-danger" size="sm" onClick={logout}>
            <LogOut size={14} />
          </Button>
        </div>
      </nav>

      <Container className="py-4" style={{ maxWidth: 1000 }}>
        {error && <Alert variant="danger" className="py-2 small" dismissible onClose={() => setError('')}>{error}</Alert>}

        <Tab.Container defaultActiveKey="boards">
          <Nav variant="tabs" className="mb-4 border-secondary">
            <Nav.Item>
              <Nav.Link eventKey="boards">
                <LayoutDashboard size={15} className="me-1" /> Boards
              </Nav.Link>
            </Nav.Item>
            {canManage && (
              <Nav.Item>
                <Nav.Link eventKey="templates">
                  <FileText size={15} className="me-1" /> Templates
                </Nav.Link>
              </Nav.Item>
            )}
          </Nav>

          <Tab.Content>
            {/* ── Boards Tab ───────────────── */}
            <Tab.Pane eventKey="boards">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h4 className="fw-bold mb-0">
                  <LayoutDashboard size={22} className="me-2 text-primary" />
                  Boards
                </h4>
                {canManage && (
                  <div className="d-flex gap-2">
                    {templates.length > 0 && (
                      <Button variant="outline-primary" size="sm" onClick={() => setShowFromTemplate(true)}>
                        <Copy size={14} className="me-1" /> From Template
                      </Button>
                    )}
                    <Button variant="primary" size="sm" onClick={() => setShowCreate(!showCreate)}>
                      <Plus size={14} className="me-1" /> New Board
                    </Button>
                  </div>
                )}
              </div>

              {showCreate && (
                <Card className="bg-dark border-secondary mb-4 shadow-lg" style={{ maxWidth: '500px', animation: 'fadeIn 0.25s ease' }}>
                  <Card.Body className="p-3">
                    <h6 className="fw-bold mb-3 text-light">Create New Board</h6>
                    <Form onSubmit={handleCreateBoard}>
                      <Form.Group className="mb-3">
                        <Form.Label className="small text-secondary">Board Name</Form.Label>
                        <Form.Control
                          type="text"
                          value={boardName}
                          onChange={(e) => setBoardName(e.target.value)}
                          required
                          className="bg-dark text-light border-secondary py-2"
                          placeholder="e.g. Autumn Sprint, Development Road..."
                          style={{ fontSize: '0.9rem' }}
                        />
                      </Form.Group>
                      <div className="d-flex justify-content-end gap-2">
                        {boardName && (
                          <Button 
                            variant="outline-warning" 
                            size="sm" 
                            onClick={() => setBoardName('')}
                            style={{ fontSize: '0.8rem' }}
                          >
                            Clear
                          </Button>
                        )}
                        <Button 
                          variant="outline-secondary" 
                          size="sm" 
                          onClick={() => { setShowCreate(false); setBoardName(''); }}
                          style={{ fontSize: '0.8rem' }}
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          variant="primary" 
                          size="sm"
                          style={{ fontSize: '0.8rem', paddingLeft: '15px', paddingRight: '15px' }}
                        >
                          Create
                        </Button>
                      </div>
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
                          {board.eventDate && (
                            <Badge bg="info" className="mb-2 align-self-start" style={{ fontSize: '0.65rem' }}>
                              Event: {new Date(board.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </Badge>
                          )}
                          <div className="mt-auto d-flex justify-content-between align-items-center">
                            <span className="text-secondary" style={{ fontSize: '0.7rem' }}>
                              {new Date(board.createdAt).toLocaleDateString()}
                            </span>
                            {canManage && (
                              <Button
                                variant="link" size="sm" className="p-0 text-danger"
                                onClick={(e) => { e.stopPropagation(); handleDeleteBoard(board._id); }}
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
            </Tab.Pane>

            {/* ── Templates Tab ────────────── */}
            {canManage && (
              <Tab.Pane eventKey="templates">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h4 className="fw-bold mb-0">
                    <FileText size={22} className="me-2 text-primary" />
                    Event Templates
                  </h4>
                  <Button variant="primary" size="sm" onClick={() => { setEditingTemplate(null); setShowTemplateEditor(true); }}>
                    <Plus size={14} className="me-1" /> New Template
                  </Button>
                </div>

                {templates.length === 0 ? (
                  <Card className="bg-dark border-secondary text-center py-5">
                    <Card.Body>
                      <FileText size={40} className="text-secondary mb-3" />
                      <p className="text-secondary">No templates yet. Create reusable event blueprints!</p>
                    </Card.Body>
                  </Card>
                ) : (
                  <Row className="g-3">
                    {templates.map((tmpl) => (
                      <Col md={6} lg={4} key={tmpl._id.toString()}>
                        <Card className="bg-dark border-secondary h-100 shadow-sm">
                          <Card.Body className="d-flex flex-column">
                            <h6 className="fw-bold text-light mb-2">{tmpl.name}</h6>
                            <div className="d-flex gap-1 flex-wrap mb-2">
                              <Badge bg="primary" style={{ fontSize: '0.65rem' }}>
                                {tmpl.taskBlueprint?.length || 0} tasks
                              </Badge>
                              {tmpl.taskBlueprint?.some((bp) => bp.dependsOn?.length > 0) && (
                                <Badge bg="warning" text="dark" style={{ fontSize: '0.65rem' }}>
                                  Has dependencies
                                </Badge>
                              )}
                            </div>
                            <div className="small text-secondary mb-2" style={{ fontSize: '0.75rem' }}>
                              {tmpl.taskBlueprint?.slice(0, 3).map((bp) => bp.title).join(', ')}
                              {(tmpl.taskBlueprint?.length || 0) > 3 && '…'}
                            </div>
                            <div className="mt-auto d-flex justify-content-end gap-1">
                              <Button
                                variant="outline-primary" size="sm"
                                onClick={() => { setEditingTemplate(tmpl); setShowTemplateEditor(true); }}
                              >
                                <Edit2 size={12} className="me-1" /> Edit
                              </Button>
                              <Button variant="outline-danger" size="sm" onClick={() => handleDeleteTemplate(tmpl._id)}>
                                <Trash2 size={12} />
                              </Button>
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                )}
              </Tab.Pane>
            )}
          </Tab.Content>
        </Tab.Container>
      </Container>

      {/* Modals */}
      <TemplateEditor
        show={showTemplateEditor}
        onHide={() => { setShowTemplateEditor(false); setEditingTemplate(null); }}
        onSave={handleSaveTemplate}
        template={editingTemplate}
      />

      <CreateFromTemplate
        show={showFromTemplate}
        onHide={() => setShowFromTemplate(false)}
        templates={templates}
        onSubmit={handleCreateFromTemplate}
      />
    </div>
  );
}
