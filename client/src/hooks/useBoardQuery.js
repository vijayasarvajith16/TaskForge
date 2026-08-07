import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTasks,
  getBoards,
  createTask as apiCreateTask,
  updateTask as apiUpdateTask,
  moveTask as apiMoveTask,
  completeTask as apiCompleteTask,
  deleteTask as apiDeleteTask,
} from '../api';

// ─── Query key factories ────────────────────────────────────────────────────
export const boardKeys = {
  board: (workspaceId, boardId) => ['board', workspaceId, boardId],
  tasks: (boardId) => ['tasks', boardId],
};

// ─── Main hook ──────────────────────────────────────────────────────────────
export function useBoardQuery({ boardId, workspaceId }) {
  const queryClient = useQueryClient();

  // ── Board metadata ─────────────────────────────
  const boardQuery = useQuery({
    queryKey: boardKeys.board(workspaceId, boardId),
    queryFn: async () => {
      const res = await getBoards(workspaceId);
      const found = res.data.find((b) => b._id.toString() === boardId);
      if (!found) throw new Error('Board not found');
      return found;
    },
    enabled: !!workspaceId && !!boardId,
    staleTime: 5 * 60 * 1000, // board columns rarely change
  });

  // ── Tasks ──────────────────────────────────────
  const tasksQuery = useQuery({
    queryKey: boardKeys.tasks(boardId),
    queryFn: async () => {
      const res = await getTasks(boardId);
      return res.data;
    },
    enabled: !!boardId,
    staleTime: 0,
  });

  // ── moveTask (optimistic) ──────────────────────
  const moveTaskMutation = useMutation({
    mutationFn: ({ taskId, columnId, order }) =>
      apiMoveTask(taskId, { columnId, order }),

    onMutate: async ({ taskId, columnId, order }) => {
      await queryClient.cancelQueries({ queryKey: boardKeys.tasks(boardId) });
      const snapshot = queryClient.getQueryData(boardKeys.tasks(boardId));
      queryClient.setQueryData(boardKeys.tasks(boardId), (prev = []) =>
        prev.map((t) =>
          t._id.toString() === taskId ? { ...t, columnId, order } : t
        )
      );
      return { snapshot };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) {
        queryClient.setQueryData(boardKeys.tasks(boardId), ctx.snapshot);
      }
    },

    onSuccess: (res, { taskId }) => {
      // Settle with server-confirmed data
      queryClient.setQueryData(boardKeys.tasks(boardId), (prev = []) =>
        prev.map((t) => (t._id.toString() === taskId ? res.data : t))
      );
    },
  });

  // ── createTask (optimistic) ────────────────────
  const createTaskMutation = useMutation({
    mutationFn: (data) => apiCreateTask(data),

    onSuccess: (res) => {
      queryClient.setQueryData(boardKeys.tasks(boardId), (prev = []) => {
        const exists = prev.some((t) => t._id.toString() === res.data._id.toString());
        return exists ? prev : [...prev, res.data];
      });
    },
  });

  // ── updateTask (optimistic) ────────────────────
  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, data }) => apiUpdateTask(taskId, data),

    onMutate: async ({ taskId, data }) => {
      await queryClient.cancelQueries({ queryKey: boardKeys.tasks(boardId) });
      const snapshot = queryClient.getQueryData(boardKeys.tasks(boardId));
      queryClient.setQueryData(boardKeys.tasks(boardId), (prev = []) =>
        prev.map((t) =>
          t._id.toString() === taskId ? { ...t, ...data } : t
        )
      );
      return { snapshot };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) {
        queryClient.setQueryData(boardKeys.tasks(boardId), ctx.snapshot);
      }
    },

    onSuccess: (res, { taskId }) => {
      queryClient.setQueryData(boardKeys.tasks(boardId), (prev = []) =>
        prev.map((t) => (t._id.toString() === taskId ? res.data : t))
      );
    },
  });

  // ── completeTask ───────────────────────────────
  const completeTaskMutation = useMutation({
    mutationFn: (taskId) => apiCompleteTask(taskId),

    onSuccess: (res) => {
      queryClient.setQueryData(boardKeys.tasks(boardId), (prev = []) =>
        prev.map((t) =>
          t._id.toString() === res.data.task._id.toString() ? res.data.task : t
        )
      );
    },
  });

  // ── deleteTask (optimistic) ────────────────────
  const deleteTaskMutation = useMutation({
    mutationFn: (taskId) => apiDeleteTask(taskId),

    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: boardKeys.tasks(boardId) });
      const snapshot = queryClient.getQueryData(boardKeys.tasks(boardId));
      queryClient.setQueryData(boardKeys.tasks(boardId), (prev = []) =>
        prev.filter((t) => t._id.toString() !== taskId.toString())
      );
      return { snapshot };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) {
        queryClient.setQueryData(boardKeys.tasks(boardId), ctx.snapshot);
      }
    },
  });

  // ── Socket helpers (called by BoardContext socket listeners) ──────────────
  const socketHandlers = {
    onTaskMoved: ({ taskId, columnId, order, task }) => {
      queryClient.setQueryData(boardKeys.tasks(boardId), (prev = []) =>
        prev.map((t) => {
          if (t._id.toString() === taskId) {
            return task || { ...t, columnId, order };
          }
          return t;
        })
      );
    },

    onTaskUpdated: ({ task }) => {
      queryClient.setQueryData(boardKeys.tasks(boardId), (prev = []) =>
        prev.map((t) => (t._id.toString() === task._id.toString() ? task : t))
      );
    },

    onTaskCreated: ({ task }) => {
      queryClient.setQueryData(boardKeys.tasks(boardId), (prev = []) => {
        const exists = prev.some((t) => t._id.toString() === task._id.toString());
        return exists ? prev : [...prev, task];
      });
    },

    onTaskDeleted: ({ taskId }) => {
      queryClient.setQueryData(boardKeys.tasks(boardId), (prev = []) =>
        prev.filter((t) => t._id.toString() !== taskId)
      );
    },

    onTasksUnlocked: ({ taskIds, tasks: unlockedTasks }) => {
      queryClient.setQueryData(boardKeys.tasks(boardId), (prev = []) =>
        prev.map((t) => {
          if (unlockedTasks?.length) {
            const updated = unlockedTasks.find((u) => u._id.toString() === t._id.toString());
            return updated || t;
          }
          return taskIds.includes(t._id.toString()) ? { ...t, status: 'open' } : t;
        })
      );
    },

    onReconnect: () => {
      // Re-fetch tasks on reconnect to catch any missed events
      queryClient.invalidateQueries({ queryKey: boardKeys.tasks(boardId) });
    },
  };

  return {
    board: boardQuery.data ?? null,
    tasks: tasksQuery.data ?? [],
    isLoading: boardQuery.isLoading || tasksQuery.isLoading,
    error: boardQuery.error?.message || tasksQuery.error?.message || null,

    moveTask: (taskId, columnId, order) =>
      moveTaskMutation.mutateAsync({ taskId, columnId, order }),

    createTask: async (data) => {
      const res = await createTaskMutation.mutateAsync({ ...data, boardId });
      return res.data;
    },

    updateTask: async (taskId, data) => {
      const res = await updateTaskMutation.mutateAsync({ taskId, data });
      return res.data;
    },

    completeTask: async (taskId) => {
      const res = await completeTaskMutation.mutateAsync(taskId);
      return res.data;
    },

    deleteTask: (taskId) => deleteTaskMutation.mutateAsync(taskId),

    socketHandlers,
  };
}
