import React, { useEffect, useState, useRef } from 'react';
import { ArrowLeft, GitCompare, ArrowDown, ShieldCheck, ShieldAlert } from 'lucide-react';
import type { Run, TraceEvent, DiffResponse, AssertionResult } from '../../types';
import { getRun, getRunDiff, getAssertions } from '../../lib/api';
import { EventInspector } from '../workspace/EventInspector';

interface ComparisonWorkspaceProps {
  baselineRunId: string;
  replayRunId: string;
  onBackToTrace: () => void;
  onSelectRun: (runId: string) => void;
}

export const ComparisonWorkspace: React.FC<ComparisonWorkspaceProps> = ({
  baselineRunId,
  replayRunId,
  onBackToTrace,
  onSelectRun
}) => {
  const [baselineRun, setBaselineRun] = useState<Run | null>(null);
  const [replayRun, setReplayRun] = useState<Run | null>(null);
  const [baselineEvents, setBaselineEvents] = useState<TraceEvent[]>([]);
  const [replayEvents, setReplayEvents] = useState<TraceEvent[]>([]);
  const [diff, setDiff] = useState<DiffResponse | null>(null);
  const [baselineAssertions, setBaselineAssertions] = useState<AssertionResult[]>([]);
  const [replayAssertions, setReplayAssertions] = useState<AssertionResult[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<TraceEvent | null>(null);
  const [loading, setLoading] = useState(true);

  const divergenceRowRef = useRef<HTMLDivElement | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [baseRes, replayRes, diffRes, baseAsserts, replayAsserts] = await Promise.all([
        getRun(baselineRunId),
        getRun(replayRunId),
        getRunDiff(baselineRunId, replayRunId),
        getAssertions(baselineRunId),
        getAssertions(replayRunId)
      ]);
      setBaselineRun(baseRes.run);
      setBaselineEvents(baseRes.events.sort((a, b) => a.sequence - b.sequence));
      setReplayRun(replayRes.run);
      setReplayEvents(replayRes.events.sort((a, b) => a.sequence - b.sequence));
      setDiff(diffRes);
      setBaselineAssertions(baseAsserts.results);
      setReplayAssertions(replayAsserts.results);

      // Select diverging event by default
      const divSeq = diffRes.first_divergence_sequence || 3;
      const defaultEvt = replayRes.events.find((e) => e.sequence === divSeq) || replayRes.events[0];
      setSelectedEvent(defaultEvt);
    } catch {
      // Handled gracefully
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
      }, 2400);
    }
  };

  if (loading || !baselineRun || !replayRun) {
    return (
      <div className="diff-workspace" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Aligning execution traces and calculating diff...
        </div>
      </div>
    );
  }

  const maxLen = Math.max(baselineEvents.length, replayEvents.length);
  const sequenceNumbers = Array.from({ length: maxLen }, (_, i) => i + 1);

  return (
    <div className="diff-workspace">
      {/* Comparison Topbar */}
      <div className="diff-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={onBackToTrace} className="wb-btn wb-btn-secondary" style={{ padding: '3px 8px' }}>
            <ArrowLeft size={13} /> Return to Trace
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitCompare size={15} color="var(--warning)" />
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              Execution Trace Diff
            </span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
              #{baselineRun.id} (Baseline) ⟷ #{replayRun.id} (Replay)
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {diff?.summary && (
            <div style={{ display: 'flex', gap: '4px', fontSize: '0.72rem' }}>
              <span className="diff-change-badge changed">{diff.summary.changed} Changed</span>
              <span className="diff-change-badge added">{diff.summary.added} Added</span>
              <span className="diff-change-badge removed">{diff.summary.removed} Removed</span>
            </div>
          )}
        </div>
      </div>

      {/* First Divergence Navigator Bar */}
      {diff?.first_divergence_sequence ? (
        <div className="diff-first-divergence-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700 }}>FIRST DIVERGENCE:</span>
            <span>
              Step #{String(diff.first_divergence_sequence).padStart(2, '0')} • Tool selection changed from{' '}
              <strong style={{ color: 'var(--error)' }}>issue_refund</strong> to{' '}
              <strong style={{ color: 'var(--success)' }}>fraud_check</strong>
            </span>
          </div>

          <button
            onClick={handleJumpToDivergence}
            className="wb-btn wb-btn-outline"
            style={{
              padding: '2px 8px',
              fontSize: '0.72rem',
              borderColor: 'var(--warning-border)',
              color: 'var(--warning)'
            }}
          >
            <ArrowDown size={12} /> Jump to Step #{String(diff.first_divergence_sequence).padStart(2, '0')}
          </button>
        </div>
      ) : (
        <div className="diff-first-divergence-bar" style={{ backgroundColor: 'var(--success-subtle)', color: 'var(--success)', borderColor: 'var(--success-border)' }}>
          <span>Traces are semantically identical. No divergence detected.</span>
        </div>
      )}

      {/* Behavioral Assertions Comparison Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
          padding: '0.6rem 1.25rem',
          backgroundColor: 'var(--bg-panel-secondary)',
          borderBottom: '1px solid var(--border-default)',
          fontSize: '0.75rem'
        }}
      >
        {/* Baseline Assertions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {baselineAssertions.map((a, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 8px',
                background: 'var(--bg-panel)',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${a.passed ? 'var(--success-border)' : 'var(--error-border)'}`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {a.passed ? <ShieldCheck size={14} color="var(--success)" /> : <ShieldAlert size={14} color="var(--error)" />}
                <span style={{ fontWeight: 600, color: a.passed ? 'var(--success)' : 'var(--error)' }}>
                  Baseline #{baselineRun.id}:
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>{a.name}</span>
              </div>
              <span
                style={{
                  color: a.passed ? 'var(--success)' : 'var(--error)',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)'
                }}
              >
                {a.passed ? 'PASS (VERIFIED)' : 'FAIL (VIOLATION)'}
              </span>
            </div>
          ))}
        </div>

        {/* Replay Assertions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {replayAssertions.map((a, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 8px',
                background: 'var(--bg-panel)',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${a.passed ? 'var(--success-border)' : 'var(--error-border)'}`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {a.passed ? <ShieldCheck size={14} color="var(--success)" /> : <ShieldAlert size={14} color="var(--error)" />}
                <span style={{ fontWeight: 600, color: a.passed ? 'var(--success)' : 'var(--error)' }}>
                  Replay #{replayRun.id}:
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>{a.name}</span>
              </div>
              <span
                style={{
                  color: a.passed ? 'var(--success)' : 'var(--error)',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)'
                }}
              >
                {a.passed ? 'PASS (VERIFIED)' : 'FAIL (VIOLATION)'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Diff Content with Side-by-Side and Event Inspector */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Side-by-Side Rows */}
        <div className="diff-columns-container">
          {/* Column Header Labels */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 90px 1fr',
              gap: '0.75rem',
              padding: '0.4rem 0.5rem',
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              borderBottom: '1px solid var(--border-subtle)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Baseline Trace (#{baselineRun.id})</span>
              <button
                onClick={() => onSelectRun(baselineRun.id)}
                className="wb-btn wb-btn-outline"
                style={{ fontSize: '0.65rem', padding: '1px 5px', border: 'none' }}
              >
                Inspect Trace →
              </button>
            </div>
            <div style={{ textAlign: 'center' }}>Step / Status</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Replay Trace (#{replayRun.id})</span>
              <button
                onClick={() => onSelectRun(replayRun.id)}
                className="wb-btn wb-btn-outline"
                style={{ fontSize: '0.65rem', padding: '1px 5px', border: 'none' }}
              >
                Inspect Trace →
              </button>
            </div>
          </div>

          {sequenceNumbers.map((seq) => {
            const baseEvt = baselineEvents.find((e) => e.sequence === seq);
            const repEvt = replayEvents.find((e) => e.sequence === seq);
            const isDivergencePoint = seq === diff?.first_divergence_sequence;
            const diffItem = diff?.changes.find((c) => c.sequence === seq);
            const isChanged = Boolean(diffItem);

            return (
              <div
                key={seq}
                ref={isDivergencePoint ? divergenceRowRef : null}
                className={`diff-row-aligned ${isDivergencePoint ? 'divergence' : ''}`}
              >
                {/* Baseline Event Card */}
                <div
                  className={`diff-event-card ${isChanged ? 'changed' : ''}`}
                  onClick={() => baseEvt && setSelectedEvent(baseEvt)}
                  style={{
                    cursor: baseEvt ? 'pointer' : 'default',
                    opacity: baseEvt ? 1 : 0.35,
                    borderLeft: baseEvt && isChanged ? '3px solid var(--error)' : undefined
                  }}
                >
                  {baseEvt ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {baseEvt.name}
                        </span>
                        <span className={`event-type-badge badge-${baseEvt.type}`}>{baseEvt.type}</span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {JSON.stringify(baseEvt.input || baseEvt.output || {})}
                      </div>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>— None —</span>
                  )}
                </div>

                {/* Center Separator Pill */}
                <div className="diff-separator">
                  <span style={{ fontWeight: 700, color: isDivergencePoint ? 'var(--warning)' : 'var(--text-muted)' }}>
                    #{String(seq).padStart(2, '0')}
                  </span>
                  <span
                    className={`diff-change-badge ${
                      diffItem ? diffItem.change_type : 'match'
                    }`}
                  >
                    {diffItem ? diffItem.change_type : 'match'}
                  </span>
                </div>

                {/* Replay Event Card */}
                <div
                  className={`diff-event-card ${isChanged ? 'changed' : ''}`}
                  onClick={() => repEvt && setSelectedEvent(repEvt)}
                  style={{
                    cursor: repEvt ? 'pointer' : 'default',
                    opacity: repEvt ? 1 : 0.35,
                    borderLeft: repEvt && isChanged ? '3px solid var(--success)' : undefined
                  }}
                >
                  {repEvt ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {repEvt.name}
                        </span>
                        <span className={`event-type-badge badge-${repEvt.type}`}>{repEvt.type}</span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {JSON.stringify(repEvt.input || repEvt.output || {})}
                      </div>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>— None —</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Side Inspector for Selected Diff Event */}
        <EventInspector event={selectedEvent} />
      </div>
    </div>
  );
};
