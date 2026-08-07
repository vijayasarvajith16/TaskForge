import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getBoards, createBoard, deleteBoard,
  getTemplates, createTemplate, updateTemplate, deleteTemplate,
  createBoardFromTemplate,
} from '../api';
import TemplateEditor from '../components/TemplateEditor';
import CreateFromTemplate from '../components/CreateFromTemplate';
import NotificationBell from '../components/NotificationBell';
import { Spinner, Alert } from 'react-bootstrap';
import {
  LayoutDashboard, Plus, Trash2, LogOut, Users, FileText,
  Edit2, Copy, BarChart3, Calendar, Zap, ChevronRight,
} from 'lucide-react';

// Board cover gradients — cycles through a palette
const COVER_GRADIENTS = [
  'linear-gradient(135deg,#1e3a5f 0%,#0f2340 100%)',
  'linear-gradient(135deg,#1a3a2a 0%,#0f2318 100%)',
  'linear-gradient(135deg,#3a1a2a 0%,#230f18 100%)',
  'linear-gradient(135deg,#2a2a1a 0%,#1a1a0f 100%)',
  'linear-gradient(135deg,#1a1a3a 0%,#0f0f23 100%)',
  'linear-gradient(135deg,#2a1a1a 0%,#1a0f0f 100%)',
];

function getBoardGradient(id) {
  const idx = id ? id.charCodeAt(id.length - 1) % COVER_GRADIENTS.length : 0;
  return COVER_GRADIENTS[idx];
}

function initials(name) {
  if (!name) return '?';
  const p = name.trim().split(' ');
  return (p[0][0] + (p[1]?.[0] || '')).toUpperCase();
}

export default function BoardsPage() {
  const { user, workspace, logout, refreshWorkspace } = useAuth();
  const navigate = useNavigate();

  const [boards, setBoards]       = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('boards');
  const [showCreate, setShowCreate] = useState(false);
  const [boardName, setBoardName]   = useState('');
  const [error, setError]           = useState('');

  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate]       = useState(null);
  const [showFromTemplate, setShowFromTemplate]     = useState(false);

  const canManage = user?.role === 'head' || user?.role === 'joint_head';

  useEffect(() => {
    if (!user?.workspaceId) { navigate('/workspace'); return; }
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
    <div style={{ minHeight: '100vh', background: 'var(--tf-bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Trello-style top navbar ── */}
      <div className="tf-navbar">
        <a className="tf-navbar-brand" style={{ cursor: 'default' }}>
          <img src="/logo.png" alt="TaskForge" style={{ width: 26, height: 26, borderRadius: 6 }} />
          <span><span className="tf-brand-blue">Task</span>Forge</span>
        </a>

        {/* Tab strip */}
        <div style={{ display: 'flex', gap: 2, flex: 1 }}>
          {[
            { key: 'boards', icon: <LayoutDashboard size={13} />, label: 'Boards' },
            ...(canManage ? [{ key: 'templates', icon: <FileText size={13} />, label: 'Templates' }] : []),
          ].map(({ key, icon, label }) => (
            <button
              key={key}
              className={`tf-navbar-btn ${activeTab === key ? 'active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="tf-navbar-btn" onClick={() => navigate('/dashboard')}>
            <BarChart3 size={13} /> Dashboard
          </button>
          <button className="tf-navbar-btn" onClick={() => navigate('/workspace')}>
            <Users size={13} /> Workspace
          </button>
          <NotificationBell token={localStorage.getItem('token')} />
          {/* Avatar */}
          <div
            className="tf-avatar"
            title={`${user?.name} • ${user?.role?.replace('_', ' ')}`}
            onClick={logout}
          >
            {user?.name ? initials(user.name) : '?'}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, padding: '28px 32px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        {error && (
          <Alert variant="danger" className="py-2 small mb-3" dismissible onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* ══ BOARDS TAB ══════════════════════════════════════════════════════ */}
        {activeTab === 'boards' && (
          <>
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <p className="tf-section-header" style={{ margin: 0 }}>
                  {workspace?.name || 'Your workspace'}
                </p>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-text-strong)', margin: 0 }}>
                  Boards
                </h2>
              </div>
              {canManage && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {templates.length > 0 && (
                    <button className="tf-navbar-btn" onClick={() => setShowFromTemplate(true)}>
                      <Copy size={13} /> From Template
                    </button>
                  )}
                  <button
                    className="tf-navbar-btn active"
                    onClick={() => setShowCreate(!showCreate)}
                    style={{ fontWeight: 600 }}
                  >
                    <Plus size={14} /> Create board
                  </button>
                </div>
              )}
            </div>

            {/* Inline create form */}
            {showCreate && (
              <div style={{
                background: 'var(--tf-col-bg)',
                border: '1px solid var(--tf-border)',
                borderRadius: 10,
                padding: '16px 20px',
                marginBottom: 20,
                maxWidth: 420,
                animation: 'fadeIn 0.2s ease',
              }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tf-text-strong)', marginBottom: 12 }}>
                  Create board
                </p>
                <form onSubmit={handleCreateBoard}>
                  <input
                    type="text"
                    className="form-control"
                    value={boardName}
                    onChange={(e) => setBoardName(e.target.value)}
                    placeholder="Board title"
                    required
                    autoFocus
                    style={{ marginBottom: 10 }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" className="tf-navbar-btn active" style={{ fontWeight: 600, height: 34, padding: '0 16px' }}>
                      Create
                    </button>
                    <button
                      type="button"
                      className="tf-navbar-btn"
                      onClick={() => { setShowCreate(false); setBoardName(''); }}
                      style={{ height: 34 }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Board grid */}
            {loading ? (
              <div style={{ textAlign: 'center', paddingTop: 60 }}>
                <Spinner animation="border" variant="primary" />
              </div>
            ) : boards.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '60px 20px',
                background: 'var(--tf-col-bg)', borderRadius: 12,
                border: '1px dashed var(--tf-border)',
              }}>
                <LayoutDashboard size={40} style={{ color: 'var(--tf-text-muted)', marginBottom: 12 }} />
                <p style={{ color: 'var(--tf-text-muted)', fontSize: 14 }}>
                  No boards yet.{canManage ? ' Create one above to get started!' : ''}
                </p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 14,
              }}>
                {boards.map((board) => (
                  <div
                    key={board._id.toString()}
                    className="tf-board-card"
                    onClick={() => navigate(`/board/${board._id}`)}
                  >
                    {/* Colored cover */}
                    <div
                      className="tf-board-card-cover"
                      style={{ background: getBoardGradient(board._id.toString()) }}
                    >
                      {board.eventDate && (
                        <span style={{
                          fontSize: 10, fontWeight: 600,
                          background: 'rgba(255,255,255,0.15)',
                          padding: '2px 8px', borderRadius: 20, color: '#fff',
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                          <Calendar size={9} />
                          {new Date(board.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>

                    {/* Body */}
                    <div className="tf-board-card-body">
                      <p className="tf-board-card-title">{board.name}</p>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                        {board.columns?.slice(0, 4).map((c) => (
                          <span key={c._id.toString()} style={{
                            fontSize: 10, padding: '1px 6px', borderRadius: 3,
                            background: 'rgba(255,255,255,0.07)',
                            color: 'var(--tf-text-muted)', fontWeight: 500,
                          }}>
                            {c.name}
                          </span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, color: 'var(--tf-text-muted)' }}>
                          {new Date(board.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          {canManage && (
                            <button
                              className="tf-icon-btn delete"
                              onClick={(e) => { e.stopPropagation(); handleDeleteBoard(board._id); }}
                              title="Delete board"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                          <ChevronRight size={13} style={{ color: 'var(--tf-text-muted)' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══ TEMPLATES TAB ═══════════════════════════════════════════════════ */}
        {activeTab === 'templates' && canManage && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-text-strong)', margin: 0 }}>
                Event Templates
              </h2>
              <button
                className="tf-navbar-btn active"
                onClick={() => { setEditingTemplate(null); setShowTemplateEditor(true); }}
                style={{ fontWeight: 600 }}
              >
                <Plus size={14} /> New Template
              </button>
            </div>

            {templates.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '60px 20px',
                background: 'var(--tf-col-bg)', borderRadius: 12,
                border: '1px dashed var(--tf-border)',
              }}>
                <FileText size={40} style={{ color: 'var(--tf-text-muted)', marginBottom: 12 }} />
                <p style={{ color: 'var(--tf-text-muted)', fontSize: 14 }}>
                  No templates yet. Create reusable event blueprints!
                </p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 14,
              }}>
                {templates.map((tmpl) => (
                  <div key={tmpl._id.toString()} style={{
                    background: 'var(--tf-col-bg)',
                    border: '1px solid var(--tf-border)',
                    borderRadius: 10,
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    transition: 'var(--tf-transition)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-text-strong)', margin: 0 }}>
                        {tmpl.name}
                      </p>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 20,
                        background: 'rgba(87,157,255,0.15)', color: 'var(--tf-accent)',
                        fontWeight: 600, whiteSpace: 'nowrap',
                      }}>
                        {tmpl.taskBlueprint?.length || 0} tasks
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--tf-text-muted)', margin: 0, lineHeight: 1.5 }}>
                      {tmpl.taskBlueprint?.slice(0, 3).map((bp) => bp.title).join(' · ')}
                      {(tmpl.taskBlueprint?.length || 0) > 3 ? ' …' : ''}
                    </p>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button
                        className="tf-navbar-btn"
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => { setEditingTemplate(tmpl); setShowTemplateEditor(true); }}
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                      <button
                        className="tf-navbar-btn danger"
                        onClick={() => handleDeleteTemplate(tmpl._id)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

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
