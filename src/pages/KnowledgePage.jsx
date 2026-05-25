// src/pages/KnowledgePage.jsx
import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import useStore from "../store/useStore";
import { knowledgeApi } from "../services/api";
import { format, parseISO } from "date-fns";
import {
  Search, Upload, FileText, Trash2, Sparkles, Loader2,
  BookOpen, MessageCircleQuestion, X, FileCheck, Database
} from "lucide-react";
import toast from "react-hot-toast";

const FILE_ICONS = {
  pdf:   { icon: "📄", color: "bg-red-100 dark:bg-red-900/20 text-red-600" },
  docx:  { icon: "📝", color: "bg-blue-100 dark:bg-blue-900/20 text-blue-600" },
  txt:   { icon: "📃", color: "bg-gray-100 dark:bg-gray-800 text-gray-600" },
  paste: { icon: "📋", color: "bg-purple-100 dark:bg-purple-900/20 text-purple-600" },
};

function KnowledgeCard({ item, onDelete }) {
  const fi = FILE_ICONS[item.fileType] || FILE_ICONS.txt;
  return (
    <div className="card p-4 group hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 ${fi.color}`}>
          {fi.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text)] truncate">{item.title}</p>
          {item.summary && (
            <p className="text-xs text-[var(--text-2)] mt-0.5 line-clamp-2">{item.summary}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="badge bg-[var(--surface-2)] text-[var(--text-2)] border border-[var(--border)] uppercase text-[10px]">
              {item.fileType}
            </span>
            {item.processingStatus === "done" && (
              <span className="badge bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                <FileCheck size={9} /> Indexed
              </span>
            )}
            <span className="text-[10px] text-[var(--text-2)]">
              {item.createdAt ? format(parseISO(item.createdAt), "MMM d, yyyy") : ""}
            </span>
          </div>
          {item.keyPoints?.length > 0 && (
            <div className="mt-2 pt-2 border-t border-[var(--border)]">
              <p className="text-[10px] font-medium text-[var(--text-2)] uppercase tracking-wider mb-1">Key Points</p>
              <ul className="space-y-0.5">
                {item.keyPoints.slice(0, 3).map((p, i) => (
                  <li key={i} className="text-xs text-[var(--text-2)] flex items-start gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-brand-400 mt-1.5 shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <button
          onClick={() => onDelete(item.id)}
          className="opacity-0 group-hover:opacity-100 text-[var(--text-2)] hover:text-red-500 transition-all shrink-0"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default function KnowledgePage() {
  const { activeTeam, knowledgeItems, setKnowledgeItems, addKnowledgeItem, removeKnowledgeItem } = useStore();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState("library"); // library | search

  const loadItems = async () => {
    if (!activeTeam) return;
    setLoading(true);
    try {
      const [itemsR, statsR] = await Promise.all([
        knowledgeApi.list(activeTeam.id),
        knowledgeApi.stats(activeTeam.id)
      ]);
      setKnowledgeItems(itemsR.data.items);
      setStats(statsR.data);
    } catch (e) {
      toast.error("Failed to load knowledge base");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadItems(); }, [activeTeam?.id]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (files) => {
      if (!files[0] || !activeTeam) return;
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", files[0]);
        fd.append("title", files[0].name);
        const r = await knowledgeApi.upload(activeTeam.id, fd);
        addKnowledgeItem(r.data.item);
        toast.success(`"${files[0].name}" uploaded & indexed!`);
        if (r.data.tasksExtracted > 0) {
          toast.success(`🎯 ${r.data.tasksExtracted} tasks extracted!`);
        }
      } catch (e) {
        toast.error(e.response?.data?.error || "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"]
    },
    maxSize: 16 * 1024 * 1024,
    maxFiles: 1,
  });

  const handleSearch = async () => {
    if (!searchQuery.trim() || !activeTeam) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const r = await knowledgeApi.search(activeTeam.id, searchQuery);
      setSearchResult(r.data);
    } catch (e) {
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleDelete = async (itemId) => {
    if (!confirm("Remove this document from the knowledge base?")) return;
    try {
      await knowledgeApi.delete(activeTeam.id, itemId);
      removeKnowledgeItem(itemId);
      toast.success("Document removed");
    } catch (e) {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[var(--text)]">Knowledge Base</h2>
          <p className="text-sm text-[var(--text-2)]">
            {stats ? `${stats.totalItems} documents · ${stats.vectorStats?.totalVectors || 0} vectors indexed` : "Loading…"}
          </p>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "PDFs", value: stats.byType?.pdf || 0, color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/10" },
            { label: "Documents", value: stats.byType?.docx || 0, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/10" },
            { label: "Text Files", value: stats.byType?.txt || 0, color: "text-gray-500", bg: "bg-gray-50 dark:bg-gray-900/10" },
            { label: "Pastes", value: stats.byType?.paste || 0, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/10" },
          ].map(s => (
            <div key={s.label} className={`card p-3 flex items-center gap-3 ${s.bg}`}>
              <Database size={18} className={s.color} />
              <div>
                <p className="text-lg font-bold text-[var(--text)]">{s.value}</p>
                <p className="text-xs text-[var(--text-2)]">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex rounded-xl bg-[var(--surface-2)] p-1 w-fit mb-5">
        <button onClick={() => setActiveTab("library")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "library" ? "bg-[var(--surface)] shadow-sm text-[var(--text)]" : "text-[var(--text-2)]"
          }`}>
          <BookOpen size={14} /> Library
        </button>
        <button onClick={() => setActiveTab("search")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "search" ? "bg-[var(--surface)] shadow-sm text-[var(--text)]" : "text-[var(--text-2)]"
          }`}>
          <Sparkles size={14} /> AI Search
        </button>
      </div>

      {activeTab === "library" ? (
        <div className="space-y-5">
          {/* Upload drop zone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              isDragActive ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20" :
              uploading ? "border-brand-400 bg-brand-50 dark:bg-brand-900/10" :
              "border-[var(--border)] hover:border-brand-400 hover:bg-[var(--surface-2)]"
            }`}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <div className="flex items-center justify-center gap-3">
                <Loader2 size={22} className="animate-spin text-brand-600" />
                <div>
                  <p className="text-sm font-medium text-[var(--text)]">Processing with AI…</p>
                  <p className="text-xs text-[var(--text-2)]">Extracting text, generating summary, indexing for search</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-4">
                <div className="w-10 h-10 bg-brand-50 dark:bg-brand-900/20 rounded-xl flex items-center justify-center shrink-0">
                  <Upload size={20} className="text-brand-600" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-[var(--text)]">
                    {isDragActive ? "Drop to upload" : "Upload a document"}
                  </p>
                  <p className="text-xs text-[var(--text-2)]">PDF, DOCX, TXT — AI will summarize & index automatically</p>
                </div>
              </div>
            )}
          </div>

          {/* Library grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="card h-32 animate-pulse bg-[var(--surface-2)]" />
              ))}
            </div>
          ) : knowledgeItems.length === 0 ? (
            <div className="card p-12 text-center">
              <BookOpen size={36} className="mx-auto text-[var(--text-2)] mb-3" />
              <p className="text-sm font-medium text-[var(--text)]">Knowledge base is empty</p>
              <p className="text-xs text-[var(--text-2)] mt-1">Upload your first document to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {knowledgeItems.map(item => (
                <KnowledgeCard key={item.id} item={item} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* AI Search tab */
        <div className="space-y-5">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-brand-600" />
              <h3 className="text-sm font-semibold text-[var(--text)]">Ask your knowledge base</h3>
            </div>
            <p className="text-xs text-[var(--text-2)] mb-4">
              Ask any question — AI will search your documents and provide a grounded answer with sources.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MessageCircleQuestion size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-2)]" />
                <input
                  className="input pl-9"
                  placeholder='e.g. "What was our decision about payment integration?"'
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                />
              </div>
              <button onClick={handleSearch} disabled={searching || !searchQuery.trim()} className="btn-primary px-5">
                {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </button>
            </div>

            {/* Example questions */}
            <div className="flex flex-wrap gap-2 mt-3">
              {[
                "What are the key decisions made?",
                "What are the upcoming deadlines?",
                "Who is responsible for the API?",
              ].map(q => (
                <button
                  key={q}
                  onClick={() => { setSearchQuery(q); }}
                  className="badge bg-[var(--surface-2)] text-[var(--text-2)] border border-[var(--border)] cursor-pointer hover:text-brand-600 hover:border-brand-300 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Search result */}
          {searchResult && (
            <div className="space-y-4 animate-slide-up">
              {/* AI Answer */}
              <div className="card p-5 border-l-4 border-l-brand-500 ai-glow">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={15} className="text-brand-600" />
                  <span className="text-xs font-semibold text-brand-600">AI Answer</span>
                  {searchResult.confidence && (
                    <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-900/20 ml-auto">
                      {Math.round(searchResult.confidence * 100)}% confidence
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--text)] leading-relaxed">{searchResult.answer}</p>

                {searchResult.sources?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[var(--border)]">
                    <p className="text-xs text-[var(--text-2)] mb-1.5">Sources:</p>
                    <div className="flex flex-wrap gap-2">
                      {searchResult.sources.map((s, i) => (
                        <span key={i} className="badge bg-[var(--surface-2)] text-[var(--text-2)] border border-[var(--border)]">
                          <FileText size={10} /> {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Relevant docs */}
              {searchResult.relevantDocs?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wider mb-2">Relevant Documents</p>
                  <div className="space-y-2">
                    {searchResult.relevantDocs.map((doc, i) => (
                      <div key={i} className="card p-3 flex items-start gap-3">
                        <FileText size={15} className="text-[var(--text-2)] shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-[var(--text)]">{doc.title}</p>
                          <p className="text-xs text-[var(--text-2)] mt-0.5 line-clamp-2">{doc.content}</p>
                          <p className="text-[10px] text-brand-600 mt-1">
                            Relevance: {Math.round((doc.score || 0) * 100)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={() => setSearchResult(null)} className="btn-ghost text-xs">
                Clear results
              </button>
            </div>
          )}

          {knowledgeItems.length === 0 && (
            <div className="card p-8 text-center">
              <BookOpen size={28} className="mx-auto text-[var(--text-2)] mb-2" />
              <p className="text-sm text-[var(--text)]">No documents to search</p>
              <p className="text-xs text-[var(--text-2)]">Upload documents in the Library tab first</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
