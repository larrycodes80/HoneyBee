import React, { useEffect, useState } from 'react';
import { Play, RotateCcw, GitCompare, Radio, Database } from 'lucide-react';
import { checkHealth, isForcingFixtures, setForceFixtures } from '../lib/api';

interface WorkbenchHeaderProps {
  currentView: 'trace' | 'diff';
  scenarioName?: string;
  hasDiffPair: boolean;
  onViewChange: (view: 'trace' | 'diff') => void;
  onNewRunClick: () => void;
  onReplayClick?: () => void;
}

export const WorkbenchHeader: React.FC<WorkbenchHeaderProps> = ({
  currentView,
  scenarioName = 'refund_safety',
  hasDiffPair,
  onViewChange,
  onNewRunClick,
  onReplayClick
}) => {
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'mock'>('mock');
  const [useFixtures, setUseFixturesState] = useState<boolean>(isForcingFixtures());

  const verifyBackend = async () => {
    const res = await checkHealth();
    if (res.isBackendLive && !isForcingFixtures()) {
      setBackendStatus('online');
    } else if (isForcingFixtures()) {
      setBackendStatus('mock');
    } else {
      setBackendStatus('offline');
    }
  };

  useEffect(() => {
    verifyBackend();
    const interval = setInterval(verifyBackend, 10000);
    return () => clearInterval(interval);
  }, []);

  const toggleFixtures = () => {
    const nextVal = !useFixtures;
    setForceFixtures(nextVal);
    setUseFixturesState(nextVal);
    verifyBackend();
  };

  return (
    <header className="wb-header">
      <div className="wb-header-left">
        <div className="wb-brand" onClick={() => onViewChange('trace')}>
          <div className="wb-brand-glyph">HB</div>
          <span>HoneyBee</span>
        </div>
        <span className="wb-brand-desc">Agent Execution Debugger</span>
      </div>

      <div className="wb-header-center">
        <div className="wb-scenario-chip">
          <span style={{ color: 'var(--text-muted)' }}>scenario:</span>
          <span>{scenarioName}</span>
        </div>

        {/* View Switcher Tabs */}
        <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-app)', padding: '2px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
          <button
            onClick={() => onViewChange('trace')}
            className={`wb-btn ${currentView === 'trace' ? 'wb-btn-secondary' : 'wb-btn-outline'}`}
            style={{ padding: '2px 8px', fontSize: '0.72rem', border: 'none' }}
          >
            Trace View
          </button>
          {hasDiffPair && (
            <button
              onClick={() => onViewChange('diff')}
              className={`wb-btn ${currentView === 'diff' ? 'wb-btn-secondary' : 'wb-btn-outline'}`}
              style={{ padding: '2px 8px', fontSize: '0.72rem', border: 'none', color: currentView === 'diff' ? 'var(--warning)' : undefined }}
            >
              <GitCompare size={12} /> Diff Comparison
            </button>
          )}
        </div>
      </div>

      <div className="wb-header-right">
        {/* Backend Connectivity Status */}
        <button
          onClick={toggleFixtures}
          className="wb-status-badge"
          title="Click to toggle between live backend API and local deterministic fixtures"
        >
          <span
            className={`wb-status-dot ${
              backendStatus === 'online' ? 'online' : 'offline'
            }`}
          />
          {backendStatus === 'online' ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Radio size={11} color="var(--success)" /> Live API (8000)
            </span>
          ) : backendStatus === 'mock' ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Database size={11} color="var(--warning)" /> Fixture Mode
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Database size={11} color="var(--warning)" /> Backend disconnected · Fixture mode
            </span>
          )}
        </button>

        {onReplayClick && (
          <button onClick={onReplayClick} className="wb-btn wb-btn-secondary" title="Replay selected run">
            <RotateCcw size={13} color="var(--warning)" /> Replay
          </button>
        )}

        <button onClick={onNewRunClick} className="wb-btn wb-btn-primary" id="btn-new-run">
          <Play size={12} fill="#07090e" /> New Run
        </button>
      </div>
    </header>
  );
};
