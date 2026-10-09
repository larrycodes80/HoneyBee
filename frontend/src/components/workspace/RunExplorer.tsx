import React, { useState, useMemo } from 'react';
import { Search, RotateCcw, GitCompare, RefreshCw, ChevronLeft, ChevronRight, GitBranch, Bot } from 'lucide-react';
import type { Run } from '../../types';

interface RunExplorerProps {
  runs: Run[];
  selectedRunId: string | null;
  loading: boolean;
  totalRuns?: number;
  limit?: number;
  offset?: number;
  onPageChange?: (newOffset: number) => void;
  onSelectRun: (runId: string) => void;
  onRefresh: () => void;
  onReplayRun?: (run: Run) => void;
  onCompareRun?: (baselineId: string, replayId: string) => void;
}

export const RunExplorer: React.FC<RunExplorerProps> = ({
  runs,
  selectedRunId,
  loading,
  totalRuns = runs.length,
  limit = 50,
  offset = 0,
  onPageChange,
  onSelectRun,
  onRefresh,
  onReplayRun,
  onCompareRun
}) => {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'baseline' | 'replay'>('all');

  const filteredRuns = useMemo(() => {
    return runs.filter((r) => {
      if (filterType === 'baseline' && r.baseline_run_id !== null) return false;
      if (filterType === 'replay' && r.baseline_run_id === null) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          r.id.toLowerCase().includes(q) ||
          r.config?.prompt?.toLowerCase().includes(q) ||
          r.config?.scenario?.toLowerCase().includes(q) ||
          r.agent_name?.toLowerCase().includes(q) ||
          r.workflow_id?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [runs, filterType, search]);

  const hasNextPage = offset + limit < totalRuns;
  const hasPrevPage = offset > 0;

  return (
    <aside className="pane-explorer">
      {/* Top Filter and Search */}
      <div className="explorer-header">
        <div style={{ position: 'relative' }}>
          <Search
            size={12}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="explorer-search-input"
            placeholder="Search runs, agents, workflows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="explorer-filters">
            {(['all', 'baseline', 'replay'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`explorer-filter-btn ${filterType === t ? 'active' : ''}`}
              >
                {t === 'all' ? 'All' : t === 'baseline' ? 'Base' : 'Replay'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {totalRuns} total
            </span>
            <button
              onClick={onRefresh}
              className="wb-btn wb-btn-outline"
              style={{ padding: '1px 4px', fontSize: '0.68rem', border: 'none' }}
              title="Refresh runs"
            >
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Selectable Run Rows */}
      <div className="explorer-run-list">
        {loading && runs.length === 0 ? (
          <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }}>
            Loading executions...
          </div>
        ) : filteredRuns.length === 0 ? (
          <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }}>
            No executions found
          </div>
        ) : (
          filteredRuns.map((run) => {
            const isSelected = run.id === selectedRunId;
            const timeStr = new Date(run.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            });

            const agentName = run.agent_name || run.config?.agent_name;
            const workflowId = run.workflow_id || run.config?.workflow_id;
            const workflowVer = run.workflow_version ?? run.config?.workflow_version;

            return (
              <div
                key={run.id}
                className={`run-item-row ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectRun(run.id)}
              >
                <div className="run-item-top">
                  <div className="run-item-id">
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor:
                          run.status === 'completed'
                            ? 'var(--success)'
                            : run.status === 'failed'
                            ? 'var(--error)'
                            : 'var(--accent)'
                      }}
                    />
                    <span>{run.id}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {run.baseline_run_id ? (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--warning)',
                          background: 'var(--warning-subtle)',
                          padding: '0 4px',
                          borderRadius: '2px'
                        }}
                      >
                        REPLAY
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-muted)'
                        }}
                      >
                        BASE
                      </span>
                    )}

                    {/* Quick Action Icons */}
                    {onReplayRun && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onReplayRun(run);
                        }}
                        className="wb-btn wb-btn-outline"
                        style={{ padding: '2px', border: 'none', color: 'var(--text-muted)' }}
                        title="Replay this run"
                      >
                        <RotateCcw size={11} />
                      </button>
                    )}

                    {run.baseline_run_id && onCompareRun && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCompareRun(run.baseline_run_id!, run.id);
                        }}
                        className="wb-btn wb-btn-outline"
                        style={{ padding: '2px', border: 'none', color: 'var(--warning)' }}
                        title="Compare with baseline"
                      >
                        <GitCompare size={11} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Agent & Workflow tags if available */}
                {(agentName || workflowId) && (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', margin: '2px 0' }}>
                    {agentName && (
                      <span
                        style={{
                          fontSize: '0.62rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--accent)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}
                      >
                        <Bot size={10} /> {agentName}
                      </span>
                    )}
                    {workflowId && (
                      <span
                        style={{
                          fontSize: '0.62rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}
                      >
                        <GitBranch size={10} /> {workflowId} {workflowVer ? `v${workflowVer}` : ''}
                      </span>
                    )}
                  </div>
                )}

                <div className="run-item-meta">
                  <span>{timeStr}</span>
                  <span>•</span>
                  <span>{run.summary?.event_count ?? 0} events</span>
                  {run.baseline_run_id && (
                    <>
                      <span>•</span>
                      <span style={{ color: 'var(--warning)' }}>← {run.baseline_run_id}</span>
                    </>
                  )}
                </div>

                <div className="run-item-prompt">
                  "{run.config?.prompt || 'Default scenario'}"
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      {onPageChange && totalRuns > limit && (
        <div
          style={{
            padding: '6px 10px',
            borderTop: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.7rem',
            color: 'var(--text-muted)'
          }}
        >
          <span>
            {offset + 1}–{Math.min(offset + limit, totalRuns)} of {totalRuns}
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => onPageChange(Math.max(0, offset - limit))}
              disabled={!hasPrevPage}
              className="wb-btn wb-btn-outline"
              style={{ padding: '2px 6px', fontSize: '0.68rem' }}
            >
              <ChevronLeft size={11} /> Prev
            </button>
            <button
              onClick={() => onPageChange(offset + limit)}
              disabled={!hasNextPage}
              className="wb-btn wb-btn-outline"
              style={{ padding: '2px 6px', fontSize: '0.68rem' }}
            >
              Next <ChevronRight size={11} />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};

