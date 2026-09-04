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
import NavActionGroup from '../components/NavActionGroup';
import WorkspaceSwitcher from '../components/WorkspaceSwitcher';
import { Spinner, Alert } from 'react-bootstrap';
import {
  LayoutDashboard, Plus, Trash2, Users, FileText,
  Edit2, Copy, BarChart3, Calendar, ChevronRight,
  FolderGit2, Sparkles, CheckCircle2,
} from 'lucide-react';

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
  }, [user?.workspaceId]);

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
    if (!window.confirm('Delete this board and all its tasks?')) return;
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
    if (!window.confirm('Delete this template?')) return;
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
    <div style={{ minHeight: '100vh', background: 'var(--tf-canvas)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Mobbin Floating Nav Pill Bar ── */}
      <div className="tf-navbar-wrapper">
        <div className="tf-navbar">
          <a className="tf-navbar-brand" style={{ cursor: 'default' }}>
            <img src="/logo.png" alt="TaskForge" className="brand-logo" />
            <span><span className="tf-brand-blue">Task</span>Forge</span>
          </a>

          <WorkspaceSwitcher />

          {/* Tab Segmented Control */}
          <div className="segmented-control-track">
            <button
              className={`segmented-control-item ${activeTab === 'boards' ? 'active' : ''}`}
              onClick={() => setActiveTab('boards')}
            >
              <LayoutDashboard size={13} style={{ display: 'inline', marginRight: 5 }} /> Boards
            </button>
            {canManage && (
              <button
                className={`segmented-control-item ${activeTab === 'templates' ? 'active' : ''}`}
                onClick={() => setActiveTab('templates')}
              >
                <FileText size={13} style={{ display: 'inline', marginRight: 5 }} /> Templates
              </button>
            )}
          </div>

          <div style={{ flex: 1 }} />

          {/* Right Navigation Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button className="tf-navbar-btn" onClick={() => navigate('/dashboard')}>
              <BarChart3 size={14} /> Analytics
            </button>
            <button className="tf-navbar-btn" onClick={() => navigate('/workspace')}>
              <Users size={14} /> Organization
            </button>
            <NavActionGroup token={localStorage.getItem('token')} />
            <div
              className="tf-avatar"
              title={`${user?.name} • ${user?.role?.replace('_', ' ')}`}
              onClick={logout}
            >
              {user?.name ? initials(user.name) : '?'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div style={{ flex: 1, padding: '28px 32px', maxWidth: 1280, margin: '0 auto', width: '100%' }}>
        {error && (
          <Alert variant="danger" className="py-2.5 px-3 mb-4" dismissible onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* ══ BOARDS VIEW ═════════════════════════════════════════════════════ */}
        {activeTab === 'boards' && (
          <>
            {/* Formal IT Header Lockup */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div className="tf-eyebrow">Enterprise Engineering</div>
                <h1 style={{ fontSize: 26, fontWeight: 650, color: 'var(--tf-ink)', margin: 0 }}>
                  Active Boards.
                </h1>
                <p className="tf-subtitle" style={{ fontSize: 14, margin: '4px 0 0' }}>
                  Project workflows, sprint cycles, and issue trackers for {workspace?.name || 'your workspace'}.
                </p>
              </div>

              {canManage && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {templates.length > 0 && (
                    <button
                      className="btn button-outline"
                      onClick={() => setShowFromTemplate(true)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Copy size={13} /> From Blueprint
                    </button>
                  )}
                  <button
                    className="btn button-primary"
                    onClick={() => setShowCreate(!showCreate)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Plus size={14} /> New Board
                  </button>
                </div>
              )}
            </div>

            {/* Inline Create Board Surface */}
            {showCreate && (
              <div style={{
                background: 'var(--tf-canvas-soft)',
                border: '1px solid var(--tf-hairline)',
                borderRadius: 'var(--tf-radius-md)',
                padding: '20px 24px',
                marginBottom: 24,
                maxWidth: 460,
                animation: 'modalUp 0.15s ease',
              }}>
                <div className="tf-eyebrow">New Project</div>
                <h3 style={{ fontSize: 16, fontWeight: 650, color: 'var(--tf-ink)', marginBottom: 12 }}>
                  Create Engineering Board.
                </h3>
                <form onSubmit={handleCreateBoard}>
                  <input
                    type="text"
                    className="form-control"
                    value={boardName}
                    onChange={(e) => setBoardName(e.target.value)}
                    placeholder="e.g. Infrastructure Sprint 24.2"
                    required
                    autoFocus
                    style={{ marginBottom: 14 }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" className="btn button-primary" style={{ height: 36, padding: '0 18px' }}>
                      Initialize Board
                    </button>
                    <button
                      type="button"
                      className="btn button-outline"
                      onClick={() => { setShowCreate(false); setBoardName(''); }}
                      style={{ height: 36, padding: '0 16px' }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Board Grid */}
            {loading ? (
              <div style={{ textAlign: 'center', paddingTop: 80 }}>
                <Spinner animation="border" variant="primary" />
              </div>
            ) : boards.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '64px 20px',
                background: 'var(--tf-canvas-soft)',
                borderRadius: 'var(--tf-radius-md)',
                border: '1px dashed var(--tf-hairline)',
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '30%',
                  background: 'var(--tf-canvas)',
                  border: '1px solid var(--tf-hairline)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                }}>
                  <LayoutDashboard size={22} style={{ color: 'var(--tf-text-muted)' }} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 650, color: 'var(--tf-ink)', marginBottom: 6 }}>
                  No active boards found.
                </h3>
                <p style={{ color: 'var(--tf-text-muted)', fontSize: 13.5, maxWidth: 380, margin: '0 auto 18px' }}>
                  {canManage
                    ? 'Get started by initializing a new kanban board or deploying a sprint blueprint.'
                    : 'Your workspace managers have not created any boards yet.'}
                </p>
                {canManage && (
                  <button
                    className="btn button-primary"
                    onClick={() => setShowCreate(true)}
                  >
                    <Plus size={14} style={{ display: 'inline', marginRight: 4 }} /> Create First Board
                  </button>
                )}
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 16,
              }}>
                {boards.map((board) => {
                  const columnCount = board.columns?.length || 0;
                  const totalTasks = board.columns?.reduce((acc, c) => acc + (c.taskCount || 0), 0) || 0;

                  return (
                    <div
                      key={board._id.toString()}
                      className="tf-board-card"
                      onClick={() => navigate(`/board/${board._id}`)}
                    >
                      {/* Tech Spec Cover */}
                      <div className="tf-board-card-cover">
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                        }}>
                          <span
                            className="tf-mono"
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: 'var(--tf-text-muted)',
                              background: 'var(--tf-canvas)',
                              padding: '2px 8px',
                              borderRadius: 'var(--tf-radius-full)',
                              border: '1px solid var(--tf-hairline-soft)',
                            }}
                          >
                            TF-BOARD
                          </span>

                          {board.eventDate && (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                background: 'var(--tf-canvas)',
                                padding: '2px 9px',
                                borderRadius: 'var(--tf-radius-full)',
                                color: 'var(--tf-ink)',
                                border: '1px solid var(--tf-hairline-soft)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <Calendar size={10} />
                              {new Date(board.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="tf-board-card-body">
                        <h4 className="tf-board-card-title">{board.name}</h4>

                        {/* Column Pipeline Chips */}
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
                          {board.columns?.slice(0, 4).map((c) => (
                            <span
                              key={c._id.toString()}
                              style={{
                                fontSize: 10.5,
                                padding: '2px 7px',
                                borderRadius: 'var(--tf-radius-full)',
                                background: 'var(--tf-canvas-soft)',
                                color: 'var(--tf-text-muted)',
                                fontWeight: 500,
                                border: '1px solid var(--tf-hairline-soft)',
                              }}
                            >
                              {c.name}
                            </span>
                          ))}
                        </div>

                        {/* Metadata Footer */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingTop: 10,
                          borderTop: '1px solid var(--tf-hairline-soft)',
                        }}>
                          <span className="tf-mono" style={{ fontSize: 11, color: 'var(--tf-text-faint)' }}>
                            {new Date(board.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>

                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {canManage && (
                              <button
                                className="tf-icon-btn delete"
                                onClick={(e) => { e.stopPropagation(); handleDeleteBoard(board._id); }}
                                title="Delete board"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                            <ChevronRight size={14} style={{ color: 'var(--tf-text-muted)' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ══ TEMPLATES VIEW ══════════════════════════════════════════════════ */}
        {activeTab === 'templates' && canManage && (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div className="tf-eyebrow">Reusable Architecture</div>
                <h1 style={{ fontSize: 26, fontWeight: 650, color: 'var(--tf-ink)', margin: 0 }}>
                  Sprint Blueprints.
                </h1>
                <p className="tf-subtitle" style={{ fontSize: 14, margin: '4px 0 0' }}>
                  Standardize workflow pipelines, deployment sequences, and incident response procedures.
                </p>
              </div>

              <button
                className="btn button-primary"
                onClick={() => { setEditingTemplate(null); setShowTemplateEditor(true); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={14} /> New Blueprint
              </button>
            </div>

            {templates.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '64px 20px',
                background: 'var(--tf-canvas-soft)',
                borderRadius: 'var(--tf-radius-md)',
                border: '1px dashed var(--tf-hairline)',
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '30%',
                  background: 'var(--tf-canvas)',
                  border: '1px solid var(--tf-hairline)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                }}>
                  <FileText size={22} style={{ color: 'var(--tf-text-muted)' }} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 650, color: 'var(--tf-ink)', marginBottom: 6 }}>
                  No blueprint templates configured.
                </h3>
                <p style={{ color: 'var(--tf-text-muted)', fontSize: 13.5, maxWidth: 380, margin: '0 auto 18px' }}>
                  Create reusable project blueprints to scaffold tasks, dependencies, and stages in seconds.
                </p>
                <button
                  className="btn button-primary"
                  onClick={() => { setEditingTemplate(null); setShowTemplateEditor(true); }}
                >
                  <Plus size={14} style={{ display: 'inline', marginRight: 4 }} /> Create First Blueprint
                </button>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: 16,
              }}>
                {templates.map((tmpl) => (
                  <div
                    key={tmpl._id.toString()}
                    style={{
                      background: 'var(--tf-canvas)',
                      border: '1px solid var(--tf-hairline)',
                      borderRadius: 'var(--tf-radius-md)',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'var(--tf-transition)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                        <h4 style={{ fontSize: 16, fontWeight: 650, color: 'var(--tf-ink)', margin: 0 }}>
                          {tmpl.name}
                        </h4>
                        <span className="tf-badge-popular">
                          {tmpl.taskBlueprint?.length || 0} tasks
                        </span>
                      </div>

                      <p style={{ fontSize: 13, color: 'var(--tf-text-muted)', margin: '0 0 16px', lineHeight: 1.45 }}>
                        {tmpl.taskBlueprint?.slice(0, 3).map((bp) => bp.title).join(' · ')}
                        {(tmpl.taskBlueprint?.length || 0) > 3 ? ' …' : ''}
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: 8, paddingTop: 14, borderTop: '1px solid var(--tf-hairline-soft)' }}>
                      <button
                        className="btn button-outline"
                        style={{ flex: 1, height: 32, fontSize: 12.5 }}
                        onClick={() => { setEditingTemplate(tmpl); setShowTemplateEditor(true); }}
                      >
                        <Edit2 size={12} style={{ display: 'inline', marginRight: 4 }} /> Edit Blueprint
                      </button>
                      <button
                        className="tf-icon-btn delete"
                        style={{ width: 32, height: 32 }}
                        onClick={() => handleDeleteTemplate(tmpl._id)}
                        title="Delete blueprint"
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
