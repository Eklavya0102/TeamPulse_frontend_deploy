// src/pages/ChatPage.jsx
// Fix: Duplicate messages - use ref-based socket, no module singleton
// Fix: Proper cleanup prevents double event handler registration
import { useEffect, useRef, useState, useCallback } from "react";
import useStore from "../store/useStore";
import { chatApi } from "../services/api";
import { getAppSocket } from "../services/socket";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import {
  Send, Plus, Hash, Sparkles, Loader2,
  BookOpen, X, Trash2, AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";


function formatDateDivider(dateStr) {
  try {
    const d = parseISO(dateStr);
    if (isToday(d))     return "Today";
    if (isYesterday(d)) return "Yesterday";
    return format(d, "MMMM d, yyyy");
  } catch { return ""; }
}

// ── Message bubble ─────────────────────────────────────────────
function Message({ msg, isOwn, showAvatar }) {
  const isAI = msg.messageType === "ai_summary";

  if (isAI) {
    return (
      <div className="flex gap-2.5 my-3 animate-slide-up">
        <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center shrink-0">
          <Sparkles size={13} className="text-white"/>
        </div>
        <div className="max-w-[80%]">
          <p className="text-xs text-brand-600 font-semibold mb-1">AI Summary</p>
          <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-2xl rounded-tl-sm px-4 py-3">
            <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
          </div>
        </div>
      </div>
    );
  }

  const letter = (msg.user?.displayName || "?")[0].toUpperCase();
  const colors = ["bg-brand-500","bg-purple-500","bg-green-500","bg-pink-500","bg-amber-500"];
  const color  = colors[letter.charCodeAt(0) % colors.length];
  const isPending = msg.id?.startsWith("temp_");

  return (
    <div className={`flex gap-2 mb-1 ${isOwn ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div className="w-7 shrink-0 self-end">
        {showAvatar && !isOwn && (
          <div className={`w-7 h-7 rounded-full ${color} flex items-center justify-center text-xs font-bold text-white`}>
            {letter}
          </div>
        )}
      </div>

      <div className={`max-w-[72%] flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
        {showAvatar && !isOwn && (
          <p className="text-[10px] text-[var(--text-2)] mb-0.5 px-1">
            {msg.user?.displayName || "Unknown"}
          </p>
        )}
        <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words max-w-full ${
          isOwn
            ? `bg-brand-600 text-white rounded-tr-sm ${isPending ? "opacity-60" : ""}`
            : "bg-[var(--surface-2)] text-[var(--text)] rounded-tl-sm"
        }`}>
          {msg.content}
        </div>
        <p className="text-[10px] text-[var(--text-2)] mt-0.5 px-1">
          {msg.createdAt ? format(parseISO(msg.createdAt), "h:mm a") : ""}
          {isPending && " · sending…"}
        </p>
      </div>
    </div>
  );
}

// ── Create room modal ─────────────────────────────────────────
function CreateRoomModal({ onClose, onCreated, teamId }) {
  const [name, setName]     = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const r = await chatApi.createRoom(teamId, { name: name.trim() });
      onCreated(r.data.room);
      toast.success(`#${r.data.room.name} created!`);
      onClose();
    } catch { toast.error("Failed to create channel"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-5 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-[var(--text)]">New Channel</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={15}/></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-2)]"/>
            <input
              className="input pl-8"
              placeholder="channel-name"
              value={name}
              onChange={e => setName(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
              required autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center text-xs">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center text-xs">
              {loading ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete room modal ─────────────────────────────────────────
function DeleteRoomModal({ room, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false);
  const handleDelete = async () => {
    setLoading(true);
    try {
      await chatApi.deleteRoom(room.id);
      onDeleted(room.id);
      toast.success(`#${room.name} deleted`);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error || "Failed to delete channel");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-5 animate-slide-up">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
            <AlertTriangle size={18} className="text-red-600"/>
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text)]">Delete #{room.name}?</h3>
            <p className="text-xs text-[var(--text-2)]">All messages will be permanently deleted</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center text-sm">Cancel</button>
          <button onClick={handleDelete} disabled={loading} className="btn-danger flex-1 justify-center text-sm">
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ChatPage ─────────────────────────────────────────────
export default function ChatPage() {
  const {
    activeTeam, user,
    rooms, setRooms,
    activeRoom, setActiveRoom,
    messages, setMessages, addMessage,
  } = useStore();

  const [input,            setInput]            = useState("");
  const [typing,           setTyping]           = useState([]);
  const [catchUpLoading,   setCatchUpLoading]   = useState(false);
  const [summarizeLoading, setSummarizeLoading] = useState(false);
  const [showCreate,       setShowCreate]       = useState(false);
  const [deleteRoom,       setDeleteRoom]       = useState(null);
  const [connected,        setConnected]        = useState(false);
  const [isOwner,          setIsOwner]          = useState(false);

  const bottomRef    = useRef(null);
  const typingTimer  = useRef(null);
  const inputRef     = useRef(null);
  // KEY FIX: ref-based socket, not module-level singleton
  const socketRef    = useRef(null);
  // Track sent tempIds so we can dedup server echo
  const sentTempIds  = useRef(new Set());

  // Check ownership
  useEffect(() => {
    if (!activeTeam || !user) return;
    setIsOwner(activeTeam.createdBy === user.id);
  }, [activeTeam?.id, user?.id]);

  // Reload rooms on team switch
  useEffect(() => {
    if (!activeTeam) return;
    setRooms([]);
    setActiveRoom(null);
    setMessages([]);

    chatApi.getRooms(activeTeam.id)
      .then(r => {
        setRooms(r.data.rooms);
        if (r.data.rooms.length > 0) selectRoom(r.data.rooms[0]);
      })
      .catch(() => {});
  }, [activeTeam?.id]);

  // Socket setup — one socket per ChatPage mount, cleaned up on unmount
  useEffect(() => {
    if (!user?.id) return;

    // Create fresh socket and store in ref so selectRoom/handleSend can use it
    const sock = getAppSocket();
    socketRef.current = sock;

    // Singleton may already be connected — set state immediately
    if (sock.connected) setConnected(true);

    const handleConnect = () => {
      setConnected(true);
      // Re-join current room after reconnect
      if (activeRoom?.id) {
        sock.emit("join_room", { roomId: activeRoom.id, userId: user.id });
      }
    };
    const handleDisconnect = () => setConnected(false);

    sock.on("connect", handleConnect);
    sock.on("disconnect", handleDisconnect);

    // FIX: Only ONE handler for new_message
    const handleNewMessage = (msg) => {
      // If we sent this message (has our tempId), replace the optimistic one
      if (msg.tempId && sentTempIds.current.has(msg.tempId)) {
        sentTempIds.current.delete(msg.tempId);
        setMessages(prev =>
          prev.map(m => m.id === msg.tempId ? { ...msg } : m)
        );
        return; // do NOT add as new message
      }

      // Otherwise add as new (from another user)
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev; // dedup by real ID
        return [...prev, msg];
      });
    };

    sock.on("new_message", handleNewMessage);

    const handleTyping = ({ userId, userName, isTyping }) => {
      if (userId === user.id) return;
      setTyping(prev =>
        isTyping
          ? [...prev.filter(n => n !== userName), userName]
          : prev.filter(n => n !== userName)
      );
    };
    sock.on("user_typing", handleTyping);

    // Cleanup: only remove listeners, keep shared socket alive
    return () => {
      sock.off("connect",    handleConnect);
      sock.off("disconnect", handleDisconnect);
      sock.off("new_message", handleNewMessage);
      sock.off("user_typing", handleTyping);
    };
  }, [user?.id]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectRoom = async (room) => {
    const sock = socketRef.current;
    if (activeRoom?.id && sock) {
      sock.emit("leave_room", { roomId: activeRoom.id, userId: user?.id });
    }
    setActiveRoom(room);
    setMessages([]);
    try {
      const r = await chatApi.getMessages(room.id, { limit: 60 });
      setMessages(r.data.messages);
    } catch {}
    if (sock) {
      sock.emit("join_room", { roomId: room.id, userId: user?.id });
    }
    inputRef.current?.focus();
  };

  // FIX: Send message — track tempId in sentTempIds ref
  const handleSend = useCallback(() => {
    const content = input.trim();
    if (!content || !activeRoom || !user) return;
    setInput("");

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Track this tempId as "sent by me"
    sentTempIds.current.add(tempId);

    // Add optimistic message immediately
    addMessage({
      id: tempId,
      roomId: activeRoom.id,
      userId: user.id,
      user,
      content,
      messageType: "text",
      createdAt: new Date().toISOString(),
    });

    // Emit to server
    const sock = socketRef.current;
    if (sock) {
      sock.emit("send_message", {
        roomId: activeRoom.id,
        userId: user.id,
        content,
        tempId,
      });
    }

    // Clear typing indicator
    clearTimeout(typingTimer.current);
    if (sock) {
      sock.emit("typing", {
        roomId: activeRoom.id,
        userId: user.id,
        userName: user.displayName,
        isTyping: false,
      });
    }
  }, [input, activeRoom, user]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
    const sock = socketRef.current;
    if (sock && activeRoom) {
      sock.emit("typing", {
        roomId: activeRoom.id,
        userId: user?.id,
        userName: user?.displayName,
        isTyping: true,
      });
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        sock.emit("typing", {
          roomId: activeRoom.id,
          userId: user?.id,
          userName: user?.displayName,
          isTyping: false,
        });
      }, 2000);
    }
  };

  const handleCatchUp = async () => {
    if (!activeRoom) return;
    setCatchUpLoading(true);
    try {
      const r = await chatApi.catchMeUp(activeRoom.id);
      addMessage({
        id: `catchup_${Date.now()}`,
        roomId: activeRoom.id,
        content: r.data.summary,
        messageType: "ai_summary",
        createdAt: new Date().toISOString(),
      });
      toast.success("Caught up!");
    } catch (e) {
      toast.error(e.response?.data?.error || "AI unavailable");
    } finally { setCatchUpLoading(false); }
  };

  const handleSummarize = async () => {
    if (!activeRoom) return;
    setSummarizeLoading(true);
    try {
      const r = await chatApi.summarize(activeRoom.id);
      const text = [
        r.data.summary,
        r.data.key_points?.length ? "\nKey Points:\n" + r.data.key_points.map(p => `• ${p}`).join("\n") : "",
      ].filter(Boolean).join("");
      addMessage({
        id: `summary_${Date.now()}`,
        roomId: activeRoom.id,
        content: text,
        messageType: "ai_summary",
        createdAt: new Date().toISOString(),
      });
      toast.success("Summarized!");
    } catch (e) {
      toast.error(e.response?.data?.error || "AI unavailable");
    } finally { setSummarizeLoading(false); }
  };

  const handleRoomDeleted = (roomId) => {
    const remaining = rooms.filter(r => r.id !== roomId);
    setRooms(remaining);
    if (activeRoom?.id === roomId) {
      if (remaining.length > 0) selectRoom(remaining[0]);
      else { setActiveRoom(null); setMessages([]); }
    }
  };

  // Group messages for avatar display
  const groupedMessages = messages.map((msg, i) => {
    const prev = messages[i - 1];
    const showAvatar = !prev || prev.userId !== msg.userId ||
      (new Date(msg.createdAt) - new Date(prev.createdAt)) > 5 * 60 * 1000;
    return { ...msg, showAvatar };
  });

  return (
    <div className="flex h-full animate-fade-in overflow-hidden">
      {/* Rooms sidebar */}
      <div className="w-44 sm:w-52 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col">
        <div className="px-3 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <span className="text-xs font-bold text-[var(--text-2)] uppercase tracking-wider">Channels</span>
          <button onClick={() => setShowCreate(true)} className="btn-ghost p-1.5" title="New channel">
            <Plus size={14}/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-none py-1.5 px-2 space-y-0.5">
          {rooms.map(room => (
            <div key={room.id} className="flex items-center gap-1 group">
              <button
                onClick={() => selectRoom(room)}
                className={`sidebar-item flex-1 ${activeRoom?.id === room.id ? "active" : ""}`}
              >
                <Hash size={14} className="shrink-0"/>
                <span className="truncate text-xs sm:text-sm">{room.name}</span>
              </button>
              {isOwner && room.name !== "general" && (
                <button
                  onClick={() => setDeleteRoom(room)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-2)] hover:text-red-500 transition-all"
                  title="Delete channel"
                >
                  <Trash2 size={11}/>
                </button>
              )}
            </div>
          ))}
          {rooms.length === 0 && (
            <p className="text-xs text-[var(--text-2)] px-2 py-4 text-center">No channels</p>
          )}
        </div>

        <div className="px-3 py-2 border-t border-[var(--border)]">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-gray-400"}`}/>
            <span className="text-[10px] text-[var(--text-2)]">{connected ? "Live" : "Reconnecting…"}</span>
          </div>
        </div>
      </div>

      {/* Chat area */}
      {activeRoom ? (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <div className="h-14 border-b border-[var(--border)] bg-[var(--surface)] flex items-center justify-between px-3 sm:px-4 shrink-0">
            <div className="flex items-center gap-2">
              <Hash size={15} className="text-[var(--text-2)] shrink-0"/>
              <span className="text-sm font-bold text-[var(--text)]">{activeRoom.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleCatchUp}
                disabled={catchUpLoading}
                className="btn-ghost text-xs gap-1 px-2 py-1.5"
              >
                {catchUpLoading ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>}
                <span className="hidden sm:inline">Catch me up</span>
              </button>
              <button
                onClick={handleSummarize}
                disabled={summarizeLoading}
                className="btn-ghost text-xs gap-1 px-2 py-1.5"
              >
                {summarizeLoading ? <Loader2 size={12} className="animate-spin"/> : <BookOpen size={12}/>}
                <span className="hidden sm:inline">Summarize</span>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 scrollbar-none">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <Hash size={32} className="text-[var(--text-2)] mb-3 opacity-30"/>
                <p className="text-sm font-semibold text-[var(--text)]">#{activeRoom.name}</p>
                <p className="text-xs text-[var(--text-2)] mt-1">Start the conversation!</p>
              </div>
            )}

            {groupedMessages.map((msg, i) => {
              const prev   = groupedMessages[i - 1];
              const curDiv  = msg.createdAt ? formatDateDivider(msg.createdAt) : "";
              const prevDiv = prev?.createdAt ? formatDateDivider(prev.createdAt) : "";
              return (
                <div key={msg.id}>
                  {curDiv && curDiv !== prevDiv && (
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-[var(--border)]"/>
                      <span className="text-xs text-[var(--text-2)] font-semibold">{curDiv}</span>
                      <div className="flex-1 h-px bg-[var(--border)]"/>
                    </div>
                  )}
                  <Message msg={msg} isOwn={msg.userId === user?.id} showAvatar={msg.showAvatar}/>
                </div>
              );
            })}

            {typing.length > 0 && (
              <p className="text-xs text-[var(--text-2)] italic px-9 animate-pulse mt-1">
                {typing.join(", ")} {typing.length === 1 ? "is" : "are"} typing…
              </p>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Input */}
          <div className="px-3 sm:px-4 py-3 border-t border-[var(--border)] bg-[var(--surface)] shrink-0">
            <div className="flex items-end gap-2 bg-[var(--surface-2)] rounded-2xl border border-[var(--border)] px-3 py-2.5 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-400/20 transition-all">
              <textarea
                ref={inputRef}
                className="flex-1 bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--text-2)] resize-none outline-none min-h-[22px]"
                placeholder={`Message #${activeRoom.name}`}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                onInput={e => {
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shrink-0"
              >
                <Send size={14}/>
              </button>
            </div>
            <p className="text-[10px] text-[var(--text-2)] mt-1 px-1 hidden sm:block">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Hash size={36} className="mx-auto text-[var(--text-2)] mb-3 opacity-30"/>
            <p className="text-sm font-semibold text-[var(--text)]">Select a channel</p>
            <p className="text-xs text-[var(--text-2)] mt-1">or create a new one</p>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateRoomModal
          onClose={() => setShowCreate(false)}
          onCreated={(room) => { setRooms([...rooms, room]); selectRoom(room); }}
          teamId={activeTeam?.id}
        />
      )}

      {deleteRoom && (
        <DeleteRoomModal
          room={deleteRoom}
          onClose={() => setDeleteRoom(null)}
          onDeleted={handleRoomDeleted}
        />
      )}
    </div>
  );
}
