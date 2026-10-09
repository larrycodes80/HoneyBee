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
  const [expectedWorkflow, setExpectedWorkflow] = useState(
    baselineRun?.expected_workflow || ''
  );
  const [replayPolicy, setReplayPolicy] = useState('strict_match');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !baselineRun) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await replayRun(baselineRun.id, {
        prompt,
        expected_workflow: expectedWorkflow.trim() || undefined,
      });
      onReplayComplete(baselineRun, response.run);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to trigger scenario replay');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RotateCcw size={15} color="var(--warning)" />
            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
              Replay Execution · Baseline #{baselineRun.id}
            </span>
          </div>
          <button onClick={onClose} className="wb-btn wb-btn-outline" style={{ padding: '2px 4px' }}>
            <X size={12} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body-area">
            {error && (
              <div
                style={{
                  background: 'var(--error-subtle)',
                  border: '1px solid var(--error-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 10px',
                  color: 'var(--error)',
                  fontSize: '0.75rem'
                }}
              >
                {error}
              </div>
            )}

            {/* Baseline Reference Info */}
            <div
              style={{
                background: 'var(--bg-app)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
                fontSize: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 700 }}>
                  Immutable Baseline Target
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                  {baselineRun.id}
                </span>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.72rem' }}>
                Original prompt: "{baselineRun.config?.prompt}"
              </div>
            </div>

            {/* Editable Prompt */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className="wb-form-label">System Prompt Override</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setPrompt('Always check fraud before issuing any refund.')}
                    className="wb-btn wb-btn-outline"
                    style={{ fontSize: '0.68rem', padding: '1px 6px', color: 'var(--success)' }}
                  >
                    <ShieldCheck size={10} /> Safe Preset
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrompt('Check fraud status before issuing a refund.')}
                    className="wb-btn wb-btn-outline"
                    style={{ fontSize: '0.68rem', padding: '1px 6px', color: 'var(--warning)' }}
                  >
                    Unsafe Preset
                  </button>
                </div>
              </div>

              <textarea
                className="wb-textarea"
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                required
              />
            </div>

            {/* Expected Workflow (Intent) */}
            <div>
              <label className="wb-form-label">Expected Workflow (Intent Specification)</label>
              <textarea
                className="wb-textarea"
                rows={2}
                value={expectedWorkflow}
                onChange={(e) => setExpectedWorkflow(e.target.value)}
                placeholder="Inherited from baseline or specify updated intent constraints..."
              />
            </div>

            {/* Replay Policy Selector */}
            <div>
              <label className="wb-form-label">Tool-Result Replay Policy</label>
              <select
                className="wb-input"
                value={replayPolicy}
                onChange={(e) => setReplayPolicy(e.target.value)}
              >
                <option value="strict_match">Controlled Fixtures · Strict Tool & Arg Matching</option>
                <option value="deterministic_simulation">Deterministic Simulator (Zero External Side Effects)</option>
              </select>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                Tool results are re-evaluated based on actual prompt decisions to ensure verifiable divergence.
              </span>
            </div>
          </div>

          <div className="modal-footer-bar">
            <button type="button" onClick={onClose} className="wb-btn wb-btn-secondary" disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="wb-btn wb-btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                'Executing Replay...'
              ) : (
                <>
                  <Sparkles size={12} fill="#07090e" /> Replay with Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
