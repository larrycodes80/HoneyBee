import { useEffect, useState, useCallback } from 'react';
import type { Run } from './types';
import { listRuns } from './lib/api';
import { Header } from './components/Header';
import { RunsDashboard } from './components/RunsDashboard';
import { RunDetailView } from './components/RunDetailView';
import { DiffComparisonView } from './components/diff/DiffComparisonView';
import { NewRunModal } from './components/NewRunModal';
import { ReplayModal } from './components/replay/ReplayModal';

export function App() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currentView, setCurrentView] = useState<'dashboard' | 'detail' | 'diff'>('dashboard');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [diffPair, setDiffPair] = useState<{ baselineId: string; replayId: string } | null>(null);

  const [isNewRunModalOpen, setIsNewRunModalOpen] = useState<boolean>(false);
  const [replayTargetRun, setReplayTargetRun] = useState<Run | null>(null);

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
    setDiffPair(null);
    loadRuns();
  };

  const handleRunCreated = (newRun: Run) => {
    setRuns((prev) => [newRun, ...prev]);
    setSelectedRunId(newRun.id);
    setCurrentView('detail');
  };

  const handleOpenReplay = (run: Run) => {
    setReplayTargetRun(run);
  };

  const handleReplayComplete = (baseline: Run, replay: Run) => {
    setRuns((prev) => [replay, ...prev]);
    setReplayTargetRun(null);
    setDiffPair({ baselineId: baseline.id, replayId: replay.id });
    setCurrentView('diff');
  };

  const handleOpenDiff = (baselineId: string, replayId: string) => {
    setDiffPair({ baselineId, replayId });
    setCurrentView('diff');
  };

  return (
    <div className="app-container">
      <Header
        onNewRunClick={() => setIsNewRunModalOpen(true)}
        onHomeClick={handleBackToDashboard}
      />

      <main className="main-content">
        {currentView === 'diff' && diffPair ? (
          <DiffComparisonView
            baselineRunId={diffPair.baselineId}
            replayRunId={diffPair.replayId}
            onBack={handleBackToDashboard}
            onInspectRun={handleSelectRun}
          />
        ) : currentView === 'detail' && selectedRunId ? (
          <RunDetailView
            runId={selectedRunId}
            onBack={handleBackToDashboard}
            onNavigateToRun={(id) => handleSelectRun(id)}
            onReplayClick={handleOpenReplay}
            onCompareClick={handleOpenDiff}
          />
        ) : (
          <RunsDashboard
            runs={runs}
            loading={loading}
            error={error}
            onRefresh={loadRuns}
            onSelectRun={handleSelectRun}
            onNewRunClick={() => setIsNewRunModalOpen(true)}
            onReplayClick={handleOpenReplay}
            onCompareClick={handleOpenDiff}
          />
        )}
      </main>

      <NewRunModal
        isOpen={isNewRunModalOpen}
        onClose={() => setIsNewRunModalOpen(false)}
        onRunCreated={handleRunCreated}
      />

      <ReplayModal
        baselineRun={replayTargetRun}
        isOpen={Boolean(replayTargetRun)}
        onClose={() => setReplayTargetRun(null)}
        onReplayComplete={handleReplayComplete}
      />
    </div>
  );
}

export default App;
