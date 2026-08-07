import { createContext, useContext, useState, useEffect } from 'react';
import { getSocket, joinBoard } from '../socket';
import { useBoardQuery } from '../hooks/useBoardQuery';

const BoardContext = createContext(null);

export function BoardProvider({ boardId, workspaceId, children }) {
  const [socketInstance, setSocketInstance] = useState(null);
  const [error, setError] = useState('');

  const {
    board,
    tasks,
    isLoading: loading,
    error: queryError,
    moveTask,
    createTask,
    updateTask,
    completeTask,
    deleteTask,
    socketHandlers,
  } = useBoardQuery({ boardId, workspaceId });

  // Surface React Query errors through the same error state
  useEffect(() => {
    if (queryError) setError(queryError);
  }, [queryError]);

  // ── Set up socket listeners ─────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    setSocketInstance(socket);

    joinBoard(boardId);

    const handleTaskMoved = (payload) => socketHandlers.onTaskMoved(payload);
    const handleTaskUpdated = (payload) => socketHandlers.onTaskUpdated(payload);
    const handleTaskCreated = (payload) => socketHandlers.onTaskCreated(payload);
    const handleTaskDeleted = (payload) => socketHandlers.onTaskDeleted(payload);
    const handleTasksUnlocked = (payload) => socketHandlers.onTasksUnlocked(payload);
    const handleConnect = () => {
      joinBoard(boardId);
      socketHandlers.onReconnect();
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

  // ── Wrappers that set local error on failure ────
  const handleMoveTask = async (taskId, newColumnId, newOrder) => {
    try {
      await moveTask(taskId, newColumnId, newOrder);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to move task');
    }
  };

  const handleCreateTask = async (data) => {
    try {
      return await createTask(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create task');
      throw err;
    }
  };

  const handleUpdateTask = async (taskId, data) => {
    try {
      return await updateTask(taskId, data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update task');
      throw err;
    }
  };

  const handleCompleteTask = async (taskId) => {
    try {
      return await completeTask(taskId);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to complete task');
      throw err;
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await deleteTask(taskId);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete task');
    }
  };

  // loadData is kept for API compatibility but is now a no-op —
  // React Query handles loading on mount automatically.
  const loadData = () => {};

  return (
    <BoardContext.Provider
      value={{
        board, tasks, loading, error, setError, socket: socketInstance,
        loadData, setBoard: () => {},
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
