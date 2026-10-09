import React, { useState, useMemo } from 'react';
import {
  Search,
  Activity,
  CheckCircle,
  GitBranch,
  Layers,
  ChevronRight,
  RefreshCw,
  Terminal,
  AlertTriangle
} from 'lucide-react';
import type { Run } from '../types';
import { Badge } from './common/Badge';
import { LoadingSkeleton } from './common/LoadingSkeleton';
import { EmptyState } from './common/EmptyState';
import { ErrorState } from './common/ErrorState';

interface RunsDashboardProps {
  runs: Run[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSelectRun: (runId: string) => void;
  onNewRunClick: () => void;
}

export const RunsDashboard: React.FC<RunsDashboardProps> = ({
  runs,
  loading,
  error,
  onRefresh,
  onSelectRun,
  onNewRunClick
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'running' | 'failed'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'baseline' | 'replay'>('all');

  const stats = useMemo(() => {
    return {
      total: runs.length,
      completed: runs.filter((r) => r.status === 'completed').length,
      baselines: runs.filter((r) => !r.baseline_run_id).length,
      replays: runs.filter((r) => Boolean(r.baseline_run_id)).length
    };
  }, [runs]);

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      // Status filter
      if (statusFilter !== 'all' && run.status !== statusFilter) {
        return false;
      }
      // Type filter
      if (typeFilter === 'baseline' && run.baseline_run_id !== null) {
        return false;
      }
      if (typeFilter === 'replay' && run.baseline_run_id === null) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesId = run.id.toLowerCase().includes(query);
        const matchesPrompt = run.config?.prompt?.toLowerCase().includes(query);
        const matchesScenario = run.config?.scenario?.toLowerCase().includes(query);
        return matchesId || matchesPrompt || matchesScenario;
      }
      return true;
    });
  }, [runs, statusFilter, typeFilter, searchQuery]);

  return (
    <div>
      {/* Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(56, 189, 248, 0.12)' }}>
            <Activity size={22} color="var(--accent-cyan)" />
          </div>
          <div>
            <div className="stat-val">{stats.total}</div>
            <div className="stat-lbl">Total Executed Runs</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.12)' }}>
            <CheckCircle size={22} color="var(--accent-emerald)" />
          </div>
          <div>
            <div className="stat-val">{stats.completed}</div>
            <div className="stat-lbl">Completed Runs</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.12)' }}>
            <Layers size={22} color="var(--accent-indigo)" />
          </div>
          <div>
            <div className="stat-val">{stats.baselines}</div>
            <div className="stat-lbl">Baseline Traces</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.12)' }}>
            <GitBranch size={22} color="var(--accent-amber)" />
          </div>
          <div>
            <div className="stat-val">{stats.replays}</div>
            <div className="stat-lbl">Replayed Traces</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by run ID, prompt, or scenario..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Status filters */}
          <div className="filter-pills">
            {(['all', 'completed', 'failed'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`filter-btn ${statusFilter === st ? 'active' : ''}`}
              >
                {st === 'all' ? 'All Status' : st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>

          {/* Type filters */}
          <div className="filter-pills">
            {(['all', 'baseline', 'replay'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`filter-btn ${typeFilter === t ? 'active' : ''}`}
              >
                {t === 'all' ? 'All Types' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <button onClick={onRefresh} className="btn btn-secondary" title="Refresh runs">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Main Runs List */}
      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : error ? (
        <ErrorState
          title="Could not load agent runs"
          message={error}
          onRetry={onRefresh}
        />
      ) : filteredRuns.length === 0 ? (
        <EmptyState
          title={searchQuery ? 'No runs match your search query' : 'No agent runs recorded yet'}
          description={
            searchQuery
              ? 'Try adjusting your search terms or filters.'
              : 'Launch a sample scenario to generate the baseline trace.'
          }
          actionText="Create Sample Run"
          onAction={onNewRunClick}
        />
      ) : (
        <div className="runs-list">
          {filteredRuns.map((run) => {
            const formattedDate = new Date(run.created_at).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div
                key={run.id}
                className="run-card"
                onClick={() => onSelectRun(run.id)}
              >
                <div className="run-card-header">
                  <div className="run-id-badge">
                    <Terminal size={16} color="var(--accent-cyan)" />
                    <span>{run.id}</span>
                  </div>

                  <div className="run-badges-group">
                    <Badge variant="status" status={run.status} />
                    <Badge variant="scenario">{run.config?.scenario || 'refund_safety'}</Badge>
                    {run.baseline_run_id ? (
                      <Badge variant="replay">Replay of #{run.baseline_run_id}</Badge>
                    ) : (
                      <span
                        className="badge"
                        style={{
                          background: 'rgba(99, 102, 241, 0.1)',
                          color: '#c7d2fe',
                          border: '1px solid rgba(99, 102, 241, 0.2)'
                        }}
                      >
                        Baseline
                      </span>
                    )}
                  </div>
                </div>

                <div className="run-prompt-preview">
                  "{run.config?.prompt || 'Default scenario prompt'}"
                </div>

                <div className="run-card-footer">
                  <div className="run-metrics">
                    <span className="metric-item">
                      Events: <strong>{run.summary?.event_count ?? 0}</strong>
                    </span>
                    <span className="metric-item">
                      Tools: <strong>{run.summary?.tool_call_count ?? 0}</strong>
                    </span>
                    {run.summary?.error_count > 0 && (
                      <span className="metric-item" style={{ color: 'var(--accent-rose)' }}>
                        <AlertTriangle size={12} />
                        Errors: <strong>{run.summary.error_count}</strong>
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>Recorded: {formattedDate}</span>
                    <span style={{ color: 'var(--accent-cyan)', display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 500 }}>
                      Inspect Trace <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
