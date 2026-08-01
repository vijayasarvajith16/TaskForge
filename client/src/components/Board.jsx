import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getTasks, createTask, updateTask, deleteTask, getBoards } from '../api';
import Column from './Column';
import TaskForm from './TaskForm';
import { Button, Spinner, Alert } from 'react-bootstrap';
import { ArrowLeft, Plus } from 'lucide-react';

export default function Board() {
  const { boardId } = useParams();
  const { user, workspace } = useAuth();
  const navigate = useNavigate();

  const [board, setBoard] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Task form state
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [defaultColumnId, setDefaultColumnId] = useState(null);

  const members = workspace?.members || [];
  const canEdit = user?.role === 'head' || user?.role === 'joint_head';

  const loadData = useCallback(async () => {
    try {
      const boardsRes = await getBoards(user.workspaceId);
      const found = boardsRes.data.find((b) => b._id.toString() === boardId);
      if (!found) {
        setError('Board not found');
        setLoading(false);
        return;
      }
      setBoard(found);

      const tasksRes = await getTasks(boardId);
      setTasks(tasksRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load board');
    } finally {
      setLoading(false);
    }
  }, [boardId, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const handleDeleteTask = async (taskId) => {
    try {
      await deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t._id.toString() !== taskId.toString()));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete task');
    }
  };

  const handleMoveTask = async (taskId, newColumnId) => {
    try {
      const res = await updateTask(taskId, { columnId: newColumnId });
      setTasks((prev) => prev.map((t) => (t._id.toString() === taskId.toString() ? res.data : t)));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to move task');
    }
  };

  const handleFormSubmit = async (data) => {
    try {
      if (editingTask) {
        const res = await updateTask(editingTask._id, data);
        setTasks((prev) => prev.map((t) => (t._id.toString() === editingTask._id.toString() ? res.data : t)));
      } else {
        const res = await createTask({ ...data, boardId, columnId: data.columnId || defaultColumnId });
        setTasks((prev) => [...prev, res.data]);
      }
      setShowForm(false);
      setEditingTask(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save task');
    }
  };

  const canEditTask = (task) => {
    if (user.role === 'head' || user.role === 'joint_head') return true;
    return task.assignedTo?.toString() === user._id.toString();
  };

  if (loading) {
    return (
      <div className="min-vh-100 bg-dark d-flex align-items-center justify-content-center">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  return (
    <div className="min-vh-100 bg-dark text-light">
      {/* Board header */}
      <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom border-secondary">
        <div className="d-flex align-items-center gap-2">
          <Button variant="link" className="text-secondary p-0" onClick={() => navigate('/boards')}>
            <ArrowLeft size={18} />
          </Button>
          <h5 className="mb-0 fw-bold">{board?.name || 'Board'}</h5>
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

      {/* Columns */}
      <div
        className="d-flex gap-3 p-3"
        style={{ overflowX: 'auto', minHeight: 'calc(100vh - 60px)' }}
      >
        {board?.columns
          ?.sort((a, b) => a.order - b.order)
          .map((col) => {
            const colTasks = tasks
              .filter((t) => t.columnId.toString() === col._id.toString())
              .sort((a, b) => a.order - b.order);

            return (
              <Column
                key={col._id.toString()}
                column={col}
                tasks={colTasks}
                members={members}
                allColumns={board.columns}
                onAddTask={() => handleAddTask(col._id.toString())}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
                onMoveTask={handleMoveTask}
                canEdit={canEdit}
              />
            );
          })}
      </div>

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
