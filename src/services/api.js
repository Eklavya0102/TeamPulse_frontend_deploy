// src/services/api.js
import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: BASE,
  timeout: 60000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem("atb_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem("atb_token");
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────
export const authApi = {
  firebaseLogin:        (idToken, email, displayName) =>
    api.post("/auth/firebase-login", { idToken, email, displayName }),
  getMe:                ()       => api.get("/auth/me"),
  updateProfile:        (data)   => api.put("/auth/me", data),
  getMyTeams:           ()       => api.get("/auth/teams"),
  createTeam:           (data)   => api.post("/auth/teams", data),
  joinTeam:             (code)   => api.post("/auth/teams/join", { inviteCode: code }),
  getTeam:              (id)     => api.get(`/auth/teams/${id}`),
  getTeamMembers:       (id)     => api.get(`/auth/teams/${id}/members`),
  regenerateInviteCode: (id)     => api.post(`/auth/teams/${id}/invite-code`),
  deleteTeam:           (id)     => api.delete(`/auth/teams/${id}`),   // FIX 2
};

// ── Tasks ─────────────────────────────────────────────────────
export const tasksApi = {
  list:             (teamId, params) => api.get(`/tasks/teams/${teamId}/tasks`, { params }),
  create:           (teamId, data)   => api.post(`/tasks/teams/${teamId}/tasks`, data),
  update:           (teamId, id, d)  => api.put(`/tasks/teams/${teamId}/tasks/${id}`, d),
  delete:           (teamId, id)     => api.delete(`/tasks/teams/${teamId}/tasks/${id}`),
  stats:            (teamId)         => api.get(`/tasks/teams/${teamId}/tasks/stats`),
  getNotifications: (teamId)         => api.get(`/tasks/teams/${teamId}/notifications`),
  markRead:         (id)             => api.post(`/tasks/notifications/${id}/read`),
};

// ── Chat ──────────────────────────────────────────────────────
export const chatApi = {
  getRooms:    (teamId)         => api.get(`/chat/teams/${teamId}/rooms`),
  createRoom:  (teamId, data)   => api.post(`/chat/teams/${teamId}/rooms`, data),
  deleteRoom:  (roomId)         => api.delete(`/chat/rooms/${roomId}`),
  getMessages: (roomId, params) => api.get(`/chat/rooms/${roomId}/messages`, { params }),
  sendMessage: (roomId, text)   => api.post(`/chat/rooms/${roomId}/messages`, { content: text }),
  catchMeUp:   (roomId)         => api.get(`/chat/rooms/${roomId}/catchup`),
  summarize:   (roomId)         => api.post(`/chat/rooms/${roomId}/summarize`),
};

// ── Knowledge ─────────────────────────────────────────────────
export const knowledgeApi = {
  list:   (teamId) => api.get(`/knowledge/teams/${teamId}/knowledge`),
  upload: (teamId, formData) =>
    api.post(`/knowledge/teams/${teamId}/knowledge/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120000,
    }),
  pasteContent: (teamId, title, content) => {
    const fd = new FormData();
    fd.append("title", title);
    fd.append("content", content);
    return api.post(`/knowledge/teams/${teamId}/knowledge/upload`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120000,
    });
  },
  search: (teamId, query) => api.post(`/knowledge/teams/${teamId}/knowledge/search`, { query }),
  delete: (teamId, itemId) => api.delete(`/knowledge/teams/${teamId}/knowledge/${itemId}`),
  stats:  (teamId) => api.get(`/knowledge/teams/${teamId}/knowledge/stats`),
};

// ── Analytics ─────────────────────────────────────────────────
export const analyticsApi = {
  dashboard:    (teamId) => api.get(`/analytics/teams/${teamId}/dashboard`),
  analytics:    (teamId) => api.get(`/analytics/teams/${teamId}/analytics`),
  dailySummary: (teamId) => api.post(`/analytics/teams/${teamId}/daily-summary`),
  activity:     (teamId) => api.get(`/analytics/teams/${teamId}/activity`),
};

// ── AI ────────────────────────────────────────────────────────
export const aiApi = {
  extractTasks:        (teamId, text) => api.post(`/ai/teams/${teamId}/extract-tasks`, { text }),
  recommendPriorities: (teamId)       => api.get(`/ai/teams/${teamId}/recommend-priorities`),
  summarize:           (teamId, text, type = "document") =>
    api.post(`/ai/teams/${teamId}/summarize`, { text, type }),
  health: () => api.get("/ai/health"),
};

export default api;
