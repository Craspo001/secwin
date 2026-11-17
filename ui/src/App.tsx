import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { PlaybookRunner } from './components/PlaybookRunner';
import { ProfileManager } from './components/ProfileManager';
import { EvidenceViewer } from './components/EvidenceViewer';
import { FindingsDashboard } from './components/FindingsDashboard';
import { Settings } from './components/Settings';
import { Dashboard } from './components/Dashboard';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/playbooks" element={<PlaybookRunner />} />
        <Route path="/profiles" element={<ProfileManager />} />
        <Route path="/evidence" element={<EvidenceViewer />} />
        <Route path="/findings" element={<FindingsDashboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;