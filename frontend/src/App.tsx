import { useEffect, useState, useCallback } from 'react';
import type { Run } from './types';
import { listRuns } from './lib/api';
import { Header } from './components/Header';
import { RunsDashboard } from './components/RunsDashboard';
import { RunDetailView } from './components/RunDetailView';
import { NewRunModal } from './components/NewRunModal';

export function App() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currentView, setCurrentView] = useState<'dashboard' | 'detail'>('dashboard');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [isNewRunModalOpen, setIsNewRunModalOpen] = useState<boolean>(false);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listRuns();
      setRuns(res.items);
    } catch (err: any) {
      setError(err?.message || 'Failed to retrieve agent runs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const handleSelectRun = (runId: string) => {
    setSelectedRunId(runId);
    setCurrentView('detail');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setSelectedRunId(null);
    loadRuns();
  };

  const handleRunCreated = (newRun: Run) => {
    setRuns((prev) => [newRun, ...prev]);
    setSelectedRunId(newRun.id);
    setCurrentView('detail');
  };

  return (
    <div className="app-container">
      <Header
        onNewRunClick={() => setIsNewRunModalOpen(true)}
        onHomeClick={handleBackToDashboard}
      />

      <main className="main-content">
        {currentView === 'dashboard' || !selectedRunId ? (
          <RunsDashboard
            runs={runs}
            loading={loading}
            error={error}
            onRefresh={loadRuns}
            onSelectRun={handleSelectRun}
            onNewRunClick={() => setIsNewRunModalOpen(true)}
          />
        ) : (
          <RunDetailView
            runId={selectedRunId}
            onBack={handleBackToDashboard}
            onNavigateToRun={(id) => handleSelectRun(id)}
          />
        )}
      </main>

      <NewRunModal
        isOpen={isNewRunModalOpen}
        onClose={() => setIsNewRunModalOpen(false)}
        onRunCreated={handleRunCreated}
      />
    </div>
  );
}

export default App;
