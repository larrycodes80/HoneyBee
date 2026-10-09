import React, { useEffect, useState } from 'react';
import { Activity, Plus, Database, Radio } from 'lucide-react';
import { checkHealth, isForcingFixtures, setForceFixtures } from '../lib/api';

interface HeaderProps {
  onNewRunClick: () => void;
  onHomeClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onNewRunClick, onHomeClick }) => {
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
    <header className="app-header">
      <div className="header-inner">
        <div className="brand" onClick={onHomeClick}>
          <div className="brand-icon">
            <Activity size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="brand-title">TraceForge</span>
              <span className="brand-tag">Agent Harness</span>
            </div>
          </div>
        </div>

        <div className="header-actions">
          <button
            onClick={toggleFixtures}
            className="status-pill"
            style={{ cursor: 'pointer', background: 'transparent' }}
            title="Click to toggle between Live API and Local Fixtures"
          >
            <span
              className={`status-dot ${
                backendStatus === 'online'
                  ? 'online'
                  : backendStatus === 'mock'
                  ? 'mock'
                  : 'offline'
              }`}
            />
            {backendStatus === 'online' ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Radio size={12} color="var(--accent-emerald)" /> Live API (8000)
              </span>
            ) : backendStatus === 'mock' ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Database size={12} color="var(--accent-amber)" /> Fixture Mode
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Database size={12} color="var(--accent-rose)" /> Backend Offline (Using Fixtures)
              </span>
            )}
          </button>

          <button onClick={onNewRunClick} className="btn btn-primary" id="btn-new-run">
            <Plus size={16} /> New Sample Run
          </button>
        </div>
      </div>
    </header>
  );
};
