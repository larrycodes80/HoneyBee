import React from 'react';
import { GitCompare, ArrowDown, Sparkles } from 'lucide-react';

interface FirstDivergenceBannerProps {
  firstDivergenceSequence: number | null;
  baselineEventName?: string;
  replayEventName?: string;
  onJumpToDivergence: () => void;
}

export const FirstDivergenceBanner: React.FC<FirstDivergenceBannerProps> = ({
  firstDivergenceSequence,
  baselineEventName = 'issue_refund',
  replayEventName = 'fraud_check',
  onJumpToDivergence
}) => {
  if (firstDivergenceSequence === null) {
    return (
      <div
        style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '1.5rem'
        }}
      >
        <Sparkles size={20} color="var(--accent-emerald)" />
        <span style={{ fontSize: '0.9rem', color: 'var(--accent-emerald)', fontWeight: 500 }}>
          Traces are semantically identical. No divergence detected between baseline and replay.
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(99, 102, 241, 0.12))',
        border: '1px solid rgba(245, 158, 11, 0.4)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.1rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem',
        boxShadow: '0 4px 20px rgba(245, 158, 11, 0.1)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(245, 158, 11, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <GitCompare size={20} color="var(--accent-amber)" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
              First Divergence Detected at Sequence #{firstDivergenceSequence}
            </span>
            <span
              className="badge"
              style={{
                background: 'rgba(245, 158, 11, 0.2)',
                color: 'var(--accent-amber)',
                fontSize: '0.75rem'
              }}
            >
              CRITICAL CHANGE
            </span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Baseline initiated <strong style={{ color: 'var(--accent-rose)' }}>{baselineEventName}</strong> whereas
            Replay switched to <strong style={{ color: 'var(--accent-emerald)' }}>{replayEventName}</strong>.
          </div>
        </div>
      </div>

      <button
        onClick={onJumpToDivergence}
        className="btn btn-secondary"
        style={{
          borderColor: 'rgba(245, 158, 11, 0.4)',
          background: 'rgba(245, 158, 11, 0.15)',
          color: 'var(--accent-amber)'
        }}
      >
        <ArrowDown size={14} /> Jump to Sequence #{firstDivergenceSequence}
      </button>
    </div>
  );
};
