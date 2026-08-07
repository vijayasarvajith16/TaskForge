import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext } from '@hello-pangea/dnd';
import { useAuth } from '../context/AuthContext';
import { BoardProvider, useBoard } from '../context/BoardContext';
import Column from './Column';
import TaskForm from './TaskForm';
import DependencyGraph from './DependencyGraph';
import NotificationBell from './NotificationBell';
import TaskDetailDrawer from './TaskDetailDrawer';
import PollsPanel from './PollsPanel';
import { Modal, Spinner, Alert } from 'react-bootstrap';
import {
  ArrowLeft, Plus, LayoutGrid, GitBranch,
  CalendarDays, Copy, RefreshCw, Download, ExternalLink,
  Zap, BarChart3,
} from 'lucide-react';
import { generateCalendarToken, revokeCalendarToken } from '../api';

// ── Helpers ────────────────────────────────────────────────────────────────────
function initials(name) {
  if (!name) return '?';
  const p = name.trim().split(' ');
  return (p[0][0] + (p[1]?.[0] || '')).toUpperCase();
}

// ── CalendarModal ─────────────────────────────────────────────────────────────
function CalendarModal({ show, onHide, board, boardId }) {
  const [calToken, setCalToken] = useState(board?.calendarToken || null);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => setCalToken(board?.calendarToken || null), [board]);

  const feedUrl = calToken
    ? `${window.location.origin}/api/boards/${boardId}/calendar.ics?token=${calToken}`
    : null;

  const handleGenerate = async () => {
    setGenerating(true);
    try { const r = await generateCalendarToken(boardId); setCalToken(r.data.calendarToken); }
    catch { /* ignore */ }
    finally { setGenerating(false); }
  };

  const handleRevoke = async () => {
    setRevoking(true);
    try { await revokeCalendarToken(boardId); setCalToken(null); }
    catch { /* ignore */ }
    finally { setRevoking(false); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal show={show} onHide={onHide} centered contentClassName="bg-dark text-light border-secondary">
      <Modal.Header closeButton closeVariant="white" className="border-secondary">
        <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
          <CalendarDays size={17} style={{ color: 'var(--tf-accent)' }} /> Calendar Export
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {calToken ? (
          <>
            <p style={{ fontSize: 12.5, color: 'var(--tf-text-muted)', marginBottom: 10 }}>
              Subscribe to this live feed in Google Calendar or Apple Calendar.
            </p>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: 6,
              background: 'rgba(255,255,255,0.04)', border: '1px solid var(--tf-border)',
              marginBottom: 12,
            }}>
              <code style={{ flex: 1, fontSize: 11, color: 'var(--tf-accent)', wordBreak: 'break-all' }}>
                {feedUrl}
              </code>
              <button
                className="tf-icon-btn"
                onClick={handleCopy}
                title="Copy"
                style={{ background: copied ? 'rgba(75,206,151,0.15)' : undefined, color: copied ? 'var(--col-done)' : undefined }}
              >
                <Copy size={13} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href={`${feedUrl}&download=true`} target="_blank" rel="noreferrer" className="tf-navbar-btn" style={{ textDecoration: 'none' }}>
                <Download size={12} /> Download .ics
              </a>
              <a href={`webcal://${feedUrl.replace(/^https?:\/\//, '')}`} className="tf-navbar-btn" style={{ textDecoration: 'none' }}>
                <ExternalLink size={12} /> Open in Calendar
              </a>
              <button
                className="tf-navbar-btn danger"
                onClick={handleRevoke}
                disabled={revoking}
                style={{ marginLeft: 'auto' }}
              >
                {revoking ? <Spinner size="sm" className="me-1" /> : <RefreshCw size={12} />} Revoke
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CalendarDays size={36} style={{ color: 'var(--tf-text-muted)', marginBottom: 12 }} />
            <p style={{ fontSize: 13, color: 'var(--tf-text-muted)', marginBottom: 16 }}>
              Generate a secure URL to subscribe to this board's tasks in any calendar app.
            </p>
            <button className="tf-navbar-btn active" onClick={handleGenerate} disabled={generating}
              style={{ margin: '0 auto', display: 'inline-flex', padding: '0 20px', height: 36 }}>
              {generating ? <Spinner size="sm" className="me-1" /> : <CalendarDays size={13} />}
              Generate Feed
            </button>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
}

// ── BoardInner ─────────────────────────────────────────────────────────────────
function BoardInner() {
  const { boardId } = useParams();
  const { user, workspace } = useAuth();
  const navigate = useNavigate();
  const {
    board, tasks, loading, error, setError, socket,
    moveTask, createTask, updateTask, completeTask, deleteTask,
  } = useBoard();

  const [viewMode, setViewMode]       = useState('kanban');
  const [showForm, setShowForm]       = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [defaultColId, setDefaultColId] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [drawerTaskId, setDrawerTaskId] = useState(null);

  const members = workspace?.members || [];
  const canEdit = user?.role === 'head' || user?.role === 'joint_head';

  const handleDragEnd = ({ draggableId, destination, source }) => {
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    const dragged = tasks.find((t) => t._id.toString() === draggableId);
    if (dragged?.status === 'locked') return;
    moveTask(draggableId, destination.droppableId, destination.index);
  };

  const openCreateForm = (colId) => { setEditingTask(null); setDefaultColId(colId); setShowForm(true); };
  const openEditForm   = (task)  => { setEditingTask(task); setDefaultColId(null); setShowForm(true); };

  const handleFormSubmit = async (data) => {
    try {
      if (editingTask) await updateTask(editingTask._id, data);
      else await createTask({ ...data, columnId: data.columnId || defaultColId });
      setShowForm(false); setEditingTask(null);
    } catch { /* handled in context */ }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--tf-bg)' }}>
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  const sortedColumns = board?.columns ? [...board.columns].sort((a, b) => a.order - b.order) : [];

  return (
    <div className="tf-board-wrapper">
      {/* ── Global navbar ── */}
      <div className="tf-navbar">
        {/* Logo */}
        <a onClick={() => navigate('/boards')} className="tf-navbar-brand" style={{ cursor: 'pointer', textDecoration: 'none' }}>
          <img src="/logo.png" alt="" className="brand-logo" />
          <span><span className="tf-brand-blue">Task</span>Forge</span>
        </a>

        {/* Board name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <button className="tf-navbar-btn" onClick={() => navigate('/boards')} style={{ padding: '0 8px' }}>
            <ArrowLeft size={14} />
          </button>
          <h1
            className="tf-board-title"
            style={{ fontSize: 14, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {board?.name || 'Board'}
          </h1>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--col-done)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <span className="live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--col-done)', display: 'inline-block' }} />
            Live
          </span>
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <NotificationBell token={localStorage.getItem('token')} />

          {/* View toggle */}
          <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--tf-border)' }}>
            <button
              className={`tf-navbar-btn ${viewMode === 'kanban' ? 'active' : ''}`}
              onClick={() => setViewMode('kanban')}
              style={{ borderRadius: 0, border: 'none', borderRight: '1px solid var(--tf-border)' }}
            >
              <LayoutGrid size={13} /> Board
            </button>
            <button
              className={`tf-navbar-btn ${viewMode === 'graph' ? 'active' : ''}`}
              onClick={() => setViewMode('graph')}
              style={{ borderRadius: 0, border: 'none' }}
            >
              <GitBranch size={13} /> Graph
            </button>
          </div>

          {canEdit && (
            <button className="tf-navbar-btn" onClick={() => setShowCalendar(true)}>
              <CalendarDays size={13} /> Calendar
            </button>
          )}

          {canEdit && (
            <button
              className="tf-navbar-btn active"
              onClick={() => openCreateForm(board?.columns?.[0]?._id?.toString())}
              style={{ fontWeight: 600 }}
            >
              <Plus size={14} /> Add Card
            </button>
          )}

          {/* User avatar */}
          <OverlayTriggerUser user={user} navigate={navigate} />
        </div>
      </div>

      {error && (
        <Alert variant="danger" className="mx-3 mt-2 py-2 small" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Polls */}
      {viewMode === 'kanban' && (
        <PollsPanel boardId={boardId} userId={user?._id?.toString()} canManage={canEdit} socket={socket} />
      )}

      {/* ── Kanban ── */}
      {viewMode === 'kanban' && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="tf-board-canvas">
            {sortedColumns.map((col) => {
              const colTasks = tasks
                .filter((t) => t.columnId.toString() === col._id.toString())
                .sort((a, b) => a.order - b.order);
              return (
                <Column
                  key={col._id.toString()}
                  column={col}
                  tasks={colTasks}
                  members={members}
                  allTasks={tasks}
                  onAddTask={() => openCreateForm(col._id.toString())}
                  onEditTask={openEditForm}
                  onDeleteTask={deleteTask}
                  onCompleteTask={completeTask}
                  canEdit={canEdit}
                  onTaskClick={setDrawerTaskId}
                />
              );
            })}
          </div>
        </DragDropContext>
      )}

      {/* ── Graph ── */}
      {viewMode === 'graph' && (
        <div style={{ padding: 16 }}>
          <DependencyGraph tasks={tasks} />
        </div>
      )}

      {/* Modals / Drawers */}
      <TaskForm
        show={showForm}
        onHide={() => { setShowForm(false); setEditingTask(null); }}
        onSubmit={handleFormSubmit}
        task={editingTask}
        columns={board?.columns || []}
        members={members}
        allTasks={tasks}
      />
      <TaskDetailDrawer
        show={!!drawerTaskId}
        onHide={() => setDrawerTaskId(null)}
        taskId={drawerTaskId}
        members={members}
        socket={socket}
        boardId={boardId}
      />
      <CalendarModal
        show={showCalendar}
        onHide={() => setShowCalendar(false)}
        board={board}
        boardId={boardId}
      />
    </div>
  );
}

// Small component to keep BoardInner readable
function OverlayTriggerUser({ user, navigate }) {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();
  return (
    <div style={{ position: 'relative' }}>
      <div className="tf-avatar" onClick={() => setOpen(!open)} title={user?.name}>
        {user?.name ? (user.name.trim().split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)) : '?'}
      </div>
      {open && (
        <div
          style={{
            position: 'absolute', right: 0, top: 36, zIndex: 200,
            background: 'var(--tf-col-bg)', border: '1px solid var(--tf-border)',
            borderRadius: 8, boxShadow: 'var(--tf-shadow-md)',
            minWidth: 160, padding: 6, animation: 'dropDown 0.15s ease',
          }}
          onMouseLeave={() => setOpen(false)}
        >
          <div style={{ padding: '6px 10px', fontSize: 12.5, color: 'var(--tf-text-muted)', borderBottom: '1px solid var(--tf-border)', marginBottom: 4 }}>
            <strong style={{ color: 'var(--tf-text-strong)' }}>{user?.name}</strong><br />
            <span style={{ textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ')}</span>
          </div>
          <button className="tf-add-card-btn" style={{ width: '100%', margin: 0, padding: '7px 10px' }} onClick={() => { setOpen(false); navigate('/dashboard'); }}>
            <BarChart3 size={13} /> Dashboard
          </button>
          <button className="tf-add-card-btn" style={{ width: '100%', margin: 0, padding: '7px 10px' }} onClick={() => { setOpen(false); navigate('/workspace'); }}>
            <Zap size={13} /> Workspace
          </button>
          <hr style={{ margin: '4px 0', borderColor: 'var(--tf-border)' }} />
          <button className="tf-add-card-btn" style={{ width: '100%', margin: 0, padding: '7px 10px', color: '#fc8181' }} onClick={logout}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Board() {
  const { boardId } = useParams();
  const { user } = useAuth();
  return (
    <BoardProvider boardId={boardId} workspaceId={user?.workspaceId}>
      <BoardInner />
    </BoardProvider>
  );
}
