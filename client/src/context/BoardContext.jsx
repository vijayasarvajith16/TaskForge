import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getTasks, createTask as apiCreateTask, updateTask as apiUpdateTask, moveTask as apiMoveTask, deleteTask as apiDeleteTask, getBoards } from '../api';
import { getSocket, joinBoard } from '../socket';

const BoardContext = createContext(null);

export function BoardProvider({ boardId, children }) {
  const [board, setBoard] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const tasksRef = useRef(tasks);

  // Keep ref in sync for use in callbacks
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // ── Load board and tasks from REST ──────────────
  const loadData = useCallback(async (workspaceId) => {
    try {
      const boardsRes = await getBoards(workspaceId);
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
  }, [boardId]);

  // ── Set up socket listeners ─────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Join the board room
    joinBoard(boardId);

    // When another client moves a task
    const handleTaskMoved = ({ taskId, columnId, order, task }) => {
      console.log('Socket: task_moved received', taskId);
      setTasks((prev) => prev.map((t) => {
        if (t._id.toString() === taskId) {
          return task || { ...t, columnId, order };
        }
        return t;
      }));
    };

    // When another client updates a task
    const handleTaskUpdated = ({ task }) => {
      console.log('Socket: task_updated received', task._id);
      setTasks((prev) => prev.map((t) =>
        t._id.toString() === task._id.toString() ? task : t
      ));
    };

    // When another client creates a task
    const handleTaskCreated = ({ task }) => {
      console.log('Socket: task_created received', task._id);
      setTasks((prev) => {
        const exists = prev.some((t) => t._id.toString() === task._id.toString());
        if (exists) return prev;
        return [...prev, task];
      });
    };

    // When another client deletes a task
    const handleTaskDeleted = ({ taskId }) => {
      console.log('Socket: task_deleted received', taskId);
      setTasks((prev) => prev.filter((t) => t._id.toString() !== taskId));
    };

    // On reconnect, re-join board room and reload from REST (source of truth)
    const handleConnect = () => {
      console.log('Socket reconnected, re-joining board:', boardId);
      joinBoard(boardId);
      // Reload tasks from REST to reconcile any changes missed during disconnect
      getTasks(boardId).then((res) => setTasks(res.data)).catch(() => {});
    };

    socket.on('task_moved', handleTaskMoved);
    socket.on('task_updated', handleTaskUpdated);
    socket.on('task_created', handleTaskCreated);
    socket.on('task_deleted', handleTaskDeleted);
    socket.on('connect', handleConnect);

    return () => {
      socket.off('task_moved', handleTaskMoved);
      socket.off('task_updated', handleTaskUpdated);
      socket.off('task_created', handleTaskCreated);
      socket.off('task_deleted', handleTaskDeleted);
      socket.off('connect', handleConnect);
    };
  }, [boardId]);

  // ── Task actions ────────────────────────────────

  /**
   * Optimistic move: update local state immediately, then persist via REST.
   * If REST fails, revert. Socket broadcast happens server-side after REST persist.
   */
  const handleMoveTask = useCallback(async (taskId, newColumnId, newOrder) => {
    // Snapshot for rollback
    const snapshot = [...tasksRef.current];

    // Optimistic local update
    setTasks((prev) => prev.map((t) =>
      t._id.toString() === taskId
        ? { ...t, columnId: newColumnId, order: newOrder }
        : t
    ));

    try {
      const res = await apiMoveTask(taskId, { columnId: newColumnId, order: newOrder });
      // Server response is authoritative — reconcile
      setTasks((prev) => prev.map((t) =>
        t._id.toString() === taskId ? res.data : t
      ));
    } catch (err) {
      // Revert on failure
      setTasks(snapshot);
      setError(err.response?.data?.error || 'Failed to move task');
    }
  }, []);

  const handleCreateTask = useCallback(async (data) => {
    try {
      const res = await apiCreateTask({ ...data, boardId });
      // Add locally from REST response (socket broadcast will be de-duped)
      setTasks((prev) => {
        const exists = prev.some((t) => t._id.toString() === res.data._id.toString());
        if (exists) return prev;
        return [...prev, res.data];
      });
      return res.data;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create task');
      throw err;
    }
  }, [boardId]);

  const handleUpdateTask = useCallback(async (taskId, data) => {
    try {
      const res = await apiUpdateTask(taskId, data);
      setTasks((prev) => prev.map((t) =>
        t._id.toString() === taskId.toString() ? res.data : t
      ));
      return res.data;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update task');
      throw err;
    }
  }, []);

  const handleDeleteTask = useCallback(async (taskId) => {
    try {
      await apiDeleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t._id.toString() !== taskId.toString()));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete task');
    }
  }, []);

  return (
    <BoardContext.Provider
      value={{
        board, tasks, loading, error, setError,
        loadData, setBoard,
        moveTask: handleMoveTask,
        createTask: handleCreateTask,
        updateTask: handleUpdateTask,
        deleteTask: handleDeleteTask,
      }}
    >
      {children}
    </BoardContext.Provider>
  );
}

export function useBoard() {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error('useBoard must be used inside BoardProvider');
  return ctx;
}
