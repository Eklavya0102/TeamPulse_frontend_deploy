// src/store/useStore.js
import { create } from "zustand";

const useStore = create((set, get) => ({

  // ── Auth ──────────────────────────────────────────────────
  user:          null,
  token:         localStorage.getItem("atb_token"),
  isAuthLoading: true,

  setUser:        (user)  => set({ user }),
  setToken:       (token) => { localStorage.setItem("atb_token", token); set({ token }); },
  setAuthLoading: (v)     => set({ isAuthLoading: v }),
  logout: () => {
    localStorage.removeItem("atb_token");
    set({
      user: null, token: null,
      activeTeam: null, teams: [], teamMembers: [],
      tasks: [], rooms: [], activeRoom: null,
      messages: [], knowledgeItems: [],
      dashboardData: null, notifications: [],
    });
  },

  // ── Teams ─────────────────────────────────────────────────
  teams:       [],
  activeTeam:  null,
  teamMembers: [],

  setTeams:       (teams)   => set({ teams }),
  addTeam:        (team)    => set(s => ({ teams: [...s.teams, team] })),
  setActiveTeam:  (team)    => set({ activeTeam: team }),
  setTeamMembers: (members) => set({ teamMembers: members }),

  // ── Tasks ─────────────────────────────────────────────────
  tasks:        [],
  tasksLoading: false,

  setTasks:        (tasks)       => set({ tasks }),
  setTasksLoading: (v)           => set({ tasksLoading: v }),
  addTask:         (task)        => set(s => ({ tasks: [task, ...s.tasks] })),
  updateTask:      (id, updates) => set(s => ({
    tasks: s.tasks.map(t => t.id === id ? { ...t, ...updates } : t),
  })),
  removeTask: (id) => set(s => ({ tasks: s.tasks.filter(t => t.id !== id) })),

  // ── Chat ─────────────────────────────────────────────────
  rooms:      [],
  activeRoom: null,
  messages:   [],

  setRooms:      (rooms)    => set({ rooms }),
  setActiveRoom: (room)     => set({ activeRoom: room, messages: [] }),
  setMessages:   (msgOrFn)  => set(s => ({
    messages: typeof msgOrFn === "function" ? msgOrFn(s.messages) : msgOrFn,
  })),
  addMessage: (msg) => set(s => {
    if (s.messages.find(m => m.id === msg.id)) return s;
    return { messages: [...s.messages, msg] };
  }),

  // ── Knowledge ─────────────────────────────────────────────
  knowledgeItems: [],
  setKnowledgeItems:   (items) => set({ knowledgeItems: items }),
  addKnowledgeItem:    (item)  => set(s => ({ knowledgeItems: [item, ...s.knowledgeItems] })),
  removeKnowledgeItem: (id)    => set(s => ({
    knowledgeItems: s.knowledgeItems.filter(i => i.id !== id),
  })),

  // ── Dashboard ─────────────────────────────────────────────
  dashboardData:    null,
  setDashboardData: (data) => set({ dashboardData: data }),

  // ── Notifications — accepts array OR updater fn ────────────
  notifications: [],
  setNotifications: (nOrFn) => set(s => ({
    notifications: typeof nOrFn === "function" ? nOrFn(s.notifications) : nOrFn,
  })),
  markNotifRead: (id) => set(s => ({
    notifications: s.notifications.map(n =>
      n.id === id ? { ...n, isRead: true } : n
    ),
  })),

  // ── UI ────────────────────────────────────────────────────
  isDark:           localStorage.getItem("atb_dark") === "true",
  sidebarCollapsed: false,

  toggleDark: () => set(s => {
    const next = !s.isDark;
    localStorage.setItem("atb_dark", String(next));
    document.documentElement.classList.toggle("dark", next);
    return { isDark: next };
  }),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
}));

export default useStore;
