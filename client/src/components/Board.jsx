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
import { Button, Spinner, Alert, ButtonGroup } from 'react-bootstrap';
import { ArrowLeft, Plus, LayoutGrid, GitBranch } from 'lucide-react';

function BoardInner() {
  const { boardId } = useParams();
  const { user, workspace } = useAuth();
  const navigate = useNavigate();
  const {
    board, tasks, loading, error, setError, socket,
    loadData, moveTask, createTask, updateTask, completeTask, deleteTask,
  } = useBoard();

  const [viewMode, setViewMode] = useState('kanban');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [defaultColumnId, setDefaultColumnId] = useState(null);

  // Task detail drawer
  const [drawerTaskId, setDrawerTaskId] = useState(null);

  const members = workspace?.members || [];
  const canEdit = user?.role === 'head' || user?.role === 'joint_head';

  useEffect(() => {
    if (user?.workspaceId) {
      loadData(user.workspaceId);
    }
  }, [user, loadData]);

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
    </div>
  );
}

export default function Board() {
  const { boardId } = useParams();
  return (
    <BoardProvider boardId={boardId}>
      <BoardInner />
    </BoardProvider>
  );
}
