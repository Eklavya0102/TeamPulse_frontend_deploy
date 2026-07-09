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

// ── Silent token refresh ─────────────────────────────────────
// Access tokens now expire (see backend app.py). Rather than bouncing the
// user to /login every time that happens, we try ONE silent refresh using
// the longer-lived refresh token and retry the original request. Only if
// the refresh itself fails (refresh token also expired/invalid) do we
// actually log the user out — this is the same end state as before, just
// no longer triggered by routine access-token expiry.
let isRefreshing = false;
let pendingQueue = [];

function resolveQueue(newToken, error) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(newToken);
  });
  pendingQueue = [];
}

function forceLogout() {
  localStorage.removeItem("atb_token");
  localStorage.removeItem("atb_refresh_token");
  if (!window.location.pathname.includes("/login")) {
    window.location.href = "/login";
  }
}

api.interceptors.response.use(
  r => r,
  async (err) => {
    const status = err.response?.status;
    const original = err.config;
    const url = original?.url || "";

    // Never try to "refresh" a failed login or a failed refresh itself —
    // those failing means the credentials/refresh token are genuinely
    // invalid, not just a routine expired access token.
    const isAuthEndpoint = url.includes("/auth/firebase-login") || url.includes("/auth/refresh");

    if (status !== 401 || isAuthEndpoint || !original || original._retry) {
      if (status === 401) forceLogout();
      return Promise.reject(err);
    }

    const refreshToken = localStorage.getItem("atb_refresh_token");
    if (!refreshToken) {
      forceLogout();
      return Promise.reject(err);
    }

    original._retry = true;

    if (isRefreshing) {
      // A refresh is already in flight (e.g. several requests 401'd around
      // the same moment) — queue this one and retry it once that refresh
      // resolves, instead of firing another refresh call.
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then(newToken => {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      });
    }

    isRefreshing = true;
    try {
      // Plain axios (not the `api` instance) so the request interceptor
      // above doesn't overwrite this with the expired access token.
      const { data } = await axios.post(`${BASE}/auth/refresh`, {}, {
        headers: { Authorization: `Bearer ${refreshToken}` },
      });
      localStorage.setItem("atb_token", data.accessToken);
      resolveQueue(data.accessToken, null);
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    } catch (refreshErr) {
      resolveQueue(null, refreshErr);
      forceLogout();
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
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
