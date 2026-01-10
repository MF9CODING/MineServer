import { Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { Layout } from './components/layout/Layout';
import { ServerDetail } from './pages/ServerDetail';
import { Dashboard } from './pages/Dashboard';
import { Servers } from './pages/Servers';
import { Backups } from './pages/Backups';
import { ScheduledTasks } from './pages/ScheduledTasks';
import { Settings } from './pages/Settings';
import { CreateServer } from './pages/CreateServer';
import { useAppStore } from './stores/appStore';

function App() {
  const { syncServerStatuses } = useAppStore();

  // Sync server statuses with backend on app load
  useEffect(() => {
    syncServerStatuses();
  }, [syncServerStatuses]);
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="servers" element={<Servers />} />
        <Route path="server/:id" element={<ServerDetail />} />
        <Route path="servers/:id" element={<ServerDetail />} />
        <Route path="backups" element={<Backups />} />
        <Route path="tasks" element={<ScheduledTasks />} />
        <Route path="settings" element={<Settings />} />
        <Route path="create" element={<CreateServer />} />
      </Route>
    </Routes>
  );
}

export default App;
