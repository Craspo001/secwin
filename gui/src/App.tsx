import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { Profiles } from './pages/Profiles';
import { Evidence } from './pages/Evidence';
import { Playbooks } from './pages/Playbooks';
import { Tools } from './pages/Tools';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Benchmarks } from './pages/Benchmarks';
import { AITriage } from './pages/AITriage';
import { useStore } from './store';
import { Toaster } from './components/ui/Toaster';
import { TooltipProvider } from './components/ui/Tooltip';

function AppContent() {
  const { checkSecwin } = useStore();

  useEffect(() => {
    checkSecwin();
  }, [checkSecwin]);

  return (
    <div className="flex h-screen bg-background dark:bg-dark-950">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/profiles" element={<Profiles />} />
            <Route path="/evidence" element={<Evidence />} />
            <Route path="/playbooks" element={<Playbooks />} />
            <Route path="/tools" element={<Tools />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/benchmarks" element={<Benchmarks />} />
            <Route path="/ai-triage" element={<AITriage />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <TooltipProvider>
      <AppContent />
      <Toaster />
    </TooltipProvider>
  );
}