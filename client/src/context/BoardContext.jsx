import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getTasks, createTask as apiCreateTask, updateTask as apiUpdateTask, moveTask as apiMoveTask, completeTask as apiCompleteTask, deleteTask as apiDeleteTask, getBoards } from '../api';
import { getSocket, joinBoard } from '../socket';

const BoardContext = createContext(null);

export function BoardProvider({ boardId, children }) {
  const [board, setBoard] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [socketInstance, setSocketInstance] = useState(null);
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
    setSocketInstance(socket);

    joinBoard(boardId);

    const handleTaskMoved = ({ taskId, columnId, order, task }) => {
      setTasks((prev) => prev.map((t) => {
        if (t._id.toString() === taskId) {
          return task || { ...t, columnId, order };
        }
        return t;
      }));
    };

    const handleTaskUpdated = ({ task }) => {
      setTasks((prev) => prev.map((t) =>
        t._id.toString() === task._id.toString() ? task : t
      ));
    };

    const handleTaskCreated = ({ task }) => {
      setTasks((prev) => {
        const exists = prev.some((t) => t._id.toString() === task._id.toString());
        if (exists) return prev;
        return [...prev, task];
      });
    };

    const handleTaskDeleted = ({ taskId }) => {
      setTasks((prev) => prev.filter((t) => t._id.toString() !== taskId));
    };

    // Phase 3: tasks_unlocked — update status for newly unlocked tasks
    const handleTasksUnlocked = ({ taskIds, tasks: unlockedTasks }) => {
      console.log('Socket: tasks_unlocked received', taskIds);
      if (unlockedTasks && unlockedTasks.length > 0) {
        // Replace with full task data from server
        setTasks((prev) => prev.map((t) => {
          const updated = unlockedTasks.find((u) => u._id.toString() === t._id.toString());
          return updated || t;
        }));
      } else {
        // Fallback: just flip status from locked to open
        setTasks((prev) => prev.map((t) =>
          taskIds.includes(t._id.toString())
            ? { ...t, status: 'open' }
            : t
        ));
      }
    };

    const handleConnect = () => {
      joinBoard(boardId);
      getTasks(boardId).then((res) => setTasks(res.data)).catch(() => {});
    };

    socket.on('task_moved', handleTaskMoved);
    socket.on('task_updated', handleTaskUpdated);
    socket.on('task_created', handleTaskCreated);
    socket.on('task_deleted', handleTaskDeleted);
    socket.on('tasks_unlocked', handleTasksUnlocked);
    socket.on('connect', handleConnect);

    return () => {
      socket.off('task_moved', handleTaskMoved);
      socket.off('task_updated', handleTaskUpdated);
      socket.off('task_created', handleTaskCreated);
      socket.off('task_deleted', handleTaskDeleted);
      socket.off('tasks_unlocked', handleTasksUnlocked);
      socket.off('connect', handleConnect);
    };
  }, [boardId]);

  // ── Task actions ────────────────────────────────

  const handleMoveTask = useCallback(async (taskId, newColumnId, newOrder) => {
    const snapshot = [...tasksRef.current];

    setTasks((prev) => prev.map((t) =>
      t._id.toString() === taskId
        ? { ...t, columnId: newColumnId, order: newOrder }
        : t
    ));

    try {
      const res = await apiMoveTask(taskId, { columnId: newColumnId, order: newOrder });
      setTasks((prev) => prev.map((t) =>
        t._id.toString() === taskId ? res.data : t
      ));
    } catch (err) {
      setTasks(snapshot);
      setError(err.response?.data?.error || 'Failed to move task');
    }
  }, []);

  const handleCreateTask = useCallback(async (data) => {
    try {
      const res = await apiCreateTask({ ...data, boardId });
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

  // Phase 3: Complete a task and unlock dependents
  const handleCompleteTask = useCallback(async (taskId) => {
    try {
      const res = await apiCompleteTask(taskId);
      // Update the completed task
      setTasks((prev) => prev.map((t) =>
        t._id.toString() === res.data.task._id.toString() ? res.data.task : t
      ));
      // Also update any unlocked tasks (REST response has the IDs, socket has full data)
      // The socket event will handle updating the unlocked tasks for this and all other clients
      return res.data;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to complete task');
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
        board, tasks, loading, error, setError, socket: socketInstance,
        loadData, setBoard,
        moveTask: handleMoveTask,
        createTask: handleCreateTask,
        updateTask: handleUpdateTask,
        completeTask: handleCompleteTask,
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
