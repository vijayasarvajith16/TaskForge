import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext } from '@hello-pangea/dnd';
import { useAuth } from '../context/AuthContext';
import { BoardProvider, useBoard } from '../context/BoardContext';
import Column from './Column';
import TaskForm from './TaskForm';
import DependencyGraph from './DependencyGraph';
import NavActionGroup from './NavActionGroup';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import TaskDetailDrawer from './TaskDetailDrawer';
import PollsPanel from './PollsPanel';
import { Modal, Spinner, Alert } from 'react-bootstrap';
import {
  ArrowLeft, Plus, LayoutGrid, GitBranch,
  CalendarDays, Copy, RefreshCw, Download, ExternalLink,
  BarChart3, Users, LogOut, Check,
} from 'lucide-react';
import { generateCalendarToken, revokeCalendarToken } from '../api';

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
    try {
      const r = await generateCalendarToken(boardId);
      setCalToken(r.data.calendarToken);
    } catch { /* ignore */ }
    finally { setGenerating(false); }
  };

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      await revokeCalendarToken(boardId);
      setCalToken(null);
    } catch { /* ignore */ }
    finally { setRevoking(false); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: 16, fontWeight: 650, color: 'var(--tf-ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarDays size={16} style={{ color: 'var(--tf-accent)' }} /> Calendar Subscription.
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ padding: '20px 24px' }}>
        {calToken ? (
          <>
            <p className="tf-subtitle" style={{ fontSize: 13, marginBottom: 12 }}>
              Subscribe to live automated calendar synchronization across Google Calendar, Apple Calendar, or Outlook.
            </p>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', borderRadius: 'var(--tf-radius-sm)',
              background: 'var(--tf-field)', border: '1px solid transparent',
              marginBottom: 16,
            }}>
              <code className="tf-mono" style={{ flex: 1, fontSize: 11.5, color: 'var(--tf-ink)', wordBreak: 'break-all' }}>
                {feedUrl}
              </code>
              <button
                className="tf-icon-btn"
                onClick={handleCopy}
                title="Copy URL"
                style={{ flexShrink: 0 }}
              >
                {copied ? <Check size={13} style={{ color: 'var(--col-done)' }} /> : <Copy size={13} />}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <a
                href={`${feedUrl}&download=true`}
                target="_blank"
                rel="noreferrer"
                className="btn button-outline"
                style={{ height: 34, fontSize: 12.5, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <Download size={12} /> Download .ics
              </a>
              <a
                href={`webcal://${feedUrl.replace(/^https?:\/\//, '')}`}
                className="btn button-outline"
                style={{ height: 34, fontSize: 12.5, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <ExternalLink size={12} /> Open in Calendar
              </a>
              <button
                className="btn btn-outline-danger"
                onClick={handleRevoke}
                disabled={revoking}
                style={{ marginLeft: 'auto', height: 34, fontSize: 12.5 }}
              >
                {revoking ? <Spinner size="sm" className="me-1" /> : <RefreshCw size={12} style={{ display: 'inline', marginRight: 4 }} />} Revoke Feed
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <CalendarDays size={36} style={{ color: 'var(--tf-text-muted)', marginBottom: 12 }} />
            <p className="tf-subtitle" style={{ fontSize: 13.5, marginBottom: 18 }}>
              Generate a private, tamper-proof URL token to export and synchronize board tasks with calendar software.
            </p>
            <button
              className="btn button-primary"
              onClick={handleGenerate}
              disabled={generating}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {generating ? <Spinner size="sm" /> : <CalendarDays size={13} />}
              Generate Calendar Feed
            </button>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
}

// ── OverlayTriggerUser ────────────────────────────────────────────────────────
function OverlayTriggerUser({ user, navigate }) {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();
  return (
    <div style={{ position: 'relative' }}>
      <div
        className="tf-avatar"
        onClick={() => setOpen(!open)}
        title={user?.name}
      >
        {user?.name ? (user.name.trim().split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)) : '?'}
      </div>
      {open && (
        <div
          className="dropdown-menu show"
          style={{
            position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 1100,
            minWidth: 190,
          }}
          onMouseLeave={() => setOpen(false)}
        >
          <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid var(--tf-hairline-soft)', marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--tf-ink)' }}>{user?.name}</div>
            <div style={{ fontSize: 11, color: 'var(--tf-text-muted)', textTransform: 'capitalize' }}>
              {user?.role?.replace('_', ' ')}
            </div>
          </div>
          <button className="dropdown-item" onClick={() => { setOpen(false); navigate('/dashboard'); }}>
            <BarChart3 size={13} style={{ display: 'inline', marginRight: 6 }} /> Analytics
          </button>
          <button className="dropdown-item" onClick={() => { setOpen(false); navigate('/workspace'); }}>
            <Users size={13} style={{ display: 'inline', marginRight: 6 }} /> Organization
          </button>
          <div style={{ height: 1, background: 'var(--tf-hairline-soft)', margin: '4px 0' }} />
          <button className="dropdown-item" style={{ color: 'var(--col-danger)' }} onClick={logout}>
            <LogOut size={13} style={{ display: 'inline', marginRight: 6 }} /> Sign out
          </button>
        </div>
      )}
    </div>
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--tf-canvas)' }}>
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  const sortedColumns = board?.columns ? [...board.columns].sort((a, b) => a.order - b.order) : [];

  return (
    <div className="tf-board-wrapper">
      {/* ── Mobbin Floating Nav Pill Bar ── */}
      <div className="tf-navbar-wrapper">
        <div className="tf-navbar">
          {/* Logo */}
          <a onClick={() => navigate('/boards')} className="tf-navbar-brand" style={{ cursor: 'pointer', textDecoration: 'none' }}>
            <img src="/logo.png" alt="TaskForge" className="brand-logo" />
            <span><span className="tf-brand-blue">Task</span>Forge</span>
          </a>

          <WorkspaceSwitcher />

          {/* Board Breadcrumb & Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <button className="tf-navbar-btn" onClick={() => navigate('/boards')} style={{ padding: '0 8px' }} title="Back to boards">
              <ArrowLeft size={14} />
            </button>
            <h1
              className="tf-board-title"
              style={{ fontSize: 15, fontWeight: 650, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {board?.name || 'Board'}
            </h1>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--col-done)', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <span className="live-dot" /> Live
            </span>
          </div>

          {/* Right Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <NavActionGroup token={localStorage.getItem('token')} />

            {/* Segmented View Toggle */}
            <div className="segmented-control-track">
              <button
                className={`segmented-control-item ${viewMode === 'kanban' ? 'active' : ''}`}
                onClick={() => setViewMode('kanban')}
              >
                <LayoutGrid size={13} style={{ display: 'inline', marginRight: 4 }} /> Board
              </button>
              <button
                className={`segmented-control-item ${viewMode === 'graph' ? 'active' : ''}`}
                onClick={() => setViewMode('graph')}
              >
                <GitBranch size={13} style={{ display: 'inline', marginRight: 4 }} /> Graph
              </button>
            </div>

            {canEdit && (
              <button className="tf-navbar-btn" onClick={() => setShowCalendar(true)}>
                <CalendarDays size={13} /> Calendar
              </button>
            )}

            {canEdit && (
              <button
                className="btn button-primary"
                onClick={() => openCreateForm(board?.columns?.[0]?._id?.toString())}
                style={{ height: 34, padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <Plus size={14} /> New Issue
              </button>
            )}

            {/* User Avatar Dropdown */}
            <OverlayTriggerUser user={user} navigate={navigate} />
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="danger" className="mx-4 mt-3 py-2.5 px-3 mb-0" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Polls Panel */}
      {viewMode === 'kanban' && (
        <PollsPanel boardId={boardId} userId={user?._id?.toString()} canManage={canEdit} socket={socket} />
      )}

      {/* ── Kanban View ── */}
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

      {/* ── Dependency Graph View ── */}
      {viewMode === 'graph' && (
        <div style={{ padding: 24, maxWidth: 1360, margin: '0 auto', width: '100%' }}>
          <DependencyGraph tasks={tasks} />
        </div>
      )}

      {/* Modals & Drawers */}
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

export default function Board() {
  const { boardId } = useParams();
  const { user } = useAuth();
  return (
    <BoardProvider boardId={boardId} workspaceId={user?.workspaceId}>
      <BoardInner />
    </BoardProvider>
  );
}
