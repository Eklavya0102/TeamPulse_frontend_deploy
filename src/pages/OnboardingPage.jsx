// src/pages/OnboardingPage.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { authApi } from "../services/api";
import useStore from "../store/useStore";
import { Brain, Plus, Users, ArrowRight, Copy } from "lucide-react";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { setTeams, setActiveTeam, addTeam, activeTeam } = useStore();
  const [tab,     setTab]     = useState("create");
  const [loading, setLoading] = useState(false);
  const [createdTeam, setCreatedTeam] = useState(null);
  const [form,    setForm]    = useState({ name: "", description: "" });
  const [inviteCode, setInviteCode] = useState("");

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const r      = await authApi.createTeam(form);
      const team   = r.data.team;
      const teamsR = await authApi.getMyTeams();
      setTeams(teamsR.data.teams);
      setActiveTeam(team);
      setCreatedTeam(team);
      toast.success(`Team "${team.name}" created!`);
    } catch (e) {
      toast.error(e.response?.data?.error || "Failed to create team");
    } finally { setLoading(false); }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setLoading(true);
    try {
      const r      = await authApi.joinTeam(inviteCode.trim());
      const team   = r.data.team;
      const teamsR = await authApi.getMyTeams();
      setTeams(teamsR.data.teams);
      setActiveTeam(team);
      toast.success(`Joined "${team.name}"!`);
      navigate("/");
    } catch (e) {
      toast.error(e.response?.data?.error || "Invalid invite code");
    } finally { setLoading(false); }
  };

  // Show invite code after team creation
  if (createdTeam) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-6">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🎉</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--text)] mb-2">Team created!</h1>
          <p className="text-[var(--text-2)] text-sm mb-6">
            Share this invite code with your teammates so they can join.
          </p>

          <div className="card p-5 mb-5">
            <p className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wider mb-2">Invite Code</p>
            <div className="flex items-center gap-3 bg-[var(--surface-2)] rounded-xl px-4 py-3">
              <span className="font-mono text-2xl font-bold text-brand-600 tracking-widest flex-1 text-center">
                {createdTeam.inviteCode}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(createdTeam.inviteCode);
                  toast.success("Copied!");
                }}
                className="btn-ghost p-2"
                title="Copy code"
              >
                <Copy size={16}/>
              </button>
            </div>
            <p className="text-xs text-[var(--text-2)] mt-2 text-center">
              Teammates go to the app → Join team → enter this code
            </p>
          </div>

          <button
            onClick={() => navigate("/")}
            className="btn-primary w-full justify-center py-3"
          >
            Go to Dashboard <ArrowRight size={16}/>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-brand">
            <Brain size={30} className="text-white"/>
          </div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Set up your workspace</h1>
          <p className="text-[var(--text-2)] text-sm mt-1">Create a team or join an existing one</p>
        </div>

        <div className="card p-6">
          {/* Tabs */}
          <div className="flex rounded-xl bg-[var(--surface-2)] p-1 mb-6">
            <button
              onClick={() => setTab("create")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === "create"
                  ? "bg-[var(--surface)] shadow-sm text-[var(--text)]"
                  : "text-[var(--text-2)]"
              }`}
            >
              <Plus size={14} className="inline mr-1.5"/> Create team
            </button>
            <button
              onClick={() => setTab("join")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === "join"
                  ? "bg-[var(--surface)] shadow-sm text-[var(--text)]"
                  : "text-[var(--text-2)]"
              }`}
            >
              <Users size={14} className="inline mr-1.5"/> Join team
            </button>
          </div>

          {tab === "create" ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-2)] mb-1.5 uppercase tracking-wide">
                  Team name *
                </label>
                <input
                  className="input"
                  placeholder="e.g. Product Squad, Engineering"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-2)] mb-1.5 uppercase tracking-wide">
                  Description <span className="font-normal normal-case">(optional)</span>
                </label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  placeholder="What does your team work on?"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
                {loading ? "Creating…" : <><span>Create team</span><ArrowRight size={16}/></>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-2)] mb-1.5 uppercase tracking-wide">
                  Invite Code
                </label>
                <input
                  className="input text-center tracking-[0.3em] text-xl font-mono font-bold uppercase"
                  placeholder="XXXXXXXX"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  required autoFocus
                />
                <p className="text-xs text-[var(--text-2)] mt-1.5 text-center">
                  Ask your team admin for the 8-character invite code
                </p>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
                {loading ? "Joining…" : <><span>Join team</span><ArrowRight size={16}/></>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
