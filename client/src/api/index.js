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
export const getWorkload = (id) => api.get(`/workspaces/${id}/workload`);
export const getLeaderboard = (id, params) => api.get(`/workspaces/${id}/leaderboard`, { params });

// Webhook settings
export const saveWebhook = (id, data) => api.patch(`/workspaces/${id}/webhook`, data);
export const testWebhook = (id) => api.post(`/workspaces/${id}/webhook/test`);
export const deleteWebhook = (id) => api.delete(`/workspaces/${id}/webhook`);

// ─── Boards ────────────────────────────────────────
export const getBoards = (workspaceId) => api.get('/boards', { params: { workspaceId } });
export const createBoard = (data) => api.post('/boards', data);
export const createBoardFromTemplate = (data) => api.post('/boards/from-template', data);
export const deleteBoard = (id) => api.delete(`/boards/${id}`);

// Calendar feed
export const generateCalendarToken = (id) => api.post(`/boards/${id}/calendar/token`);
export const revokeCalendarToken = (id) => api.delete(`/boards/${id}/calendar/token`);

// ─── Tasks ─────────────────────────────────────────
export const getTasks = (boardId) => api.get('/tasks', { params: { boardId } });
export const getTaskDetail = (id) => api.get(`/tasks/${id}/detail`);
export const getTaskActivity = (id) => api.get(`/tasks/${id}/activity`);
export const createTask = (data) => api.post('/tasks', data);
export const updateTask = (id, data) => api.patch(`/tasks/${id}`, data);
export const moveTask = (id, data) => api.patch(`/tasks/${id}/move`, data);
export const completeTask = (id) => api.patch(`/tasks/${id}/complete`);
export const deleteTask = (id) => api.delete(`/tasks/${id}`);
export const addComment = (taskId, text) => api.post(`/tasks/${taskId}/comments`, { text });

// ─── Templates ─────────────────────────────────────
export const getTemplates = (workspaceId) => api.get('/templates', { params: { workspaceId } });
export const createTemplate = (data) => api.post('/templates', data);
export const updateTemplate = (id, data) => api.patch(`/templates/${id}`, data);
export const deleteTemplate = (id) => api.delete(`/templates/${id}`);

// ─── Notifications ─────────────────────────────────
export const getNotifications = () => api.get('/notifications');
export const markNotificationRead = (id) => api.patch(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.patch('/notifications/read-all');

// ─── Polls ─────────────────────────────────────────
export const getPolls = (boardId) => api.get(`/boards/${boardId}/polls`);
export const createPoll = (boardId, data) => api.post(`/boards/${boardId}/polls`, data);
export const votePoll = (pollId, optionIndex) => api.post(`/polls/${pollId}/vote`, { optionIndex });

// ─── Escalation (testing) ──────────────────────────
export const triggerEscalation = () => api.post('/escalation/run');

export default api;
