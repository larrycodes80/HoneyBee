import React, { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, GitBranch, Cpu, AlertCircle, CheckCircle, RotateCcw, GitCompare } from 'lucide-react';
import type { Run, TraceEvent } from '../types';
import { getRun } from '../lib/api';
import { Badge } from './common/Badge';
import { TraceTimeline } from './TraceTimeline';
import { EventDrawer } from './EventDrawer';
import { AssertionResultsPanel } from './assertions/AssertionResultsPanel';
import { LoadingSkeleton } from './common/LoadingSkeleton';
import { ErrorState } from './common/ErrorState';

interface RunDetailViewProps {
  runId: string;
  onBack: () => void;
  onNavigateToRun?: (id: string) => void;
  onReplayClick?: (run: Run) => void;
  onCompareClick?: (baselineId: string, replayId: string) => void;
}

export const RunDetailView: React.FC<RunDetailViewProps> = ({
  runId,
  onBack,
  onNavigateToRun,
  onReplayClick,
  onCompareClick
}) => {
  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TraceEvent | null>(null);

  const fetchTrace = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRun(runId);
      setRun(res.run);
      // Ensure events are sorted strictly by sequence ascending
      const sortedEvents = [...res.events].sort((a, b) => a.sequence - b.sequence);
      setEvents(sortedEvents);
    } catch (err: any) {
      setError(err?.message || `Failed to load trace for run ${runId}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrace();
  }, [runId]);

  if (loading) {
    return (
      <div>
        <div className="breadcrumb">
          <span className="breadcrumb-link" onClick={onBack}>
            <ArrowLeft size={14} /> Back to Runs
          </span>
          <span>/</span>
          <span>Loading Run {runId}...</span>
        </div>
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div>
        <div className="breadcrumb">
          <span className="breadcrumb-link" onClick={onBack}>
            <ArrowLeft size={14} /> Back to Runs
          </span>
          <span>/</span>
          <span>{runId}</span>
        </div>
        <ErrorState
          title={`Error loading trace for ${runId}`}
          message={error || 'Run details could not be found.'}
          onRetry={fetchTrace}
        />
      </div>
    );
  }

  const formattedDate = new Date(run.created_at).toLocaleString();

  return (
    <div>
      {/* Breadcrumb Navigation */}
      <div className="breadcrumb">
        <span className="breadcrumb-link" onClick={onBack}>
          <ArrowLeft size={14} /> All Runs
        </span>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
          {run.id}
        </span>
      </div>

      {/* Run Header Card */}
      <div className="run-header-card">
        <div className="run-header-meta">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <h1
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--accent-cyan)'
                }}
              >
                {run.id}
              </h1>
              <Badge variant="status" status={run.status} />
              <Badge variant="scenario">{run.config?.scenario || 'refund_safety'}</Badge>
              {run.baseline_run_id && (
                <span
                  className="badge badge-replay"
                  style={{ cursor: onNavigateToRun ? 'pointer' : 'default' }}
                  onClick={() => onNavigateToRun && onNavigateToRun(run.baseline_run_id!)}
                  title="Click to jump to baseline run"
                >
                  <GitBranch size={12} /> Replay of #{run.baseline_run_id}
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Recorded on <span style={{ color: 'var(--text-secondary)' }}>{formattedDate}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {onReplayClick && (
              <button
                onClick={() => onReplayClick(run)}
                className="btn btn-primary"
                style={{ background: 'linear-gradient(135deg, #0284c7, #f59e0b)' }}
              >
                <RotateCcw size={14} /> Replay This Run
              </button>
            )}

            {run.baseline_run_id && onCompareClick && (
              <button
                onClick={() => onCompareClick(run.baseline_run_id!, run.id)}
                className="btn btn-secondary"
                style={{ borderColor: 'var(--accent-amber)', color: 'var(--accent-amber)' }}
              >
                <GitCompare size={14} /> Compare with Baseline
              </button>
            )}

            <button onClick={fetchTrace} className="btn btn-secondary">
              <RefreshCw size={14} /> Refresh Trace
            </button>
          </div>
        </div>

        {/* Prompt Card */}
        <div className="run-prompt-box">
          <div className="run-prompt-box-label">Execution Prompt & Scenario Config</div>
          <div style={{ fontWeight: 500 }}>
            "{run.config?.prompt || 'No specific prompt supplied.'}"
          </div>
        </div>

        {/* Execution Summary Stats */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            marginTop: '1.25rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '0.85rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle size={15} color="var(--accent-cyan)" />
            <span style={{ color: 'var(--text-secondary)' }}>Total Events:</span>
            <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              {events.length}
            </strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={15} color="var(--accent-amber)" />
            <span style={{ color: 'var(--text-secondary)' }}>Tool Invocations:</span>
            <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              {events.filter((e) => e.type === 'tool_call').length}
            </strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={15} color="var(--accent-rose)" />
            <span style={{ color: 'var(--text-secondary)' }}>Errors:</span>
            <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              {events.filter((e) => e.type === 'error').length}
            </strong>
          </div>
        </div>
      </div>

      {/* Behavioral Safety Assertions Panel */}
      <AssertionResultsPanel runId={run.id} />

      {/* Events Timeline */}
      <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)' }}>
        Chronological Trace Timeline
      </h2>

      <TraceTimeline
        events={events}
        onSelectEvent={(evt) => setSelectedEvent(evt)}
        selectedEventId={selectedEvent?.id}
      />

      {/* Event Inspection Drawer */}
      <EventDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
};
