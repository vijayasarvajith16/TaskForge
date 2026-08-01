import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Auth ──────────────────────────────────────────
export const register = (data) => api.post('/auth/register', data);
export const login = (data) => api.post('/auth/login', data);

// ─── Workspaces ────────────────────────────────────
export const createWorkspace = (data) => api.post('/workspaces', data);
export const getWorkspace = (id) => api.get(`/workspaces/${id}`);
export const generateInvite = (id) => api.post(`/workspaces/${id}/invite`);
export const joinWorkspace = (code) => api.post(`/workspaces/join/${code}`);

// ─── Boards ────────────────────────────────────────
export const getBoards = (workspaceId) => api.get('/boards', { params: { workspaceId } });
export const createBoard = (data) => api.post('/boards', data);
export const deleteBoard = (id) => api.delete(`/boards/${id}`);

// ─── Tasks ─────────────────────────────────────────
export const getTasks = (boardId) => api.get('/tasks', { params: { boardId } });
export const createTask = (data) => api.post('/tasks', data);
export const updateTask = (id, data) => api.patch(`/tasks/${id}`, data);
export const deleteTask = (id) => api.delete(`/tasks/${id}`);

export default api;
