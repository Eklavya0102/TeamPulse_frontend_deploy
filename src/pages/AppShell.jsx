// src/pages/AppShell.jsx - Responsive layout
import { useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import useStore from "../store/useStore";
import { authApi } from "../services/api";
import Sidebar from "../components/shared/Sidebar";
import TopBar  from "../components/shared/TopBar";

import Dashboard              from "./Dashboard";
import TasksPage              from "./TasksPage";
import ChatPage               from "./ChatPage";
import KnowledgePage          from "./KnowledgePage";
import AnalyticsPage          from "./AnalyticsPage";
import MeetingIntelligencePage from "./MeetingIntelligencePage";

export default function AppShell() {
  const { activeTeam, teams, setTeamMembers } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (teams.length === 0) navigate("/onboarding");
  }, [teams.length]);

  useEffect(() => {
    if (!activeTeam) return;
    authApi.getTeamMembers(activeTeam.id)
      .then(r => setTeamMembers(r.data.members))
      .catch(() => {});
  }, [activeTeam?.id]);

  if (!activeTeam) return null;

  return (
    /* Full-height flex layout — sidebar + main */
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        {/* Main content — scrollable */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Routes>
            <Route path="/"                     element={<Dashboard />} />
            <Route path="/tasks"                element={<TasksPage />} />
            <Route path="/chat"                 element={<ChatPage />} />
            <Route path="/knowledge"            element={<KnowledgePage />} />
            <Route path="/analytics"            element={<AnalyticsPage />} />
            <Route path="/meeting-intelligence" element={<MeetingIntelligencePage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
