// src/pages/AnalyticsPage.jsx
import { useEffect, useState } from "react";
import useStore from "../store/useStore";
import { analyticsApi, aiApi } from "../services/api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import {
  TrendingUp, Users, CheckSquare, AlertCircle,
  Sparkles, Loader2, RefreshCw
} from "lucide-react";
import toast from "react-hot-toast";

const PIE_COLORS = ["#ef4444", "#f59e0b", "#6366f1", "#10b981"];
const PRIORITY_COLORS_MAP = { critical: "#ef4444", high: "#f59e0b", medium: "#6366f1", low: "#10b981" };

function MetricCard({ icon: Icon, label, value, sub, color = "brand" }) {
  const bg = { brand: "bg-brand-50 dark:bg-brand-900/20 text-brand-600", green: "bg-green-50 dark:bg-green-900/20 text-green-600", amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-600", red: "bg-red-50 dark:bg-red-900/20 text-red-600" };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-[var(--text-2)]">{label}</p>
          <p className="text-2xl font-bold text-[var(--text)] mt-0.5">{value}</p>
          {sub && <p className="text-xs text-[var(--text-2)] mt-0.5">{sub}</p>}
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bg[color]}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { activeTeam } = useStore();
  const [data, setData] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiRecs, setAiRecs] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const load = async () => {
    if (!activeTeam) return;
    setLoading(true);
    try {
      const [analyticsR, dashR] = await Promise.all([
        analyticsApi.analytics(activeTeam.id),
        analyticsApi.dashboard(activeTeam.id)
      ]);
      setData(analyticsR.data);
      setDashboard(dashR.data);
    } catch (e) {
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  const loadAiRecs = async () => {
    if (!activeTeam) return;
    setAiLoading(true);
    try {
      const r = await aiApi.recommendPriorities(activeTeam.id);
      setAiRecs(r.data);
    } catch (e) {
      toast.error("AI recommendations failed");
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => { load(); }, [activeTeam?.id]);

  if (loading) {
    return (
      <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card h-24 animate-pulse bg-[var(--surface-2)]" />
        ))}
      </div>
    );
  }

  const overview = data?.overview || {};
  const priorityData = Object.entries(data?.priorityDistribution || {}).map(([name, value]) => ({ name, value }));
  const sourceData = Object.entries(data?.sourceDistribution || {}).map(([name, value]) => ({
    name: name === "ai_extracted" ? "AI Extracted" : name.charAt(0).toUpperCase() + name.slice(1),
    value
  }));

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text)]">Analytics</h2>
          <p className="text-sm text-[var(--text-2)]">Team productivity insights</p>
        </div>
        <button onClick={load} className="btn-ghost gap-2">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Overview metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={CheckSquare} label="Total Tasks" value={overview.totalTasks || 0} color="brand" />
        <MetricCard icon={TrendingUp} label="Completion Rate" value={`${overview.completionRate || 0}%`} color="green"
          sub={`Avg ${overview.avgCompletionDays || 0} days to complete`} />
        <MetricCard icon={Users} label="Active Members" value={overview.activeMembers || 0} color="amber" />
        <MetricCard icon={AlertCircle} label="Overdue" value={dashboard?.taskStats?.overdue || 0} color="red" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task trend */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Task Activity (7 Days)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dashboard?.completionTrend || []}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-2)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-2)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="created" name="Created" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Priority breakdown */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Priority Breakdown</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={priorityData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                dataKey="value" nameKey="name" paddingAngle={3}>
                {priorityData.map((entry, i) => (
                  <Cell key={i} fill={PRIORITY_COLORS_MAP[entry.name] || PIE_COLORS[i]} />
                ))}
              </Pie>
              <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs capitalize">{v}</span>} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Member leaderboard */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Member Performance</h3>
          <div className="space-y-3">
            {(data?.memberStats || []).slice(0, 8).map((m, i) => (
              <div key={m.user?.id} className="flex items-center gap-3">
                <span className="text-xs font-bold text-[var(--text-2)] w-4">{i + 1}</span>
                <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-xs font-semibold text-brand-600 shrink-0">
                  {(m.user?.displayName || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[var(--text)] truncate">{m.user?.displayName || m.user?.email}</p>
                    <span className="text-xs text-green-600 font-medium">{m.completionRate}%</span>
                  </div>
                  <div className="mt-1 h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all"
                      style={{ width: `${m.completionRate}%` }}
                    />
                  </div>
                  <p className="text-xs text-[var(--text-2)] mt-0.5">
                    {m.completed}/{m.assigned} tasks · {m.overdue > 0 ? <span className="text-red-500">{m.overdue} overdue</span> : "on track"}
                  </p>
                </div>
              </div>
            ))}
            {!data?.memberStats?.length && (
              <p className="text-sm text-[var(--text-2)] text-center py-4">No member data</p>
            )}
          </div>
        </div>

        {/* Source distribution + AI recommendations */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Task Sources</h3>
            <div className="space-y-2">
              {sourceData.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-[var(--text-2)] w-24 shrink-0">{s.name}</span>
                  <div className="flex-1 h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${data?.overview?.totalTasks ? (s.value / data.overview.totalTasks) * 100 : 0}%`,
                        background: PIE_COLORS[i]
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium text-[var(--text)] w-6 text-right">{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Priority Recommendations */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-brand-600" />
                <h3 className="text-sm font-semibold text-[var(--text)]">AI Priority Advisor</h3>
              </div>
              <button onClick={loadAiRecs} disabled={aiLoading} className="btn-ghost p-1.5">
                {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              </button>
            </div>

            {!aiRecs ? (
              <div className="text-center py-4">
                <p className="text-xs text-[var(--text-2)] mb-3">Get AI recommendations on task priority adjustments</p>
                <button onClick={loadAiRecs} disabled={aiLoading} className="btn-primary text-xs py-1.5">
                  {aiLoading ? "Analyzing…" : "Get recommendations"}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {aiRecs.insight && (
                  <p className="text-xs text-[var(--text-2)] mb-3 leading-relaxed">{aiRecs.insight}</p>
                )}
                {(aiRecs.recommendations || []).slice(0, 4).map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-[var(--surface-2)]">
                    <Sparkles size={12} className="text-brand-500 mt-0.5 shrink-0" />
                    <div>
                      <span className={`badge text-[10px] ${PRIORITY_COLORS_MAP[rec.recommended_priority] ? "" : ""}`}
                        style={{ background: `${PRIORITY_COLORS_MAP[rec.recommended_priority]}20`, color: PRIORITY_COLORS_MAP[rec.recommended_priority] }}>
                        → {rec.recommended_priority}
                      </span>
                      <p className="text-xs text-[var(--text-2)] mt-0.5">{rec.reason}</p>
                    </div>
                  </div>
                ))}
                {aiRecs.recommendations?.length === 0 && (
                  <p className="text-xs text-green-600 text-center py-2">✅ All priorities look good!</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
