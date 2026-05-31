// src/pages/TasksPage.jsx
// Fix: Filter tabs restored to original style (not dropdown)
// Fix: Start confirmation for assignee
// Fix: Responsive layout
import { useEffect, useState, useRef } from "react";
import useStore from "../store/useStore";
import { getAppSocket, joinTeamRoom } from "../services/socket";
import { tasksApi } from "../services/api";
import { format, parseISO } from "date-fns";
import {
  Plus, CheckCircle, Circle, Clock, User,
  Trash2, Sparkles, X, RotateCcw, PlayCircle, AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";

const STATUS_COLS = [
  { id: "pending",     label: "Pending",     color: "border-gray-300 dark:border-gray-600" },
  { id: "in_progress", label: "In Progress", color: "border-blue-400"  },
  { id: "completed",   label: "Completed",   color: "border-green-500" },
];
const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function PriorityBadge({ priority }) {
  const cls = {
    critical: "badge-critical", high: "badge-high",
    medium:   "badge-medium",   low:  "badge-low",
  };
  return <span className={`badge ${cls[priority] || "badge-pending"} capitalize`}>{priority}</span>;
}

// ── Generic confirm modal ─────────────────────────────────────
function ConfirmModal({ icon, iconBg, title, subtitle, body, confirmLabel, confirmCls, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6 animate-slide-up">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text)]">{title}</h3>
            {subtitle && <p className="text-xs text-[var(--text-2)] mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {body && (
          <div className="bg-[var(--surface-2)] rounded-xl px-3 py-2.5 mb-5 text-sm text-[var(--text)] leading-relaxed">
            "{body}"
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-secondary flex-1 justify-center text-sm">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 justify-center text-sm ${confirmCls}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── Create task modal ─────────────────────────────────────────
function CreateTaskModal({ onClose, onCreated, teamId, members }) {
  const [form, setForm] = useState({
    title: "", description: "", priority: "medium", assigneeId: "", deadline: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    try {
      const r = await tasksApi.create(teamId, form);
      onCreated(r.data.task);
      toast.success("Task created!");
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error || "Failed to create task");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-5 sm:p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-[var(--text)]">New Task</h3>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16}/></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="input" placeholder="Task title *"
            value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            required autoFocus/>
          <textarea className="input resize-none" rows={2} placeholder="Description (optional)"
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}/>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--text-2)] mb-1.5 block uppercase tracking-wide">Priority</label>
              <select className="input text-sm" value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--text-2)] mb-1.5 block uppercase tracking-wide">Assignee</label>
              <select className="input text-sm" value={form.assigneeId}
                onChange={e => setForm(f => ({ ...f, assigneeId: e.target.value }))}>
                <option value="">Unassigned</option>
                {(members || []).map(m => (
                  <option key={m.userId} value={m.userId}>
                    {m.user?.displayName || m.user?.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--text-2)] mb-1.5 block uppercase tracking-wide">Deadline</label>
            <input type="date" className="input text-sm"
              value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}/>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? "Creating…" : "Create task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Task Card ─────────────────────────────────────────────────
function TaskCard({ task, onUpdate, onDelete, currentUser, isOwner }) {
  const [confirmType, setConfirmType] = useState(null);

  const isAssignee      = task.assigneeId === currentUser?.id;
  const isCreator       = task.creator?.id === currentUser?.id;
  const canDelete       = task.status === "completed" ? isOwner : (isOwner || isCreator);
  const canChangeStatus = isAssignee || isOwner || isCreator;
  const isCompleted     = task.status === "completed";
  const isInProgress    = task.status === "in_progress";

  const handleStatusClick = () => {
    if (!canChangeStatus) { toast.error("Only the assigned person can change task status"); return; }
    if (task.status === "pending")     setConfirmType("start");
    if (task.status === "in_progress") setConfirmType("complete");
  };

  const handleConfirm = () => {
    if (confirmType === "start")    onUpdate(task.id, { status: "in_progress" });
    if (confirmType === "complete") onUpdate(task.id, { status: "completed" });
    setConfirmType(null);
  };

  const handleUndo = () => {
    if (!canChangeStatus) { toast.error("Only the assigned person can undo this"); return; }
    onUpdate(task.id, { status: "in_progress" });
  };

  return (
    <>
      <div className={`card p-3 sm:p-3.5 mb-2.5 group hover:shadow-md transition-all duration-200 ${isCompleted ? "opacity-70" : ""}`}>
        <div className="flex items-start gap-2.5">
          {/* Status button */}
          <button
            onClick={handleStatusClick}
            disabled={isCompleted && !canChangeStatus}
            className={`mt-0.5 shrink-0 transition-colors ${
              isCompleted  ? "text-green-500 cursor-default" :
              isInProgress ? "text-blue-500 hover:text-green-500" :
              canChangeStatus ? "text-[var(--text-2)] hover:text-blue-500" :
              "text-[var(--text-2)] opacity-40 cursor-not-allowed"
            }`}
            title={
              !canChangeStatus ? "Only the assignee can change status" :
              isCompleted      ? "Completed" :
              isInProgress     ? "Click to complete" : "Click to start"
            }
          >
            {isCompleted  ? <CheckCircle size={16}/> :
             isInProgress ? <PlayCircle  size={16}/> :
                            <Circle      size={16}/>}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium text-[var(--text)] leading-snug ${isCompleted ? "line-through opacity-60" : ""}`}>
              {task.title}
            </p>
            {task.description && (
              <p className="text-xs text-[var(--text-2)] mt-0.5 line-clamp-2">{task.description}</p>
            )}

            {/* Badges */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <PriorityBadge priority={task.priority}/>

              {task.source === "ai_extracted" && (
                <span className="badge bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                  <Sparkles size={9}/> AI
                </span>
              )}
              {isInProgress && <span className="badge badge-in_progress">In Progress</span>}

              {task.deadline && (() => {
                try {
                  return (
                    <span className="badge badge-pending flex items-center gap-1">
                      <Clock size={9}/>{format(parseISO(task.deadline), "MMM d")}
                    </span>
                  );
                } catch { return null; }
              })()}

              {task.assignee && (
                <span className="flex items-center gap-1 text-xs text-[var(--text-2)]">
                  <User size={10}/>
                  <span className="truncate max-w-[70px]">{task.assignee.displayName?.split(" ")[0]}</span>
                  {isAssignee && <span className="text-brand-500 font-semibold text-[10px]">(you)</span>}
                </span>
              )}
            </div>

            {/* Hint for assignee */}
            {!isCompleted && isAssignee && (
              <p className="text-[10px] text-brand-500 mt-1.5">
                {isInProgress ? "Tap ▶ again to mark complete" : "Tap ○ to start working"}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            {isCompleted && canChangeStatus && (
              <button
                onClick={handleUndo}
                className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-2)] hover:text-amber-500 transition-all rounded-lg"
                title="Undo — move back to In Progress"
              >
                <RotateCcw size={13}/>
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => onDelete(task)}
                className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-2)] hover:text-red-500 transition-all rounded-lg"
                title="Delete task"
              >
                <Trash2 size={13}/>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirm start modal */}
      {confirmType === "start" && (
        <ConfirmModal
          icon={<PlayCircle size={20} className="text-blue-600"/>}
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          title="Start this task?"
          subtitle="This will move the task to In Progress"
          body={task.title}
          confirmLabel="Yes, start!"
          confirmCls="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors w-full"
          onConfirm={handleConfirm}
          onCancel={() => setConfirmType(null)}
        />
      )}

      {/* Confirm complete modal */}
      {confirmType === "complete" && (
        <ConfirmModal
          icon={<CheckCircle size={20} className="text-green-600"/>}
          iconBg="bg-green-100 dark:bg-green-900/30"
          title="Mark as Complete?"
          subtitle="Are you sure you completed this task?"
          body={task.title}
          confirmLabel="Yes, completed!"
          confirmCls="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors w-full"
          onConfirm={handleConfirm}
          onCancel={() => setConfirmType(null)}
        />
      )}
    </>
  );
}

// ── Delete Task Confirm Modal ────────────────────────────────
function DeleteTaskModal({ task, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6 animate-slide-up">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
            <Trash2 size={20} className="text-red-600"/>
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text)]">Delete Task?</h3>
            <p className="text-xs text-[var(--text-2)] mt-0.5">This action cannot be undone</p>
          </div>
        </div>
        <div className="bg-[var(--surface-2)] rounded-xl px-3 py-2.5 mb-5 text-sm text-[var(--text)] leading-relaxed">
          "{task.title}"
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-secondary flex-1 justify-center text-sm">Cancel</button>
          <button
            onClick={onConfirm}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition-colors"
          >
            <Trash2 size={14}/> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main TasksPage ────────────────────────────────────────────
export default function TasksPage() {
  const { activeTeam, user, tasks, setTasks, addTask, updateTask, removeTask, teamMembers } = useStore();
  const [loading,       setLoading]       = useState(true);
  const [showCreate,    setShowCreate]    = useState(false);
  const [filter,        setFilter]        = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const socketRef = useRef(null);
  const isOwner = activeTeam?.createdBy === user?.id;

  const loadTasks = async () => {
    if (!activeTeam) return;
    setLoading(true);
    try {
      const r = await tasksApi.list(activeTeam.id);
      setTasks(r.data.tasks);
    } catch { toast.error("Failed to load tasks"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadTasks(); }, [activeTeam?.id]);

  // Real-time socket
  useEffect(() => {
    if (!activeTeam || !user) return;
    const sock = getAppSocket();
    socketRef.current = sock;
    // Join team room for task broadcasts
    const doJoin = () => sock.emit("join_team_room", { teamId: activeTeam.id, userId: user.id });
    if (sock.connected) doJoin();
    else sock.once("connect", doJoin);
    sock.on("new_task", (task) => {
      const exists = useStore.getState().tasks.find(t => t.id === task.id);
      if (!exists) {
        addTask(task);
        if (task.assigneeId === user.id) toast("📋 New task assigned to you!", { icon: "🎯", duration: 4000 });
        else toast(`New task: ${task.title}`, { icon: "📋", duration: 2500 });
      }
    });
    sock.on("task_updated", (task) => updateTask(task.id, task));
    sock.on("task_deleted", ({ taskId }) => removeTask(taskId));
    return () => {
      sock.emit("leave_team_room", { teamId: activeTeam.id });
      sock.off("new_task");
      sock.off("task_updated");
      sock.off("task_deleted");
      // Don't disconnect shared socket
    };
  }, [activeTeam?.id, user?.id]);

  const handleUpdate = async (taskId, updates) => {
    try {
      const r = await tasksApi.update(activeTeam.id, taskId, updates);
      updateTask(taskId, r.data.task);
      if (updates.status === "completed")  toast.success("✅ Task completed!");
      else if (updates.status === "in_progress") toast.success("▶ Task started!");
    } catch (e) {
      toast.error(e.response?.data?.error || "Failed to update task");
    }
  };

  const handleDelete = async (task) => {
    if (task.status === "completed" && !isOwner) {
      toast.error("Only the team owner can delete completed tasks");
      return;
    }
    setDeleteConfirm(task); // show modal instead of browser confirm
  };

  const confirmDelete = async () => {
    const task = deleteConfirm;
    setDeleteConfirm(null);
    try {
      await tasksApi.delete(activeTeam.id, task.id);
      removeTask(task.id);
      toast.success("Task deleted");
    } catch (e) {
      toast.error(e.response?.data?.error || "Failed to delete");
    }
  };

  const handleCreated = (task) => {
    if (!tasks.find(t => t.id === task.id)) addTask(task);
  };

  const filtered = tasks.filter(t => {
    if (filter === "mine")   return t.assigneeId === user?.id;
    if (filter === "high")   return ["high","critical"].includes(t.priority);
    if (filter === "active") return t.status !== "completed";
    return true;
  });

  const byStatus = (status) =>
    filtered
      .filter(t => t.status === status)
      .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99));

  const stats = {
    total:     tasks.length,
    completed: tasks.filter(t => t.status === "completed").length,
    mine:      tasks.filter(t => t.assigneeId === user?.id && t.status !== "completed").length,
    overdue:   tasks.filter(t => t.deadline && new Date(t.deadline) < new Date() && t.status !== "completed").length,
  };

  return (
    <div className="p-3 sm:p-4 lg:p-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[var(--text)]">Tasks</h2>
          <p className="text-xs sm:text-sm text-[var(--text-2)] mt-0.5 flex flex-wrap gap-x-2">
            <span>{stats.completed}/{stats.total} completed</span>
            {stats.mine > 0    && <span className="text-brand-500">{stats.mine} assigned to you</span>}
            {stats.overdue > 0 && <span className="text-red-500">{stats.overdue} overdue</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Original-style filter tabs */}
          <div className="flex rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            {[
              ["all",    "All"],
              ["mine",   "Mine"],
              ["high",   "High"],
              ["active", "Active"],
            ].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilter(val)}
                className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  filter === val
                    ? "bg-brand-600 text-white"
                    : "text-[var(--text-2)] hover:text-[var(--text)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary gap-1.5 text-xs sm:text-sm">
            <Plus size={15}/> New Task
          </button>
        </div>
      </div>

      {/* Status legend */}
      <div className="hidden sm:flex items-center gap-4 mb-4 text-xs text-[var(--text-2)] flex-wrap">
        <div className="flex items-center gap-1.5"><Circle size={12}/> Click to start</div>
        <div className="flex items-center gap-1.5"><PlayCircle size={12} className="text-blue-500"/> Click to complete</div>
        <div className="flex items-center gap-1.5"><CheckCircle size={12} className="text-green-500"/> Hover to undo</div>
        {!isOwner && (
          <div className="flex items-center gap-1.5 text-amber-500">
            <AlertCircle size={12}/> Only your assigned tasks are interactive
          </div>
        )}
      </div>

      {/* Kanban — 1 col mobile, 2 col sm, 3 col lg */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {STATUS_COLS.map(col => {
          const colTasks = byStatus(col.id);
          return (
            <div key={col.id} className="flex flex-col min-h-[200px]">
              <div className={`flex items-center gap-2 mb-3 pb-2 border-b-2 ${col.color}`}>
                <span className="text-sm font-bold text-[var(--text)]">{col.label}</span>
                <span className="badge badge-pending">{colTasks.length}</span>
              </div>
              <div className="flex-1">
                {loading ? (
                  <div className="space-y-2">
                    {[...Array(2)].map((_, i) => (
                      <div key={i} className="card h-20 animate-pulse bg-[var(--surface-2)]"/>
                    ))}
                  </div>
                ) : colTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-20 text-xs text-[var(--text-2)] opacity-40">
                    <Circle size={18} className="mb-1"/> No tasks
                  </div>
                ) : (
                  colTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                      currentUser={user}
                      isOwner={isOwner}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showCreate && (
        <CreateTaskModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
          teamId={activeTeam.id}
          members={teamMembers}
        />
      )}

      {deleteConfirm && (
        <DeleteTaskModal
          task={deleteConfirm}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
