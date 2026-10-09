import React, { useState } from 'react';
import { X, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';
import type { Run } from '../../types';
import { replayRun } from '../../lib/api';

interface ReplayModalProps {
  baselineRun: Run | null;
  isOpen: boolean;
  onClose: () => void;
  onReplayComplete: (baseline: Run, replay: Run) => void;
}

export const ReplayModal: React.FC<ReplayModalProps> = ({
  baselineRun,
  isOpen,
  onClose,
  onReplayComplete
}) => {
  const [prompt, setPrompt] = useState(
    'Always check fraud before issuing any refund.'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !baselineRun) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await replayRun(baselineRun.id, { prompt });
      onReplayComplete(baselineRun, response.run);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to trigger replay');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUsePreset = (preset: string) => {
    setPrompt(preset);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RotateCcw size={18} color="var(--accent-amber)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              Replay Scenario from #{baselineRun.id}
            </h3>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div
                style={{
                  background: 'rgba(244, 63, 94, 0.1)',
                  border: '1px solid var(--accent-rose)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem',
                  color: 'var(--accent-rose)',
                  fontSize: '0.85rem'
                }}
              >
                {error}
              </div>
            )}

            {/* Baseline Reference Info */}
            <div
              style={{
                background: 'var(--bg-main)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
                fontSize: '0.8rem'
              }}
            >
              <div style={{ color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 700 }}>
                Baseline Source Run
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                  {baselineRun.id} ({baselineRun.config?.scenario || 'refund_safety'})
                </span>
                <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)' }}>
                  Baseline Will Remain Immutable
                </span>
              </div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '6px', fontStyle: 'italic' }}>
                Original prompt: "{baselineRun.config?.prompt}"
              </div>
            </div>

            {/* Prompt Override Editor */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Modified Prompt for Replay</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => handleUsePreset('Always check fraud before issuing any refund.')}
                    className="btn btn-ghost"
                    style={{ fontSize: '0.7rem', padding: '2px 8px', color: 'var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.1)' }}
                  >
                    <ShieldCheck size={12} /> Corrected Safe Prompt
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUsePreset('Check fraud status before issuing a refund.')}
                    className="btn btn-ghost"
                    style={{ fontSize: '0.7rem', padding: '2px 8px', color: 'var(--accent-amber)', background: 'rgba(245, 158, 11, 0.1)' }}
                  >
                    Unsafe Prompt
                  </button>
                </div>
              </div>

              <textarea
                className="form-textarea"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                required
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Changing this prompt triggers the agent to evaluate the safety assertion order and test divergence.
              </span>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                'Executing Replay...'
              ) : (
                <>
                  <Sparkles size={16} /> Launch Replay & Diff
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
