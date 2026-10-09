import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import type { AssertionResult } from '../../types';
import { getAssertions } from '../../lib/api';

interface AssertionResultsPanelProps {
  runId: string;
  onRefresh?: () => void;
}

export const AssertionResultsPanel: React.FC<AssertionResultsPanelProps> = ({ runId }) => {
  const [assertions, setAssertions] = useState<AssertionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssertions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAssertions(runId);
      setAssertions(res.results);
    } catch (err: any) {
      setError(err?.message || 'Failed to evaluate assertions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssertions();
  }, [runId]);

  const allPassed = assertions.length > 0 && assertions.every((a) => a.passed);

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: `1px solid ${allPassed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem',
        marginTop: '1.25rem',
        marginBottom: '1.5rem',
        boxShadow: 'var(--shadow-md)'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {allPassed ? (
            <ShieldCheck size={22} color="var(--accent-emerald)" />
          ) : (
            <ShieldAlert size={22} color="var(--accent-rose)" />
          )}
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Behavioral Safety Assertions
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Evaluated against chronological trace events for run{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{runId}</span>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            className={`badge ${allPassed ? 'badge-completed' : 'badge-failed'}`}
            style={{ fontSize: '0.8rem', padding: '4px 10px' }}
          >
            {allPassed ? 'ALL CONSTRAINTS PASSED' : 'SAFETY VIOLATION DETECTED'}
          </span>
          <button
            onClick={fetchAssertions}
            className="btn btn-ghost"
            style={{ padding: '4px 6px' }}
            title="Re-evaluate assertions"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Evaluating trace constraints...
        </div>
      ) : error ? (
        <div style={{ color: 'var(--accent-rose)', fontSize: '0.85rem' }}>{error}</div>
      ) : assertions.length === 0 ? (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No assertions registered.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {assertions.map((assertion, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                background: 'var(--bg-main)',
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${
                  assertion.passed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.25)'
                }`
              }}
            >
              <div style={{ marginTop: '2px' }}>
                {assertion.passed ? (
                  <CheckCircle2 size={18} color="var(--accent-emerald)" />
                ) : (
                  <XCircle size={18} color="var(--accent-rose)" />
                )}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      color: assertion.passed ? 'var(--accent-emerald)' : 'var(--accent-rose)'
                    }}
                  >
                    {assertion.name}
                  </span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: assertion.passed
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'rgba(244, 63, 94, 0.15)',
                      color: assertion.passed ? 'var(--accent-emerald)' : 'var(--accent-rose)'
                    }}
                  >
                    {assertion.passed ? 'PASS' : 'FAIL'}
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  {assertion.message}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
