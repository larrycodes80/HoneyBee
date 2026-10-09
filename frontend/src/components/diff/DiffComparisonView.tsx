import React, { useEffect, useState, useRef } from 'react';
import { ArrowLeft, GitCompare, RefreshCw } from 'lucide-react';
import type { Run, TraceEvent, DiffResponse } from '../../types';
import { getRun, getRunDiff } from '../../lib/api';
import { FirstDivergenceBanner } from './FirstDivergenceBanner';
import { AssertionResultsPanel } from '../assertions/AssertionResultsPanel';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { ErrorState } from '../common/ErrorState';

interface DiffComparisonViewProps {
  baselineRunId: string;
  replayRunId: string;
  onBack: () => void;
  onInspectRun: (runId: string) => void;
}

export const DiffComparisonView: React.FC<DiffComparisonViewProps> = ({
  baselineRunId,
  replayRunId,
  onBack,
  onInspectRun
}) => {
  const [baselineRun, setBaselineRun] = useState<Run | null>(null);
  const [replayRun, setReplayRun] = useState<Run | null>(null);
  const [baselineEvents, setBaselineEvents] = useState<TraceEvent[]>([]);
  const [replayEvents, setReplayEvents] = useState<TraceEvent[]>([]);
  const [diff, setDiff] = useState<DiffResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const divergenceRowRef = useRef<HTMLDivElement | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [baseRes, replayRes, diffRes] = await Promise.all([
        getRun(baselineRunId),
        getRun(replayRunId),
        getRunDiff(baselineRunId, replayRunId)
      ]);
      setBaselineRun(baseRes.run);
      setBaselineEvents(baseRes.events.sort((a, b) => a.sequence - b.sequence));
      setReplayRun(replayRes.run);
      setReplayEvents(replayRes.events.sort((a, b) => a.sequence - b.sequence));
      setDiff(diffRes);
    } catch (err: any) {
      setError(err?.message || 'Failed to compare runs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [baselineRunId, replayRunId]);

  const handleJumpToDivergence = () => {
    if (divergenceRowRef.current) {
      divergenceRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      divergenceRowRef.current.classList.add('pulse-divergence');
      setTimeout(() => {
        divergenceRowRef.current?.classList.remove('pulse-divergence');
      }, 2000);
    }
  };

  if (loading) {
    return (
      <div>
        <div className="breadcrumb">
          <span className="breadcrumb-link" onClick={onBack}>
            <ArrowLeft size={14} /> Back
          </span>
          <span>/</span>
          <span>Comparing #{baselineRunId} vs #{replayRunId}...</span>
        </div>
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  if (error || !baselineRun || !replayRun) {
    return (
      <div>
        <div className="breadcrumb">
          <span className="breadcrumb-link" onClick={onBack}>
            <ArrowLeft size={14} /> Back
          </span>
        </div>
        <ErrorState
          title="Comparison Failed"
          message={error || 'Could not load traces for comparison.'}
          onRetry={loadData}
        />
      </div>
    );
  }

  const maxSequence = Math.max(
    baselineEvents.length,
    replayEvents.length,
    diff?.changes.length || 0
  );

  const sequences = Array.from({ length: maxSequence }, (_, i) => i + 1);

  return (
    <div>
      {/* Breadcrumb Navigation */}
      <div className="breadcrumb">
        <span className="breadcrumb-link" onClick={onBack}>
          <ArrowLeft size={14} /> All Runs
        </span>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)' }}>Trace Comparison & Diff</span>
      </div>

      {/* Comparison Header */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, #0284c7, #f59e0b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <GitCompare size={20} color="#ffffff" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Side-by-Side Trace Diff
              </h1>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Baseline <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>#{baselineRun.id}</span>
                {' ➔ '}
                Replay <span style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>#{replayRun.id}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {diff?.summary && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)' }}>
                  {diff.summary.changed} Changed
                </span>
                <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)' }}>
                  {diff.summary.added} Added
                </span>
                <span className="badge" style={{ background: 'rgba(244, 63, 94, 0.15)', color: 'var(--accent-rose)' }}>
                  {diff.summary.removed} Removed
                </span>
              </div>
            )}
            <button onClick={loadData} className="btn btn-secondary">
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </div>

        {/* Prompt Comparison Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem',
            background: 'var(--bg-main)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.85rem'
          }}
        >
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
              Baseline Prompt (#{baselineRun.id})
            </div>
            <div style={{ color: 'var(--accent-rose)' }}>"{baselineRun.config?.prompt}"</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
              Replay Prompt (#{replayRun.id})
            </div>
            <div style={{ color: 'var(--accent-emerald)' }}>"{replayRun.config?.prompt}"</div>
          </div>
        </div>
      </div>

      {/* First Divergence Banner */}
      <FirstDivergenceBanner
        firstDivergenceSequence={diff?.first_divergence_sequence ?? null}
        onJumpToDivergence={handleJumpToDivergence}
      />

      {/* Behavioral Assertions for Replay */}
      <AssertionResultsPanel runId={replayRun.id} />

      {/* Dual Aligned Trace Columns */}
      <div style={{ marginTop: '1.5rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 80px 1fr',
            gap: '1rem',
            padding: '0.75rem 1rem',
            background: 'var(--bg-surface-elevated)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.8rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--text-muted)',
            marginBottom: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Baseline Trace (#{baselineRun.id})</span>
            <button
              onClick={() => onInspectRun(baselineRun.id)}
              className="btn btn-ghost"
              style={{ fontSize: '0.7rem', padding: '2px 6px' }}
            >
              View Full Run →
            </button>
          </div>
          <div style={{ textAlign: 'center' }}>Sequence</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Replay Trace (#{replayRun.id})</span>
            <button
              onClick={() => onInspectRun(replayRun.id)}
              className="btn btn-ghost"
              style={{ fontSize: '0.7rem', padding: '2px 6px' }}
            >
              View Full Run →
            </button>
          </div>
        </div>

        {/* Aligned Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {sequences.map((seq) => {
            const baseEvt = baselineEvents.find((e) => e.sequence === seq);
            const replayEvt = replayEvents.find((e) => e.sequence === seq);
            const isDivergencePoint = seq === diff?.first_divergence_sequence;
            const diffItem = diff?.changes.find((c) => c.sequence === seq);
            const isChanged = Boolean(diffItem);

            return (
              <div
                key={seq}
                ref={isDivergencePoint ? divergenceRowRef : null}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 80px 1fr',
                  gap: '1rem',
                  alignItems: 'stretch',
                  background: isDivergencePoint
                    ? 'rgba(245, 158, 11, 0.08)'
                    : isChanged
                    ? 'rgba(255, 255, 255, 0.02)'
                    : 'transparent',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-md)',
                  border: isDivergencePoint
                    ? '2px solid var(--accent-amber)'
                    : '1px solid transparent',
                  transition: 'all 0.3s ease'
                }}
              >
                {/* Left: Baseline Event */}
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    border: `1px solid ${
                      isChanged ? 'rgba(244, 63, 94, 0.3)' : 'var(--border-subtle)'
                    }`,
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem',
                    opacity: baseEvt ? 1 : 0.4
                  }}
                >
                  {baseEvt ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {baseEvt.name}
                        </span>
                        <span className="badge" style={{ fontSize: '0.65rem' }}>{baseEvt.type}</span>
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-secondary)',
                          background: 'var(--bg-main)',
                          padding: '4px 6px',
                          borderRadius: '4px',
                          overflowX: 'auto',
                          maxHeight: '60px'
                        }}
                      >
                        {JSON.stringify(baseEvt.input || baseEvt.output || {})}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      [Event removed or not reached]
                    </div>
                  )}
                </div>

                {/* Middle: Sequence pill & Status */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      color: isDivergencePoint ? 'var(--accent-amber)' : 'var(--text-primary)'
                    }}
                  >
                    #{seq}
                  </span>
                  {isChanged ? (
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '2px 5px',
                        borderRadius: '4px',
                        background: 'rgba(245, 158, 11, 0.2)',
                        color: 'var(--accent-amber)',
                        textTransform: 'uppercase'
                      }}
                    >
                      CHANGED
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '0.65rem',
                        padding: '2px 5px',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase'
                      }}
                    >
                      MATCH
                    </span>
                  )}
                </div>

                {/* Right: Replay Event */}
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    border: `1px solid ${
                      isChanged ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'
                    }`,
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem',
                    opacity: replayEvt ? 1 : 0.4
                  }}
                >
                  {replayEvt ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {replayEvt.name}
                        </span>
                        <span className="badge" style={{ fontSize: '0.65rem' }}>{replayEvt.type}</span>
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-secondary)',
                          background: 'var(--bg-main)',
                          padding: '4px 6px',
                          borderRadius: '4px',
                          overflowX: 'auto',
                          maxHeight: '60px'
                        }}
                      >
                        {JSON.stringify(replayEvt.input || replayEvt.output || {})}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      [Event removed or not reached]
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
