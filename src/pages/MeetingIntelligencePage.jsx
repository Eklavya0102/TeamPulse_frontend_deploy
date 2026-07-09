// src/pages/MeetingIntelligencePage.jsx
// Fix: Tasks NOT auto-added — user sees extracted tasks and manually adds with assignee picker
// Fix: Better AI extraction with full person names and context
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import useStore from "../store/useStore";
import { knowledgeApi, tasksApi } from "../services/api";
import {
  Upload, FileText, ClipboardList, Sparkles, CheckCircle,
  User, Clock, ChevronRight, Plus, Loader2,
  FileUp, Type, X, AlertTriangle, Check, UserCircle,
} from "lucide-react";
import toast from "react-hot-toast";

const PRIORITY_COLORS = {
  critical: "border-l-rose-500 bg-rose-50/30 dark:bg-rose-900/10",
  high:     "border-l-red-400  bg-red-50/30  dark:bg-red-900/10",
  medium:   "border-l-amber-400 bg-amber-50/30 dark:bg-amber-900/10",
  low:      "border-l-green-400 bg-green-50/30 dark:bg-green-900/10",
};

const PRIORITY_BADGE = {
  critical: "badge-critical", high: "badge-high",
  medium:   "badge-medium",   low:  "badge-low",
};

// ── Add Task Modal with assignee picker ───────────────────────
function AddTaskModal({ task, teamMembers, onAdd, onClose }) {
  const [form, setForm] = useState({
    title:       task.title || "",
    description: task.description || "",
    priority:    task.priority || "medium",
    assigneeId:  task.assigneeId || "",
    deadline:    task.deadline ? task.deadline.split("T")[0] : "",
    deadlineText: task.deadlineText || task.deadline_text || "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    try {
      await onAdd(form);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error || "Failed to add task");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-5 sm:p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-100 dark:bg-brand-900/30 rounded-lg flex items-center justify-center">
              <Plus size={16} className="text-brand-600"/>
            </div>
            <h3 className="text-sm font-bold text-[var(--text)]">Add Task to Board</h3>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={15}/></button>
        </div>

        {/* AI confidence badge */}
        {task.confidence && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-900/30">
            <Sparkles size={13} className="text-purple-600 shrink-0"/>
            <span className="text-xs text-purple-700 dark:text-purple-400">
              AI confidence: {Math.round(task.confidence * 100)}% — review and adjust before adding
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[var(--text-2)] mb-1.5 block uppercase tracking-wide">Title *</label>
            <input
              className="input"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--text-2)] mb-1.5 block uppercase tracking-wide">Description</label>
            <textarea
              className="input resize-none"
              rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Task details and context…"
            />
          </div>

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
              <label className="text-xs font-semibold text-[var(--text-2)] mb-1.5 block uppercase tracking-wide">
                Deadline
                {form.deadlineText && (
                  <span className="ml-1 font-normal normal-case text-brand-500">({form.deadlineText})</span>
                )}
              </label>
              <input type="date" className="input text-sm"
                value={form.deadline}
                onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}/>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--text-2)] mb-1.5 block uppercase tracking-wide">
              Assign To
              {task.assigneeName && (
                <span className="ml-1 font-normal normal-case text-amber-600">
                  · AI detected: "{task.assigneeName}"
                </span>
              )}
            </label>
            <select className="input text-sm" value={form.assigneeId}
              onChange={e => setForm(f => ({ ...f, assigneeId: e.target.value }))}>
              <option value="">Unassigned</option>
              {(teamMembers || []).map(m => (
                <option key={m.userId} value={m.userId}>
                  {m.user?.displayName || m.user?.email}
                </option>
              ))}
            </select>
            {task.assigneeName && !form.assigneeId && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertTriangle size={11}/>
                AI detected assignee "{task.assigneeName}" — please select from the list above
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? "Adding…" : <><Plus size={14}/> Add to Board</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Extracted task card ───────────────────────────────────────
function ExtractedTaskCard({ task, onOpenAdd, added }) {
  return (
    <div className={`card p-4 border-l-4 transition-all ${
      added ? "opacity-50 border-l-green-500" : PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium
    }`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`badge ${PRIORITY_BADGE[task.priority]}`}>{task.priority}</span>
            {task.confidence && (
              <span className="badge bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400">
                <Sparkles size={9}/> {Math.round(task.confidence * 100)}%
              </span>
            )}
            {added && (
              <span className="badge bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                <Check size={9}/> Added
              </span>
            )}
          </div>

          <p className="text-sm font-semibold text-[var(--text)] mb-1">{task.title}</p>

          {task.description && (
            <p className="text-xs text-[var(--text-2)] leading-relaxed mb-2">{task.description}</p>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {task.assigneeName && (
              <span className="flex items-center gap-1 text-xs text-[var(--text-2)]">
                <UserCircle size={12} className="text-brand-500"/>
                <span className="font-medium text-[var(--text)]">{task.assigneeName}</span>
              </span>
            )}
            {(task.deadlineText || task.deadline_text) && (
              <span className="flex items-center gap-1 text-xs text-[var(--text-2)]">
                <Clock size={11}/>
                {task.deadlineText || task.deadline_text}
              </span>
            )}
          </div>

          {task.follow_up?.length > 0 && (
            <div className="mt-2 pt-2 border-t border-[var(--border)]">
              <p className="text-[10px] font-semibold text-[var(--text-2)] uppercase tracking-wide mb-1">Follow-up suggestions</p>
              {task.follow_up.slice(0, 2).map((s, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-[var(--text-2)]">
                  <ChevronRight size={10} className="mt-0.5 shrink-0 text-brand-400"/>
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => onOpenAdd(task)}
          disabled={added}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            added
              ? "bg-green-100 text-green-700 dark:bg-green-900/20 cursor-default"
              : "btn-primary"
          }`}
        >
          {added ? <><CheckCircle size={12}/> Added</> : <><Plus size={12}/> Add</>}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function MeetingIntelligencePage() {
  const { activeTeam, addTask, teamMembers } = useStore();
  const [mode,         setMode]         = useState("paste");
  const [pasteText,    setPasteText]    = useState("");
  const [pasteTitle,   setPasteTitle]   = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [processing,   setProcessing]   = useState(false);
  const [result,       setResult]       = useState(null);
  const [addedTasks,   setAddedTasks]   = useState(new Set());
  const [addModal,     setAddModal]     = useState(null); // task to add

  const onDrop = useCallback((files) => {
    if (files[0]) setUploadedFile(files[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    maxFiles: 1,
    maxSize: 16 * 1024 * 1024,
  });

  const handleProcess = async () => {
    if (!activeTeam) return;
    if (mode === "paste" && !pasteText.trim()) { toast.error("Please paste some text"); return; }
    if (mode === "upload" && !uploadedFile)    { toast.error("Please upload a file"); return; }

    setProcessing(true);
    setResult(null);
    setAddedTasks(new Set());

    try {
      let r;
      if (mode === "paste") {
        r = await knowledgeApi.pasteContent(activeTeam.id, pasteTitle || "Meeting Notes", pasteText);
      } else {
        const fd = new FormData();
        fd.append("file", uploadedFile);
        fd.append("title", uploadedFile.name);
        r = await knowledgeApi.upload(activeTeam.id, fd);
      }

      setResult(r.data);

      if (r.data.aiError) {
        toast.error(`AI issue: ${r.data.aiError}`, { duration: 6000 });
      } else {
        const count = r.data.tasks?.length || 0;
        if (count > 0) {
          toast.success(`Found ${count} task${count > 1 ? "s" : ""}! Review and add them below.`);
        } else {
          toast("No tasks detected. Try pasting text with clear action items.", { icon: "💡" });
        }
      }
    } catch (e) {
      toast.error(e.response?.data?.error || "Processing failed");
      if (e.response?.data?.item) setResult(e.response.data);
    } finally {
      setProcessing(false);
    }
  };

  // Called from AddTaskModal — actually saves to DB
  const handleAddTask = async (formData) => {
    const r = await tasksApi.create(activeTeam.id, {
      title:       formData.title,
      description: formData.description,
      priority:    formData.priority,
      assigneeId:  formData.assigneeId,
      deadline:    formData.deadline,
      deadlineText: formData.deadlineText,
      source:      "ai_extracted",
    });
    addTask(r.data.task);
    // Mark the original task as added using its title as key
    setAddedTasks(prev => new Set([...prev, addModal?.title]));
    toast.success("Task added to board!");
  };

  const handleAddAll = async () => {
    const pending = (result?.tasks || []).filter(t => !addedTasks.has(t.title));
    if (pending.length === 0) { toast("All tasks already added!"); return; }

    let added = 0;
    for (const task of pending) {
      try {
        const r = await tasksApi.create(activeTeam.id, {
          title:       task.title,
          description: task.description,
          priority:    task.priority,
          assigneeId:  task.assigneeId,
          deadline:    task.deadline,
          deadlineText: task.deadlineText || task.deadline_text,
          source:      "ai_extracted",
        });
        addTask(r.data.task);
        setAddedTasks(prev => new Set([...prev, task.title]));
        added++;
      } catch {}
    }
    toast.success(`Added ${added} task${added > 1 ? "s" : ""} to board!`);
  };

  const handleReset = () => {
    setResult(null);
    setPasteText("");
    setPasteTitle("");
    setUploadedFile(null);
    setAddedTasks(new Set());
  };

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 bg-brand-600 rounded-xl flex items-center justify-center">
            <Sparkles size={17} className="text-white"/>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-[var(--text)]">Meeting Intelligence</h2>
        </div>
        <p className="text-xs sm:text-sm text-[var(--text-2)] ml-10 sm:ml-[42px]">
          Paste meeting notes or upload a file — AI extracts tasks with assignees and deadlines. You review and decide which to add.
        </p>
      </div>

      {!result ? (
        <div className="space-y-4">
          {/* Mode tabs */}
          <div className="flex rounded-xl bg-[var(--surface-2)] p-1 w-fit">
            <button
              onClick={() => setMode("paste")}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === "paste" ? "bg-[var(--surface)] shadow-sm text-[var(--text)]" : "text-[var(--text-2)]"
              }`}
            >
              <Type size={13}/> Paste Text
            </button>
            <button
              onClick={() => setMode("upload")}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === "upload" ? "bg-[var(--surface)] shadow-sm text-[var(--text)]" : "text-[var(--text-2)]"
              }`}
            >
              <FileUp size={13}/> Upload File
            </button>
          </div>

          {/* Input area */}
          <div className="card p-4 sm:p-6">
            {mode === "paste" ? (
              <div className="space-y-3">
                <input
                  className="input"
                  placeholder="Title (e.g. Sprint Planning — May 2025)"
                  value={pasteTitle}
                  onChange={e => setPasteTitle(e.target.value)}
                />
                <textarea
                  className="input resize-none font-mono text-xs sm:text-sm"
                  rows={10}
                  placeholder={`Paste meeting notes, chat transcript, or discussion text here…\n\nExample:\n"Asmi will finish the login page by Friday noon.\nArjun needs to handle the marketing strategy."`}
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                />
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                  isDragActive
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                    : "border-[var(--border)] hover:border-brand-400 hover:bg-[var(--surface-2)]"
                }`}
              >
                <input {...getInputProps()}/>
                {uploadedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText size={32} className="text-brand-600"/>
                    <p className="text-sm font-semibold text-[var(--text)]">{uploadedFile.name}</p>
                    <p className="text-xs text-[var(--text-2)]">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                    <button
                      onClick={e => { e.stopPropagation(); setUploadedFile(null); }}
                      className="text-xs text-red-500 hover:underline flex items-center gap-1 mt-1"
                    >
                      <X size={11}/> Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 bg-brand-50 dark:bg-brand-900/20 rounded-2xl flex items-center justify-center">
                      <Upload size={24} className="text-brand-600"/>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {isDragActive ? "Drop here!" : "Drop your file or click to browse"}
                      </p>
                      <p className="text-xs text-[var(--text-2)] mt-1">PDF, DOCX, TXT — up to 16 MB</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleProcess}
            disabled={processing || (mode === "paste" ? !pasteText.trim() : !uploadedFile)}
            className="btn-primary w-full justify-center py-3 text-sm sm:text-base"
          >
            {processing ? (
              <><Loader2 size={18} className="animate-spin"/> Processing with AI…</>
            ) : (
              <><Sparkles size={18}/> Extract Tasks &amp; Insights</>
            )}
          </button>
        </div>
      ) : (
        /* Results */
        <div className="space-y-5 animate-slide-up">
          {/* Summary */}
          {result.summary?.summary && (
            <div className="card p-4 sm:p-5 border-l-4 border-l-brand-500 ai-glow">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={15} className="text-brand-600"/>
                <h3 className="text-sm font-bold text-[var(--text)]">AI Summary</h3>
              </div>
              <p className="text-sm text-[var(--text)] leading-relaxed mb-4">{result.summary.summary}</p>

              {result.summary.key_points?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-bold text-[var(--text-2)] uppercase tracking-wider mb-2">Key Points</p>
                  <ul className="space-y-1.5">
                    {result.summary.key_points.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[var(--text)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0"/>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.summary.decisions?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-[var(--text-2)] uppercase tracking-wider mb-2">Decisions Made</p>
                  <ul className="space-y-1.5">
                    {result.summary.decisions.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[var(--text)]">
                        <CheckCircle size={13} className="text-green-500 mt-0.5 shrink-0"/>
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Extracted tasks */}
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ClipboardList size={16} className="text-[var(--text-2)]"/>
                <h3 className="text-sm font-bold text-[var(--text)]">
                  Extracted Tasks ({result.tasks?.length || 0})
                </h3>
                <span className="text-xs text-[var(--text-2)]">— review and add to your board</span>
              </div>
              <div className="flex gap-2">
                {result.tasks?.length > 0 && (
                  <button onClick={handleAddAll} className="btn-primary text-xs py-1.5 gap-1.5">
                    <Plus size={12}/> Add All
                  </button>
                )}
                <button onClick={handleReset} className="btn-secondary text-xs py-1.5">
                  ← Process New
                </button>
              </div>
            </div>

            {result.tasks?.length === 0 ? (
              <div className="card p-8 text-center">
                <AlertTriangle size={28} className="mx-auto text-amber-400 mb-2"/>
                <p className="text-sm font-semibold text-[var(--text)]">No tasks detected</p>
                <p className="text-xs text-[var(--text-2)] mt-1">
                  Try using more specific language like "John will finish X by Friday"
                </p>
                <button onClick={handleReset} className="btn-secondary text-xs mt-4">Try again</button>
              </div>
            ) : (
              <div className="space-y-3">
                {result.tasks.map((task, i) => (
                  <ExtractedTaskCard
                    key={i}
                    task={task}
                    onOpenAdd={(t) => setAddModal(t)}
                    added={addedTasks.has(task.title)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add task modal with assignee picker */}
      {addModal && (
        <AddTaskModal
          task={addModal}
          teamMembers={teamMembers}
          onAdd={handleAddTask}
          onClose={() => setAddModal(null)}
        />
      )}
    </div>
  );
}
