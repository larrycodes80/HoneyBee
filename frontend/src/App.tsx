import { useEffect, useState, useCallback } from 'react';
import type { Run, TraceEvent, AssertionResult } from './types';
import { listRuns, getRun, getAssertions } from './lib/api';
import { WorkbenchHeader } from './components/WorkbenchHeader';
import { RunExplorer } from './components/workspace/RunExplorer';
import { TimelinePane } from './components/workspace/TimelinePane';
import { EventInspector } from './components/workspace/EventInspector';
import { ComparisonWorkspace } from './components/diff/ComparisonWorkspace';
import { NewRunModal } from './components/NewRunModal';
import { ReplayModal } from './components/replay/ReplayModal';

export function App() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loadingRuns, setLoadingRuns] = useState<boolean>(true);

  // Selected State
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [currentRun, setCurrentRun] = useState<Run | null>(null);
  const [currentEvents, setCurrentEvents] = useState<TraceEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [assertions, setAssertions] = useState<AssertionResult[]>([]);

  // Workspace View State
  const [viewMode, setViewMode] = useState<'trace' | 'diff'>('trace');
  const [diffPair, setDiffPair] = useState<{ baselineId: string; replayId: string } | null>(null);

  // Modal Dialogs
  const [isNewRunModalOpen, setIsNewRunModalOpen] = useState(false);
  const [replayTargetRun, setReplayTargetRun] = useState<Run | null>(null);

  // Fetch runs list
  const loadRuns = useCallback(async (selectIdAfterLoad?: string) => {
    setLoadingRuns(true);
    try {
      const res = await listRuns();
      setRuns(res.items);

      const targetId = selectIdAfterLoad || selectedRunId || (res.items.length > 0 ? res.items[0].id : null);
      if (targetId) {
        setSelectedRunId(targetId);
      }

      // Check if a replay exists to configure the default diff pair
      const replayRun = res.items.find((r) => r.baseline_run_id !== null);
      if (replayRun && replayRun.baseline_run_id) {
        setDiffPair({ baselineId: replayRun.baseline_run_id, replayId: replayRun.id });
      }
    } catch {
      // Handled gracefully
    } finally {
      setLoadingRuns(false);
    }
  }, [selectedRunId]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  // Load details whenever selectedRunId changes
  useEffect(() => {
    if (!selectedRunId) return;

    let isMounted = true;
    const fetchRunDetails = async () => {
      try {
        const [runRes, assertRes] = await Promise.all([
          getRun(selectedRunId),
          getAssertions(selectedRunId)
        ]);
        if (isMounted) {
          setCurrentRun(runRes.run);
          const sorted = runRes.events.sort((a, b) => a.sequence - b.sequence);
          setCurrentEvents(sorted);
          setAssertions(assertRes.results);
          if (sorted.length > 0) {
            setSelectedEventId(sorted[0].id);
          }
        }
      } catch {
        // Handled gracefully
      }
    };

    fetchRunDetails();
    return () => {
      isMounted = false;
    };
  }, [selectedRunId]);

  // Handlers
  const handleSelectRun = (runId: string) => {
    setSelectedRunId(runId);
    setViewMode('trace');
  };

  const handleOpenReplay = (run: Run) => {
    setReplayTargetRun(run);
  };

  const handleReplayComplete = (baseline: Run, replay: Run) => {
    setRuns((prev) => [replay, ...prev]);
    setSelectedRunId(replay.id);
    setDiffPair({ baselineId: baseline.id, replayId: replay.id });
    setReplayTargetRun(null);
    setViewMode('diff');
  };

  const handleOpenDiff = (baselineId: string, replayId: string) => {
    setDiffPair({ baselineId, replayId });
    setViewMode('diff');
  };

  const handleRunCreated = (newRun: Run) => {
    setRuns((prev) => [newRun, ...prev]);
    setSelectedRunId(newRun.id);
    setViewMode('trace');
  };

  const selectedEvent = currentEvents.find((e) => e.id === selectedEventId) || null;

  return (
    <div className="workbench-root">
      {/* Compact Header */}
      <WorkbenchHeader
        currentView={viewMode}
        scenarioName={currentRun?.config?.scenario || 'refund_safety'}
        hasDiffPair={Boolean(diffPair)}
        onViewChange={(v) => setViewMode(v)}
        onNewRunClick={() => setIsNewRunModalOpen(true)}
        onReplayClick={currentRun ? () => handleOpenReplay(currentRun) : undefined}
      />

      {/* Main Workspace Body */}
      {viewMode === 'diff' && diffPair ? (
        <ComparisonWorkspace
          baselineRunId={diffPair.baselineId}
          replayRunId={diffPair.replayId}
          onBackToTrace={() => setViewMode('trace')}
          onSelectRun={handleSelectRun}
        />
      ) : (
        <div className="workbench-body">
          {/* Left Pane: Run Explorer */}
          <RunExplorer
            runs={runs}
            selectedRunId={selectedRunId}
            loading={loadingRuns}
            onSelectRun={handleSelectRun}
            onRefresh={() => loadRuns()}
            onReplayRun={handleOpenReplay}
            onCompareRun={handleOpenDiff}
          />

          {/* Center Pane: Execution Timeline */}
          <TimelinePane
            run={currentRun}
            events={currentEvents}
            selectedEventId={selectedEventId}
            assertions={assertions}
            onSelectEvent={(evt) => setSelectedEventId(evt.id)}
            onReplayClick={handleOpenReplay}
            onCompareClick={handleOpenDiff}
          />

          {/* Right Pane: Event Inspector */}
          <EventInspector event={selectedEvent} />
        </div>
      )}

      {/* Modals */}
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
