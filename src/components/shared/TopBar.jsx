// src/components/shared/TopBar.jsx
// Fix: Uses shared singleton socket - notifications now instant without refresh
// Fix: Unread count badge shows number
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import useStore from "../../store/useStore";
import { tasksApi } from "../../services/api";
import { initUserSocket } from "../../services/socket";
import { Bell, Share2, X, CheckCheck } from "lucide-react";
import toast from "react-hot-toast";

const TITLES = {
  "/":                     { title: "Dashboard",     sub: "Overview of your team"          },
  "/tasks":                { title: "Tasks",          sub: "Manage and track work"           },
  "/chat":                 { title: "Team Chat",      sub: "Real-time collaboration"         },
  "/meeting-intelligence": { title: "Meeting AI",     sub: "Extract tasks from discussions"  },
  "/knowledge":            { title: "Knowledge Base", sub: "Search your team's documents"    },
  "/analytics":            { title: "Analytics",      sub: "Team productivity insights"      },
};

export default function TopBar() {
  const { pathname } = useLocation();
  const {
    activeTeam, user,
    notifications, setNotifications, markNotifRead,
  } = useStore();

  const [notifOpen, setNotifOpen] = useState(false);
  const { title, sub } = TITLES[pathname] || { title: "TeamPulse", sub: "" };

  // Load notifications from API on team change
  useEffect(() => {
    if (!activeTeam) return;
    tasksApi.getNotifications(activeTeam.id)
      .then(r => setNotifications(r.data.notifications))
      .catch(() => {});
  }, [activeTeam?.id]);

  // Use shared singleton socket for instant notifications
  useEffect(() => {
    if (!user?.id) return;

    const sock = initUserSocket(user.id);

    const handleNotif = (notif) => {
      // Add to top of list instantly
      useStore.getState().setNotifications(
        prev => {
          // avoid duplicates
          if (prev.find(n => n.id === notif.id)) return prev;
          return [notif, ...prev];
        }
      );
      // Show toast
      toast(notif.message || notif.title, {
        icon: "🔔",
        duration: 4000,
      });
    };

    sock.on("new_notification", handleNotif);

    return () => {
      sock.off("new_notification", handleNotif);
    };
  }, [user?.id]);

  const unread = notifications.filter(n => !n.isRead).length;

  const handleMarkRead = (id) => {
    tasksApi.markRead(id).catch(() => {});
    markNotifRead(id);
  };

  const handleMarkAllRead = () => {
    notifications.filter(n => !n.isRead).forEach(n => {
      tasksApi.markRead(n.id).catch(() => {});
      markNotifRead(n.id);
    });
  };

  const handleCopyInvite = () => {
    if (!activeTeam?.inviteCode) return;
    navigator.clipboard.writeText(activeTeam.inviteCode)
      .then(() => toast.success(`Invite code copied: ${activeTeam.inviteCode}`))
      .catch(() => toast(`Invite code: ${activeTeam.inviteCode}`));
  };

  return (
    <header className="h-14 border-b border-[var(--border)] bg-[var(--surface)] flex items-center px-5 gap-4 shrink-0">
      {/* Title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-bold text-[var(--text)] leading-tight">{title}</h1>
        {sub && <p className="text-xs text-[var(--text-2)] leading-tight hidden sm:block">{sub}</p>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {activeTeam && (
          <button onClick={handleCopyInvite} className="btn-ghost text-xs gap-1.5 hidden sm:flex" title="Copy invite code">
            <Share2 size={13}/> Invite
          </button>
        )}

        {/* Notification bell with count */}
        <div className="relative">
          <button onClick={() => setNotifOpen(o => !o)} className="btn-ghost p-2 relative" title="Notifications">
            <Bell size={17}/>
            {unread > 0 && (
              <span className={`
                absolute flex items-center justify-center font-bold rounded-full
                bg-red-500 text-white leading-none
                ${unread > 9
                  ? "-top-1 -right-1 w-5 h-5 text-[9px]"
                  : "-top-0.5 -right-0.5 w-4 h-4 text-[10px]"}
              `}>
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)}/>
              <div className="absolute right-0 top-11 w-80 card shadow-xl z-50 animate-fade-in overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[var(--text)]">Notifications</span>
                    {unread > 0 && (
                      <span className="badge bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                        {unread} new
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {unread > 0 && (
                      <button onClick={handleMarkAllRead} className="btn-ghost p-1.5 text-xs gap-1" title="Mark all read">
                        <CheckCheck size={13}/> All read
                      </button>
                    )}
                    <button onClick={() => setNotifOpen(false)} className="btn-ghost p-1.5">
                      <X size={14}/>
                    </button>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto scrollbar-none">
                  {notifications.length === 0 ? (
                    <div className="py-10 text-center">
                      <Bell size={28} className="mx-auto text-[var(--text-2)] mb-2 opacity-30"/>
                      <p className="text-sm text-[var(--text-2)]">You're all caught up!</p>
                    </div>
                  ) : (
                    notifications.slice(0, 20).map(n => (
                      <div
                        key={n.id}
                        onClick={() => handleMarkRead(n.id)}
                        className={`
                          px-4 py-3 border-b border-[var(--border)] last:border-0
                          cursor-pointer hover:bg-[var(--surface-2)] transition-colors
                          ${!n.isRead ? "bg-brand-50/60 dark:bg-brand-900/10" : ""}
                        `}
                      >
                        <div className="flex items-start gap-2">
                          {!n.isRead && <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0"/>}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-[var(--text)]">{n.title}</p>
                            <p className="text-xs text-[var(--text-2)] mt-0.5 leading-relaxed">{n.message}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
