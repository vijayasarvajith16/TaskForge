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
import { Button, Spinner, Alert, ButtonGroup, Modal } from 'react-bootstrap';
import { ArrowLeft, Plus, LayoutGrid, GitBranch, CalendarDays, Copy, RefreshCw, Download, ExternalLink } from 'lucide-react';
import { generateCalendarToken, revokeCalendarToken } from '../api';

// ── CalendarModal ─────────────────────────────────────────────────────────────
function CalendarModal({ show, onHide, board, boardId, onTokenChange }) {
  const [calToken, setCalToken] = useState(board?.calendarToken || null);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCalToken(board?.calendarToken || null);
  }, [board]);

  const feedUrl = calToken
    ? `${window.location.origin}/api/boards/${boardId}/calendar.ics?token=${calToken}`
    : null;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await generateCalendarToken(boardId);
      setCalToken(res.data.calendarToken);
      onTokenChange?.(res.data.calendarToken);
    } catch (err) {
      console.error('Generate token error', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      await revokeCalendarToken(boardId);
      setCalToken(null);
      onTokenChange?.(null);
    } catch (err) {
      console.error('Revoke token error', err);
    } finally {
      setRevoking(false);
    }
  };

  const handleCopy = () => {
    if (!feedUrl) return;
    navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal show={show} onHide={onHide} centered contentClassName="bg-dark text-light border-secondary">
      <Modal.Header closeButton closeVariant="white" className="border-secondary">
        <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
          <CalendarDays size={18} className="text-primary" /> Calendar Export
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {calToken ? (
          <>
            <p className="small text-secondary mb-2">
              Subscribe to this live feed in Google Calendar or Apple Calendar — it updates automatically as tasks change.
            </p>

            {/* Feed URL */}
            <div
              className="d-flex align-items-center gap-2 p-2 rounded mb-3"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <code className="flex-grow-1 text-info" style={{ fontSize: '0.7rem', wordBreak: 'break-all' }}>
                {feedUrl}
              </code>
              <Button
                variant={copied ? 'success' : 'outline-secondary'}
                size="sm"
                onClick={handleCopy}
                title="Copy URL"
                style={{ flexShrink: 0 }}
              >
                <Copy size={12} />
              </Button>
            </div>

            {/* Instructions */}
            <div className="mb-3 p-2 rounded" style={{ backgroundColor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <p className="small mb-1 fw-semibold text-primary">How to subscribe:</p>
              <ol className="small text-secondary mb-0 ps-3" style={{ lineHeight: 1.8 }}>
                <li>Copy the URL above</li>
                <li><strong className="text-light">Google Calendar</strong>: Other calendars → "From URL" → paste</li>
                <li><strong className="text-light">Apple Calendar</strong>: File → New Calendar Subscription → paste</li>
                <li><strong className="text-light">Outlook</strong>: Add calendar → From internet → paste</li>
              </ol>
            </div>

            {/* Actions */}
            <div className="d-flex gap-2 flex-wrap">
              <a
                href={`${feedUrl}&download=true`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline-secondary btn-sm"
              >
                <Download size={12} className="me-1" /> Download .ics
              </a>
              <a
                href={`webcal://${feedUrl.replace(/^https?:\/\//, '')}`}
                className="btn btn-outline-info btn-sm"
              >
                <ExternalLink size={12} className="me-1" /> Open in Calendar App
              </a>
              <Button
                variant="outline-danger"
                size="sm"
                onClick={handleRevoke}
                disabled={revoking}
                className="ms-auto"
                title="Revoke this URL and generate a new token"
              >
                {revoking ? <Spinner size="sm" className="me-1" /> : <RefreshCw size={12} className="me-1" />}
                Revoke & Regenerate
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-3">
            <CalendarDays size={40} className="text-secondary mb-3" />
            <p className="text-secondary small mb-3">
              Generate a secure feed URL to subscribe to this board's tasks in any calendar app.
            </p>
            <Button variant="primary" onClick={handleGenerate} disabled={generating}>
              {generating ? <><Spinner size="sm" className="me-1" />Generating…</> : 'Generate Calendar Feed'}
            </Button>
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

  const [viewMode, setViewMode] = useState('kanban');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [defaultColumnId, setDefaultColumnId] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);

  // Task detail drawer
  const [drawerTaskId, setDrawerTaskId] = useState(null);

  const members = workspace?.members || [];
  const canEdit = user?.role === 'head' || user?.role === 'joint_head';

  const handleDragEnd = (result) => {
    const { draggableId, destination, source } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    const draggedTask = tasks.find((t) => t._id.toString() === draggableId);
    if (draggedTask?.status === 'locked') return;
    moveTask(draggableId, destination.droppableId, destination.index);
  };

  const handleAddTask = (columnId) => {
    setEditingTask(null);
    setDefaultColumnId(columnId);
    setShowForm(true);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setDefaultColumnId(null);
    setShowForm(true);
  };

  const handleFormSubmit = async (data) => {
    try {
      if (editingTask) {
        await updateTask(editingTask._id, data);
      } else {
        await createTask({ ...data, columnId: data.columnId || defaultColumnId });
      }
      setShowForm(false);
      setEditingTask(null);
    } catch { /* Error already set in context */ }
  };

  const handleTaskClick = (taskId) => {
    setDrawerTaskId(taskId);
  };

  if (loading) {
    return (
      <div className="min-vh-100 bg-dark d-flex align-items-center justify-content-center">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  const sortedColumns = board?.columns ? [...board.columns].sort((a, b) => a.order - b.order) : [];

  return (
    <div className="min-vh-100 bg-dark text-light">
      {/* Board header */}
      <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom border-secondary">
        <div className="d-flex align-items-center gap-2">
          <Button variant="link" className="text-secondary p-0" onClick={() => navigate('/boards')}>
            <ArrowLeft size={18} />
          </Button>
          <h5 className="mb-0 fw-bold">{board?.name || 'Board'}</h5>
          <span className="badge bg-success bg-opacity-25 text-success" style={{ fontSize: '0.65rem' }}>
            ● Live
          </span>
        </div>
        <div className="d-flex align-items-center gap-2">
          <NotificationBell token={localStorage.getItem('token')} />
          {canEdit && (
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => setShowCalendar(true)}
              title="Calendar Export"
            >
              <CalendarDays size={14} className="me-1" /> Calendar
            </Button>
          )}
          <ButtonGroup size="sm">
            <Button
              variant={viewMode === 'kanban' ? 'primary' : 'outline-secondary'}
              onClick={() => setViewMode('kanban')} title="Kanban View"
            >
              <LayoutGrid size={14} className="me-1" /> Kanban
            </Button>
            <Button
              variant={viewMode === 'graph' ? 'primary' : 'outline-secondary'}
              onClick={() => setViewMode('graph')} title="Dependency Graph"
            >
              <GitBranch size={14} className="me-1" /> Graph
            </Button>
          </ButtonGroup>
          {canEdit && (
            <Button variant="primary" size="sm" onClick={() => handleAddTask(board?.columns?.[0]?._id?.toString())}>
              <Plus size={14} className="me-1" /> New Task
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="danger" className="mx-3 mt-2 py-2 small" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Polls at the top of the board */}
      {viewMode === 'kanban' && (
        <PollsPanel
          boardId={boardId}
          userId={user?._id?.toString()}
          canManage={canEdit}
          socket={socket}
        />
      )}

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="d-flex gap-4 p-4" style={{ overflowX: 'auto', minHeight: 'calc(100vh - 120px)' }}>
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
                  onAddTask={() => handleAddTask(col._id.toString())}
                  onEditTask={handleEditTask}
                  onDeleteTask={deleteTask}
                  onCompleteTask={completeTask}
                  canEdit={canEdit}
                  onTaskClick={handleTaskClick}
                />
              );
            })}
          </div>
        </DragDropContext>
      )}

      {/* Dependency Graph View */}
      {viewMode === 'graph' && (
        <div className="p-3">
          <DependencyGraph tasks={tasks} />
        </div>
      )}

      {/* Task form modal */}
      <TaskForm
        show={showForm}
        onHide={() => { setShowForm(false); setEditingTask(null); }}
        onSubmit={handleFormSubmit}
        task={editingTask}
        columns={board?.columns || []}
        members={members}
        allTasks={tasks}
      />

      {/* Task detail drawer */}
      <TaskDetailDrawer
        show={!!drawerTaskId}
        onHide={() => setDrawerTaskId(null)}
        taskId={drawerTaskId}
        members={members}
        socket={socket}
        boardId={boardId}
      />

      {/* Calendar export modal */}
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
