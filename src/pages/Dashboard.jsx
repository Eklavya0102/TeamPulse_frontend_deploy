// src/pages/Dashboard.jsx
// Fix 3: useEffect depends on activeTeam.id so data reloads on team switch
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useStore from "../store/useStore";
import { analyticsApi } from "../services/api";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import {
  CheckSquare, Clock, AlertCircle, Users, Sparkles,
  TrendingUp, ArrowRight, RefreshCw, Zap, FileText,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import toast from "react-hot-toast";

function StatCard({ icon: Icon, label, value, color = "brand", sub }) {
  const bg = {
    brand: "bg-brand-50 dark:bg-brand-900/20 text-brand-600",
    green: "bg-green-50 dark:bg-green-900/20 text-green-600",
    amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-600",
    red:   "bg-red-50 dark:bg-red-900/20 text-red-600",
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-bold text-[var(--text)] mt-1">{value}</p>
          {sub && <p className="text-xs text-[var(--text-2)] mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bg[color]}`}>
          <Icon size={20}/>
        </div>
      </div>
    </div>
  );
}

function DeadlineBadge({ deadline }) {
  if (!deadline) return null;
  try {
    const d = parseISO(deadline);
    if (isToday(d))    return <span className="badge bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Today</span>;
    if (isTomorrow(d)) return <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Tomorrow</span>;
    return <span className="badge badge-pending">{format(d, "MMM d")}</span>;
  } catch { return null; }
}

function PriorityDot({ priority }) {
  const c = { critical: "bg-rose-500", high: "bg-red-500", medium: "bg-amber-400", low: "bg-green-400" };
  return <span className={`w-2 h-2 rounded-full shrink-0 ${c[priority] || "bg-gray-400"}`}/>;
}

export default function Dashboard() {
  const { activeTeam, setDashboardData } = useStore();
  const navigate = useNavigate();
  const [data,           setData]           = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // FIX 3: re-runs whenever activeTeam.id changes
  const loadDashboard = async (teamId) => {
    if (!teamId) return;
    setLoading(true);
    setData(null);
    try {
      const r = await analyticsApi.dashboard(teamId);
      setData(r.data);
      setDashboardData(r.data);
    } catch {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard(activeTeam?.id);
  }, [activeTeam?.id]);  // ← key fix: depends on team id

  const generateSummary = async () => {
    if (!activeTeam) return;
    setSummaryLoading(true);
    try {
      const r = await analyticsApi.dailySummary(activeTeam.id);
      setData(d => ({ ...d, dailySummary: r.data.summary }));
      toast.success("Daily digest generated!");
    } catch (e) {
      toast.error(e.response?.data?.error || "Failed to generate digest");
    } finally { setSummaryLoading(false); }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card h-28 animate-pulse bg-[var(--surface-2)]"/>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card h-56 animate-pulse bg-[var(--surface-2)] lg:col-span-2"/>
          <div className="card h-56 animate-pulse bg-[var(--surface-2)]"/>
        </div>
      </div>
    );
  }

  const stats = data?.taskStats || {};

  return (
    <div className="p-6 space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text)]">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"} ☀️
          </h2>
          <p className="text-sm text-[var(--text-2)]">
            {activeTeam?.name} · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <button onClick={() => loadDashboard(activeTeam?.id)} className="btn-ghost gap-2 text-sm">
          <RefreshCw size={14}/> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={CheckSquare} label="Pending Tasks"  value={stats.pending || 0}    color="brand"/>
        <StatCard icon={TrendingUp}  label="In Progress"    value={stats.inProgress || 0}  color="green"/>
        <StatCard icon={AlertCircle} label="Overdue"        value={stats.overdue || 0}     color="red"/>
        <StatCard icon={Users}       label="Team Members"   value={data?.memberCount || 0} color="amber"
          sub={`${data?.knowledgeCount || 0} docs`}/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-bold text-[var(--text)] mb-4">Task Activity (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={data?.completionTrend || []}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-2)" }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: "var(--text-2)" }} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}/>
              <Area type="monotone" dataKey="created"   stroke="#6366f1" fill="url(#g1)" strokeWidth={2} name="Created"/>
              <Area type="monotone" dataKey="completed" stroke="#10b981" fill="url(#g2)" strokeWidth={2} name="Completed"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* AI Digest */}
        <div className="card p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-brand-100 dark:bg-brand-900/30 rounded-lg flex items-center justify-center">
                <Sparkles size={14} className="text-brand-600"/>
              </div>
              <h3 className="text-sm font-bold text-[var(--text)]">AI Daily Digest</h3>
            </div>
            <button
              onClick={generateSummary}
              disabled={summaryLoading}
              className="btn-ghost p-1.5"
              title="Regenerate digest"
            >
              <RefreshCw size={13} className={summaryLoading ? "animate-spin" : ""}/>
            </button>
          </div>
          {data?.dailySummary ? (
            <p className="text-xs text-[var(--text-2)] leading-relaxed flex-1 overflow-auto scrollbar-none">
              {data.dailySummary.content}
            </p>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <Sparkles size={24} className="text-brand-400"/>
              <p className="text-xs text-[var(--text-2)] text-center">
                Generate an AI-powered summary of today's team activity
              </p>
              <button onClick={generateSummary} disabled={summaryLoading} className="btn-primary text-xs py-1.5 px-3">
                {summaryLoading ? "Generating…" : "Generate digest"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Tasks */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[var(--text)]">Pending Tasks</h3>
            <button onClick={() => navigate("/tasks")} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
              View all <ArrowRight size={12}/>
            </button>
          </div>
          <div className="space-y-0.5">
            {(data?.pendingTasks || []).slice(0, 6).map(task => (
              <div key={task.id} className="flex items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
                <PriorityDot priority={task.priority}/>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text)] truncate">{task.title}</p>
                  {task.assignee && (
                    <p className="text-xs text-[var(--text-2)]">{task.assignee.displayName}</p>
                  )}
                </div>
                <DeadlineBadge deadline={task.deadline}/>
              </div>
            ))}
            {!data?.pendingTasks?.length && (
              <div className="py-8 text-center">
                <CheckSquare size={28} className="mx-auto text-green-400 mb-2"/>
                <p className="text-sm text-[var(--text-2)]">All caught up! No pending tasks.</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-[var(--text)] mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {(data?.recentActivity || []).slice(0, 8).map(act => {
              const letter = (act.user?.displayName || "?")[0].toUpperCase();
              const colors = ["bg-brand-500","bg-purple-500","bg-green-500","bg-pink-500","bg-amber-500"];
              const color  = colors[letter.charCodeAt(0) % colors.length];
              return (
                <div key={act.id} className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full ${color} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                    {letter}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--text)]">{act.description}</p>
                    <p className="text-[10px] text-[var(--text-2)] mt-0.5">
                      {act.createdAt ? format(parseISO(act.createdAt), "h:mm a") : ""}
                    </p>
                  </div>
                </div>
              );
            })}
            {!data?.recentActivity?.length && (
              <p className="text-sm text-[var(--text-2)] text-center py-6">No activity yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Deadlines */}
      {data?.upcomingDeadlines?.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-amber-500"/>
            <h3 className="text-sm font-bold text-[var(--text)]">Upcoming Deadlines</h3>
          </div>
          <div className="flex gap-3 flex-wrap">
            {data.upcomingDeadlines.map(task => (
              <div key={task.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                <PriorityDot priority={task.priority}/>
                <div>
                  <p className="text-xs font-semibold text-[var(--text)]">{task.title}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {task.deadline ? format(parseISO(task.deadline), "EEE, MMM d") : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Zap,         label: "Meeting AI",    path: "/meeting-intelligence", color: "bg-purple-50 dark:bg-purple-900/20 text-purple-600" },
          { icon: CheckSquare, label: "Add Task",      path: "/tasks",                color: "bg-brand-50 dark:bg-brand-900/20 text-brand-600"    },
          { icon: FileText,    label: "Knowledge",     path: "/knowledge",            color: "bg-green-50 dark:bg-green-900/20 text-green-600"    },
          { icon: Users,       label: "Team Chat",     path: "/chat",                 color: "bg-amber-50 dark:bg-amber-900/20 text-amber-600"    },
        ].map(({ icon: Icon, label, path, color }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="card p-4 flex flex-col items-center gap-2 hover:shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
              <Icon size={21}/>
            </div>
            <span className="text-xs font-semibold text-[var(--text)]">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
