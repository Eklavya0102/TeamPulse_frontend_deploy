// src/App.jsx
import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import useStore from "./store/useStore";
import { authApi } from "./services/api";
import { initUserSocket, joinTeamRoom } from "./services/socket";

import LoginPage       from "./pages/LoginPage";
import OnboardingPage  from "./pages/OnboardingPage";
import AppShell        from "./pages/AppShell";

// ── Loading screen ────────────────────────────────────────────
function Loader() {
  return (
    <div className="h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-600/30">
          <span className="text-3xl">🧠</span>
        </div>
        <div className="flex gap-1.5">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-brand-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
        <p className="text-sm text-[var(--text-2)]">Loading TeamPulse…</p>
      </div>
    </div>
  );
}

// ── Auth guard ────────────────────────────────────────────────
function AuthGuard({ children }) {
  const { token, isAuthLoading } = useStore();
  if (isAuthLoading) return <Loader />;
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

// ── App root ──────────────────────────────────────────────────
export default function App() {
  const { setUser, setToken, setAuthLoading, setTeams, setActiveTeam, logout } = useStore();

  useEffect(() => {
    const stored = localStorage.getItem("atb_token");
    if (!stored) {
      setAuthLoading(false);
      return;
    }

    authApi.getMe()
      .then(r => {
        setUser(r.data.user);
        // Initialize shared socket immediately after auth
        initUserSocket(r.data.user.id);
        return authApi.getMyTeams();
      })
      .then(r => {
        setTeams(r.data.teams);
        if (r.data.teams.length > 0) {
          setActiveTeam(r.data.teams[0]);
          joinTeamRoom(r.data.teams[0].id);
        }
        setAuthLoading(false);
      })
      .catch(() => {
        logout();
        setAuthLoading(false);
      });
  }, []);

  return (
    <Routes>
      <Route path="/login"      element={<LoginPage />} />
      <Route path="/onboarding" element={<AuthGuard><OnboardingPage /></AuthGuard>} />
      <Route path="/*"          element={<AuthGuard><AppShell /></AuthGuard>} />
    </Routes>
  );
}
