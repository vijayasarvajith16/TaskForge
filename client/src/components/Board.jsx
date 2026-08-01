import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext } from '@hello-pangea/dnd';
import { useAuth } from '../context/AuthContext';
import { BoardProvider, useBoard } from '../context/BoardContext';
import Column from './Column';
import TaskForm from './TaskForm';
import { Button, Spinner, Alert } from 'react-bootstrap';
import { ArrowLeft, Plus } from 'lucide-react';

function BoardInner() {
  const { boardId } = useParams();
  const { user, workspace } = useAuth();
  const navigate = useNavigate();
  const {
    board, tasks, loading, error, setError,
    loadData, moveTask, createTask, updateTask, deleteTask,
  } = useBoard();

  // Task form state
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [defaultColumnId, setDefaultColumnId] = useState(null);

  const members = workspace?.members || [];
  const canEdit = user?.role === 'head' || user?.role === 'joint_head';

  // Initial data load
  useEffect(() => {
    if (user?.workspaceId) {
      loadData(user.workspaceId);
    }
  }, [user, loadData]);

  // ── Drag-and-drop handler ──────────────────────
  const handleDragEnd = (result) => {
    const { draggableId, destination, source } = result;

    // Dropped outside any droppable
    if (!destination) return;

    // Dropped in the same position
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) return;

    // Call the optimistic move in BoardContext
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
    } catch {
      // Error already set in context
    }
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
        {canEdit && (
          <Button variant="primary" size="sm" onClick={() => handleAddTask(board?.columns?.[0]?._id?.toString())}>
            <Plus size={14} className="me-1" /> New Task
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="danger" className="mx-3 mt-2 py-2 small" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Drag-and-drop board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div
          className="d-flex gap-3 p-3"
          style={{ overflowX: 'auto', minHeight: 'calc(100vh - 60px)' }}
        >
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
                onAddTask={() => handleAddTask(col._id.toString())}
                onEditTask={handleEditTask}
                onDeleteTask={deleteTask}
                canEdit={canEdit}
              />
            );
          })}
        </div>
      </DragDropContext>

      {/* Task form modal */}
      <TaskForm
        show={showForm}
        onHide={() => { setShowForm(false); setEditingTask(null); }}
        onSubmit={handleFormSubmit}
        task={editingTask}
        columns={board?.columns || []}
        members={members}
      />
    </div>
  );
}

// Wrapper that provides BoardContext
export default function Board() {
  const { boardId } = useParams();
  return (
    <BoardProvider boardId={boardId}>
      <BoardInner />
    </BoardProvider>
  );
}
