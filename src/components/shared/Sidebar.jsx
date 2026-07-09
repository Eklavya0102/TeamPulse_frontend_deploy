// src/components/shared/Sidebar.jsx
// Logo: Activity icon (heartbeat line = perfect for TeamPulse)
// Chat badge: shows unread message count (1,2,3...9+)
// Logout: only clears token, all DB data preserved
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { getAppSocket, disconnectSocket } from "../../services/socket";
import useStore from "../../store/useStore";
import { authApi } from "../../services/api";
import toast from "react-hot-toast";
import {
  Activity, LayoutDashboard, CheckSquare, MessageSquare,
  BookOpen, BarChart2, Zap, ChevronDown, Plus, LogOut,
  Moon, Sun, Users, PanelLeftClose, ChevronRight, Trash2, AlertTriangle,
} from "lucide-react";

const NAV = [
  { path: "/",                     icon: LayoutDashboard, label: "Dashboard"      },
  { path: "/tasks",                icon: CheckSquare,     label: "Tasks"          },
  { path: "/chat",                 icon: MessageSquare,   label: "Team Chat",     isChatRoute: true },
  { path: "/meeting-intelligence", icon: Zap,             label: "Meeting AI"     },
  { path: "/knowledge",            icon: BookOpen,        label: "Knowledge Base" },
  { path: "/analytics",            icon: BarChart2,       label: "Analytics"      },
];

function UserAvatar({ name }) {
  const letter = (name || "?")[0].toUpperCase();
  const colors = ["bg-brand-500","bg-purple-500","bg-green-500","bg-pink-500","bg-amber-500"];
  const color  = colors[letter.charCodeAt(0) % colors.length];
  return (
    <div className={`w-7 h-7 ${color} rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0`}>
      {letter}
    </div>
  );
}

function DeleteTeamModal({ team, onClose, onDeleted }) {
  const [loading,   setLoading]   = useState(false);
  const [confirmed, setConfirmed] = useState("");

  const handleDelete = async () => {
    if (confirmed !== team.name) { toast.error("Team name doesn't match"); return; }
    setLoading(true);
    try {
      await authApi.deleteTeam(team.id);
      toast.success(`Team "${team.name}" deleted`);
      onDeleted(team.id);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error || "Failed to delete team");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6 animate-slide-up">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-red-600"/>
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text)]">Delete Team</h3>
            <p className="text-xs text-[var(--text-2)]">This cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-[var(--text-2)] mb-4">
          Permanently deletes <span className="font-bold text-[var(--text)]">"{team.name}"</span> and all its tasks, messages, and documents.
        </p>
        <div className="mb-4">
          <label className="block text-xs font-semibold text-[var(--text-2)] mb-1.5 uppercase tracking-wide">
            Type <span className="font-bold text-[var(--text)]">{team.name}</span> to confirm:
          </label>
          <input className="input" placeholder={team.name}
            value={confirmed} onChange={e => setConfirmed(e.target.value)} autoFocus/>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center text-sm">Cancel</button>
          <button
            onClick={handleDelete}
            disabled={loading || confirmed !== team.name}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
          >
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const {
    user, teams, activeTeam, setActiveTeam, setTeams, setTeamMembers,
    setTasks, setRooms, setActiveRoom, setMessages, setKnowledgeItems, setDashboardData,
    isDark, toggleDark, logout, sidebarCollapsed, setSidebarCollapsed,
  } = useStore();

  const [teamMenuOpen, setTeamMenuOpen] = useState(false);
  const [deleteModal,  setDeleteModal]  = useState(null);
  const [unreadCount,  setUnreadCount]  = useState(0);
  const socketRef = useRef(null);
  const collapsed = sidebarCollapsed;

  // Socket for unread message badge
  useEffect(() => {
    if (!user?.id || !activeTeam?.id) return;

    const sock = getAppSocket();
    socketRef.current = sock;

    const handleNewMessage = (msg) => {
      if (pathname === "/chat") return;
      if (msg.userId === user.id) return;
      setUnreadCount(prev => prev + 1);
    };

    sock.on("new_message", handleNewMessage);

    return () => {
      sock.off("new_message", handleNewMessage);
      socketRef.current = null;
    };
  }, [user?.id, activeTeam?.id]);

  // Clear badge when visiting chat
  useEffect(() => {
    if (pathname === "/chat") setUnreadCount(0);
  }, [pathname]);

  const handleLogout = () => {
    disconnectSocket(); // drop the authenticated socket so the next login gets a fresh one
    logout(); // only clears token + memory state, DB data is safe
    navigate("/login");
    toast.success("Signed out — your data is saved ✓");
  };

  const clearTeamState = () => {
    setTasks([]); setRooms([]); setActiveRoom(null);
    setMessages([]); setKnowledgeItems([]); setDashboardData(null);
    setUnreadCount(0);
  };

  const handleSwitchTeam = async (team) => {
    if (team.id === activeTeam?.id) { setTeamMenuOpen(false); return; }
    clearTeamState();
    setActiveTeam(team);
    setTeamMenuOpen(false);
    navigate("/");
    try {
      const r = await authApi.getTeamMembers(team.id);
      setTeamMembers(r.data.members);
    } catch {}
    toast.success(`Switched to ${team.name}`);
  };

  const handleTeamDeleted = (id) => {
    const remaining = teams.filter(t => t.id !== id);
    setTeams(remaining);
    clearTeamState();
    if (remaining.length > 0) { setActiveTeam(remaining[0]); navigate("/"); }
    else { setActiveTeam(null); navigate("/onboarding"); }
  };

  // Nav item with optional unread badge
  const NavItem = ({ path, icon: Icon, label, isChatRoute }) => {
    const active    = pathname === path;
    const showBadge = isChatRoute && unreadCount > 0 && pathname !== "/chat";
    const badgeText = unreadCount > 9 ? "9+" : String(unreadCount);

    return (
      <button
        onClick={() => navigate(path)}
        className={`sidebar-item ${active ? "active" : ""} ${collapsed ? "justify-center px-0" : ""}`}
        title={collapsed ? label : undefined}
      >
        {/* Icon with badge (collapsed mode) */}
        <div className="relative shrink-0">
          <Icon size={18}/>
          {showBadge && collapsed && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-0.5 leading-none">
              {badgeText}
            </span>
          )}
        </div>
        {/* Label + badge (expanded mode) */}
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{label}</span>
            {showBadge && (
              <span className="ml-auto min-w-[20px] h-5 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 leading-none">
                {badgeText}
              </span>
            )}
          </>
        )}
      </button>
    );
  };

  // Shared logo
  const Logo = () => (
    <div className="w-8 h-8 bg-brand-600 rounded-xl flex items-center justify-center shrink-0">
      <Activity size={17} className="text-white"/>
    </div>
  );

  return (
    <>
      {/* ── Collapsed ──────────────────────────────────────── */}
      {collapsed && (
        <div className="relative shrink-0" style={{ width: "60px" }}>
          <aside className="flex flex-col h-full border-r border-[var(--border)] bg-[var(--surface)] w-[60px]">
            <div className="flex items-center justify-center h-14 border-b border-[var(--border)] shrink-0">
              <Logo/>
            </div>
            <nav className="flex-1 px-1.5 py-2 space-y-0.5 overflow-y-auto scrollbar-none">
              {NAV.map(item => <NavItem key={item.path} {...item}/>)}
            </nav>
            <div className="px-1.5 py-2 border-t border-[var(--border)] space-y-0.5">
              <button onClick={toggleDark} className="sidebar-item justify-center px-0 w-full" title={isDark ? "Light mode" : "Dark mode"}>
                {isDark ? <Sun size={17}/> : <Moon size={17}/>}
              </button>
              <button onClick={handleLogout} className="sidebar-item justify-center px-0 w-full" title="Sign out">
                <LogOut size={17}/>
              </button>
            </div>
          </aside>
          {/* Floating expand tab */}
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-30 w-6 h-10 bg-[var(--surface)] border border-[var(--border)] rounded-r-lg flex items-center justify-center text-[var(--text-2)] hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 shadow-sm transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight size={13}/>
          </button>
        </div>
      )}

      {/* ── Expanded ───────────────────────────────────────── */}
      {!collapsed && (
        <aside className="flex flex-col border-r border-[var(--border)] bg-[var(--surface)] w-[220px] shrink-0">
          <div className="flex items-center h-14 border-b border-[var(--border)] px-3 gap-2.5 shrink-0">
            <Logo/>
            <span className="font-bold text-sm text-[var(--text)] truncate flex-1">TeamPulse</span>
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="text-[var(--text-2)] hover:text-[var(--text)] transition-colors p-1 ml-auto"
              title="Collapse sidebar"
            >
              <PanelLeftClose size={16}/>
            </button>
          </div>

          {/* Team switcher */}
          <div className="px-2.5 py-2.5 border-b border-[var(--border)]">
            <button
              onClick={() => setTeamMenuOpen(o => !o)}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-[var(--surface-2)] transition-colors"
            >
              <div className="w-6 h-6 bg-brand-100 dark:bg-brand-900/30 rounded-lg flex items-center justify-center shrink-0">
                <Users size={12} className="text-brand-600"/>
              </div>
              <span className="text-xs font-semibold text-[var(--text)] truncate flex-1 text-left">
                {activeTeam?.name || "Select team"}
              </span>
              <ChevronDown size={13} className={`text-[var(--text-2)] transition-transform ${teamMenuOpen ? "rotate-180" : ""}`}/>
            </button>

            {teamMenuOpen && (
              <div className="mt-1 space-y-0.5 animate-fade-in">
                {teams.map(t => (
                  <div key={t.id} className="flex items-center gap-1 group">
                    <button
                      onClick={() => handleSwitchTeam(t)}
                      className={`flex-1 text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        activeTeam?.id === t.id
                          ? "bg-brand-50 dark:bg-brand-900/20 text-brand-600"
                          : "text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                      }`}
                    >
                      {t.name}
                    </button>
                    {t.createdBy === user?.id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteModal(t); setTeamMenuOpen(false); }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-2)] hover:text-red-500 transition-all rounded"
                        title="Delete team"
                      >
                        <Trash2 size={12}/>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => { setTeamMenuOpen(false); navigate("/onboarding"); }}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-[var(--text-2)] hover:bg-[var(--surface-2)] flex items-center gap-1.5 transition-colors"
                >
                  <Plus size={11}/> New team
                </button>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto scrollbar-none">
            {NAV.map(item => <NavItem key={item.path} {...item}/>)}
          </nav>

          {/* Bottom */}
          <div className="px-2 py-2 border-t border-[var(--border)] space-y-0.5">
            <button onClick={toggleDark} className="sidebar-item">
              {isDark ? <Sun size={17}/> : <Moon size={17}/>}
              <span>{isDark ? "Light mode" : "Dark mode"}</span>
            </button>
            {user && (
              <div className="flex items-center gap-2 px-2.5 py-2 mt-1 rounded-xl hover:bg-[var(--surface-2)] transition-colors">
                <UserAvatar name={user.displayName || user.email}/>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text)] truncate">{user.displayName || "User"}</p>
                  <p className="text-[10px] text-[var(--text-2)] truncate">{user.email}</p>
                </div>
                <button onClick={handleLogout} className="text-[var(--text-2)] hover:text-red-500 transition-colors p-1" title="Sign out">
                  <LogOut size={14}/>
                </button>
              </div>
            )}
          </div>
        </aside>
      )}

      {deleteModal && (
        <DeleteTeamModal
          team={deleteModal}
          onClose={() => setDeleteModal(null)}
          onDeleted={handleTeamDeleted}
        />
      )}
    </>
  );
}
