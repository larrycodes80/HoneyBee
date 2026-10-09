import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  GitCompare,
  Filter,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  Terminal,
  Clock,
  Cpu,
  Layers,
  EyeOff,
  GitBranch
} from 'lucide-react';
import type { Run, TraceEvent, AssertionResult } from '../../types';

interface TimelinePaneProps {
  run: Run | null;
  events: TraceEvent[];
  selectedEventId: string | null;
  assertions: AssertionResult[];
  onSelectEvent: (event: TraceEvent) => void;
  onReplayClick: (run: Run) => void;
  onCompareClick?: (baselineId: string, replayId: string) => void;
}

export const TimelinePane: React.FC<TimelinePaneProps> = ({
  run,
  events,
  selectedEventId,
  assertions,
  onSelectEvent,
  onReplayClick,
  onCompareClick
}) => {
  const [filterType, setFilterType] = useState<'all' | 'tools' | 'model' | 'errors'>('all');

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filterType === 'tools' && !e.type.startsWith('tool_')) return false;
      if (filterType === 'model' && !e.type.startsWith('model_')) return false;
      if (filterType === 'errors' && e.type !== 'error') return false;
      return true;
    });
  }, [events, filterType]);

  if (!run) {
    return (
      <main className="pane-timeline" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Select a run from the explorer to inspect its execution trace.
        </div>
      </main>
    );
  }

  const allPassed = assertions.length > 0 && assertions.every((a) => a.passed);

  return (
    <main className="pane-timeline">
      {/* Topbar: Run Identity & Quick Actions */}
      <div className="timeline-topbar">
        <div className="timeline-run-info">
          <div className="timeline-run-id">
            <span>{run.id}</span>
          </div>

          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              textTransform: 'uppercase',
              backgroundColor:
                run.status === 'completed'
                  ? 'var(--success-subtle)'
                  : run.status === 'failed'
                  ? 'var(--error-subtle)'
                  : 'var(--accent-subtle)',
              color:
                run.status === 'completed'
                  ? 'var(--success)'
                  : run.status === 'failed'
                  ? 'var(--error)'
                  : 'var(--accent)',
              border: `1px solid ${
                run.status === 'completed'
                  ? 'var(--success-border)'
                  : run.status === 'failed'
                  ? 'var(--error-border)'
                  : 'var(--accent-border)'
              }`
            }}
          >
            {run.status}
          </span>

          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {new Date(run.created_at).toISOString()}
          </span>

          {run.agent_name && (
            <span
              style={{
                fontSize: '0.72rem',
                color: 'var(--accent)',
                background: 'var(--accent-subtle)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--accent-border)'
              }}
            >
              agent: {run.agent_name}
            </span>
          )}

          {run.workflow_id && (
            <span
              style={{
                fontSize: '0.72rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
                background: 'var(--bg-app)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <GitBranch size={10} color="var(--accent)" />
              {run.workflow_id} (v{run.workflow_version ?? 1})
            </span>
          )}

          {run.baseline_run_id && (
            <span
              style={{
                fontSize: '0.72rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--warning)',
                background: 'var(--warning-subtle)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--warning-border)'
              }}
            >
              Replay of #{run.baseline_run_id}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {run.baseline_run_id && onCompareClick && (
            <button
              onClick={() => onCompareClick(run.baseline_run_id!, run.id)}
              className="wb-btn wb-btn-secondary"
              style={{ color: 'var(--warning)', borderColor: 'var(--warning-border)' }}
            >
              <GitCompare size={12} /> Compare with Baseline
            </button>
          )}

          <button
            onClick={() => onReplayClick(run)}
            className="wb-btn wb-btn-primary"
          >
            <RotateCcw size={12} fill="#07090e" /> Replay with Changes
          </button>
        </div>
      </div>

      {/* Prompt Strip */}
      <div className="timeline-prompt-strip">
        <Terminal size={12} color="var(--accent)" />
        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>PROMPT:</span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
          "{run.config?.prompt || 'Default scenario prompt'}"
        </span>
      </div>

      {/* Behavioral Assertions Strip */}
      {assertions.length > 0 && (
        <div
          style={{
            background: allPassed ? 'rgba(67, 201, 154, 0.06)' : 'rgba(240, 112, 120, 0.08)',
            borderBottom: `1px solid ${allPassed ? 'var(--success-border)' : 'var(--error-border)'}`,
            padding: '0.45rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {allPassed ? (
              <ShieldCheck size={16} color="var(--success)" />
            ) : (
              <ShieldAlert size={16} color="var(--error)" />
            )}
            <span style={{ fontWeight: 600, color: allPassed ? 'var(--success)' : 'var(--error)' }}>
              {allPassed ? 'Behavioral Assertions: All Passed' : 'Behavioral Assertions: Safety Violation'}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              {assertions.map((a) => `${a.name} (${a.passed ? 'PASS' : 'FAIL'})`).join(', ')}
            </span>
          </div>

          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
            {assertions.find((a) => !a.passed)?.message || 'All constraints satisfied'}
          </span>
        </div>
      )}

      {/* Filter Strip */}
      <div className="timeline-filter-strip">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={12} color="var(--text-muted)" />
          {(['all', 'tools', 'model', 'errors'] as const).map((ft) => {
            const count =
              ft === 'all'
                ? events.length
                : ft === 'tools'
                ? events.filter((e) => e.type.startsWith('tool_')).length
                : ft === 'model'
                ? events.filter((e) => e.type.startsWith('model_')).length
                : events.filter((e) => e.type === 'error').length;
            return (
              <button
                key={ft}
                onClick={() => setFilterType(ft)}
                className={`explorer-filter-btn ${filterType === ft ? 'active' : ''}`}
              >
                {ft.toUpperCase()} ({count})
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <Clock size={11} />
          <span>{events.length} execution steps</span>
        </div>
      </div>

      {/* Events Scroll Area */}
      <div className="timeline-events-scroll">
        {filteredEvents.map((evt) => {
          const isSelected = evt.id === selectedEventId;
          const stepStr = String(evt.sequence).padStart(2, '0');

          // Build concise single-line summary
          let summaryStr = '';
          if (evt.type === 'tool_call') {
            summaryStr = evt.input ? JSON.stringify(evt.input) : '{}';
          } else if (evt.type === 'tool_result') {
            summaryStr = evt.output ? JSON.stringify(evt.output) : '{}';
          } else if (evt.type === 'model_output') {
            summaryStr =
              typeof evt.output === 'object' && evt.output?.thought
                ? evt.output.thought
                : JSON.stringify(evt.output || {});
          } else if (evt.type === 'error') {
            summaryStr =
              typeof evt.output === 'object' && evt.output?.message
                ? evt.output.message
                : JSON.stringify(evt.output || evt.metadata);
          } else {
            summaryStr = JSON.stringify(evt.input || evt.output || {});
          }

          const timeOffset = new Date(evt.timestamp).toLocaleTimeString([], {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3
          });

          return (
            <div
              key={evt.id}
              className={`event-row ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectEvent(evt)}
            >
              <span className="event-step-num">#{stepStr}</span>
              <span className={`event-type-badge badge-${evt.type}`}>{evt.type}</span>

              {/* Instrumentation distinction */}
              {evt.instrumentation_type === 'outer_sdk' ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '0.62rem',
                    fontFamily: 'var(--font-mono)',
                    color: '#89ddff',
                    background: 'rgba(137, 221, 255, 0.08)',
                    padding: '1px 5px',
                    borderRadius: '2px',
                    border: '1px solid rgba(137, 221, 255, 0.2)'
                  }}
                  title="SDK Outer-function event (captured automatically)"
                >
                  <Cpu size={9} /> SDK
                </span>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '0.62rem',
                    fontFamily: 'var(--font-mono)',
                    color: '#c792ea',
                    background: 'rgba(199, 146, 234, 0.08)',
                    padding: '1px 5px',
                    borderRadius: '2px',
                    border: '1px solid rgba(199, 146, 234, 0.2)'
                  }}
                  title="Developer-instrumented internal event"
                >
                  <Layers size={9} /> Internal
                </span>
              )}

              {/* Redacted tag */}
              {evt.is_redacted && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '0.62rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--warning)',
                    background: 'var(--warning-subtle)',
                    padding: '1px 5px',
                    borderRadius: '2px',
                    border: '1px solid var(--warning-border)'
                  }}
                  title="Backend redacted sensitive data"
                >
                  <EyeOff size={9} /> Redacted
                </span>
              )}

              <span className="event-name-text">{evt.name}</span>
              <span className="event-summary-text">{summaryStr}</span>
              <span className="event-time-text">{timeOffset}</span>
              <ChevronRight size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            </div>
          );
        })}
      </div>
    </main>
  );
};
