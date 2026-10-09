import React, { useState, useEffect } from 'react';
import {
  Brain,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import type { Run, TraceEvent, EvaluationResponse, SampleTraceItem } from '../../types';
import { getEvaluation, evaluateRun, listSampleTraces, runAudit } from '../../lib/api';

interface IntentEvaluationPanelProps {
  run: Run;
  events: TraceEvent[];
  onSelectEvent: (event: TraceEvent) => void;
}

export const IntentEvaluationPanel: React.FC<IntentEvaluationPanelProps> = ({
  run,
  events,
  onSelectEvent,
}) => {
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [customWorkflow, setCustomWorkflow] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sampleTraces, setSampleTraces] = useState<SampleTraceItem[]>([]);
  const [selectedSampleId, setSelectedSampleId] = useState<string>('');

  // Fetch sample traces once
  useEffect(() => {
    listSampleTraces().then((traces) => {
      setSampleTraces(traces);
    }).catch(() => {});
  }, []);

  // Fetch or evaluate whenever run changes
  useEffect(() => {
    let isMounted = true;
    setError(null);
    setSelectedSampleId('');
    const fetchEval = async () => {
      setLoading(true);
      try {
        const res = await getEvaluation(run.id);
        if (isMounted) {
          setEvaluation(res);
          setCustomWorkflow(res.expected_workflow);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Failed to retrieve run evaluation');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchEval();
    return () => {
      isMounted = false;
    };
  }, [run.id]);

  const handleRunEvaluation = async () => {
    setLoading(true);
    setError(null);
    try {
      if (selectedSampleId) {
        // Run audit on selected sample trace
        const res = await runAudit({
          sample_trace_id: selectedSampleId,
          expected_workflow: customWorkflow.trim() || undefined,
        });
        setEvaluation(res);
      } else {
        // Run audit on currently selected workspace run
        const payload = customWorkflow.trim()
          ? { expected_workflow: customWorkflow.trim() }
          : undefined;
        const res = await evaluateRun(run.id, payload);
        setEvaluation(res);
      }
      setIsEditing(false);
    } catch (err: any) {
      setError(err?.message || 'Evaluation request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSample = (sampleId: string) => {
    setSelectedSampleId(sampleId);
    if (!sampleId) {
      setCustomWorkflow(evaluation?.expected_workflow || run.expected_workflow || '');
      return;
    }
    const sample = sampleTraces.find((s) => s.id === sampleId);
    if (sample) {
      setCustomWorkflow(sample.expected_workflow);
    }
  };

  const findEventById = (id: string | null | undefined): TraceEvent | undefined => {
    if (!id) return undefined;
    return events.find((e) => e.id === id);
  };

  const divergenceEvent = findEventById(evaluation?.first_divergence_event_id);

  const getVerdictBadge = () => {
    if (!evaluation) return null;
    const verdict = evaluation.verdict || (evaluation.status === 'passed' ? 'PASS' : evaluation.status === 'failed' ? 'FAIL' : 'INCONCLUSIVE');
    switch (verdict) {
      case 'PASS':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.72rem',
              fontWeight: 700,
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: 'var(--success, #10b981)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            <CheckCircle2 size={13} />
            STATUS: PASSED
          </span>
        );
      case 'FAIL':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.72rem',
              fontWeight: 700,
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: 'var(--error, #ef4444)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            <XCircle size={13} />
            STATUS: FAILED
          </span>
        );
      case 'INCONCLUSIVE':
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.72rem',
              fontWeight: 700,
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: 'var(--warning, #f59e0b)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }}
          >
            <AlertTriangle size={13} />
            STATUS: NEEDS REVIEW
          </span>
        );
    }
  };

  const getSeverityStyle = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' };
      case 'high':
        return { bg: 'rgba(249, 115, 22, 0.15)', color: '#f97316', border: 'rgba(249, 115, 22, 0.3)' };
      case 'medium':
        return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
      default:
        return { bg: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', border: 'rgba(99, 102, 241, 0.3)' };
    }
  };

  const isLiveDigitalOcean = evaluation?.provider_metadata?.provider === 'digitalocean';

  return (
    <div
      style={{
        margin: '12px 16px',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface-active, rgba(255,255,255,0.02))',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Brain size={16} color="var(--accent, #6366f1)" />
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            DigitalOcean Gemma 4 — Semantic Trace Audit
          </span>
          {evaluation && (
            <span
              style={{
                fontSize: '0.65rem',
                padding: '2px 8px',
                borderRadius: '10px',
                backgroundColor: isLiveDigitalOcean ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-app)',
                color: isLiveDigitalOcean ? 'var(--success, #10b981)' : 'var(--text-muted)',
                border: `1px solid ${isLiveDigitalOcean ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title={evaluation.provider_metadata?.fallback_reason || 'Inference engine active'}
            >
              <Sparkles size={10} />
              {isLiveDigitalOcean ? 'DigitalOcean Gemma 4 (Live)' : 'Deterministic Test Provider (Fallback)'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {getVerdictBadge()}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="wb-btn wb-btn-outline"
            style={{ padding: '2px 8px', fontSize: '0.7rem' }}
          >
            {isEditing ? 'Close Edit' : 'Edit Intent'}
          </button>
          <button
            onClick={handleRunEvaluation}
            disabled={loading}
            className="wb-btn wb-btn-secondary"
            style={{ padding: '2px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <RotateCcw size={12} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Auditing with Gemma...' : 'Run Audit'}
          </button>
        </div>
      </div>

      {/* Error alert banner */}
      {error && (
        <div
          style={{
            margin: '8px 12px 0',
            padding: '8px 10px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.72rem',
            color: 'var(--error, #ef4444)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      <div style={{ padding: '12px' }}>
        {/* Sample Trace Selection Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '10px',
            fontSize: '0.72rem',
            backgroundColor: 'var(--bg-app)',
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Audit Target:</span>
          <select
            value={selectedSampleId}
            onChange={(e) => handleSelectSample(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 8px',
              fontSize: '0.72rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">Current Workspace Run ({run.id})</option>
            {sampleTraces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {selectedSampleId && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', marginLeft: 'auto' }}>
              Sample Trace Loaded
            </span>
          )}
        </div>

        {/* Expected Workflow Display / Edit */}
        {isEditing ? (
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Developer Intended Workflow (Natural Language):
            </label>
            <textarea
              value={customWorkflow}
              onChange={(e) => setCustomWorkflow(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 8px',
                color: 'var(--text-primary)',
                fontSize: '0.75rem',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
              placeholder="e.g. Check the transaction for fraud. If flagged, do not issue a refund..."
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button
                onClick={handleRunEvaluation}
                disabled={loading}
                className="wb-btn wb-btn-primary"
                style={{ padding: '3px 10px', fontSize: '0.72rem' }}
              >
                {loading ? 'Auditing with Gemma...' : 'Run Audit with Updated Intent'}
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '8px 10px',
              backgroundColor: 'var(--bg-app)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              marginBottom: '10px',
              fontSize: '0.74rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.4,
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--text-muted)', marginRight: '6px' }}>
              Intended Workflow:
            </span>
            "{evaluation?.expected_workflow || run.expected_workflow || 'Default refund safety workflow'}"
          </div>
        )}

        {/* Audit Summary Banner */}
        {evaluation?.summary && (
          <div
            style={{
              padding: '8px 10px',
              backgroundColor: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '10px',
              fontSize: '0.74rem',
              color: 'var(--text-primary)',
              lineHeight: 1.4,
            }}
          >
            <span style={{ fontWeight: 700, color: 'var(--accent, #6366f1)', marginRight: '6px' }}>
              Audit Summary:
            </span>
            {evaluation.summary}
          </div>
        )}

        {/* Expected vs Observed Behavior Comparison */}
        {evaluation && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              marginBottom: '10px',
            }}
          >
            <div
              style={{
                padding: '8px',
                backgroundColor: 'rgba(99, 102, 241, 0.05)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: 'var(--accent, #6366f1)',
                  marginBottom: '4px',
                }}
              >
                Expected Behavior
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-primary)', lineHeight: 1.35 }}>
                {evaluation.expected_behavior}
              </div>
            </div>

            <div
              style={{
                padding: '8px',
                backgroundColor:
                  evaluation.verdict === 'FAIL' || evaluation.status === 'failed'
                    ? 'rgba(239, 68, 68, 0.05)'
                    : 'rgba(16, 185, 129, 0.05)',
                border:
                  evaluation.verdict === 'FAIL' || evaluation.status === 'failed'
                    ? '1px solid rgba(239, 68, 68, 0.2)'
                    : '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color:
                    evaluation.verdict === 'FAIL' || evaluation.status === 'failed'
                      ? 'var(--error, #ef4444)'
                      : 'var(--success, #10b981)',
                  marginBottom: '4px',
                }}
              >
                Observed Behavior
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-primary)', lineHeight: 1.35 }}>
                {evaluation.observed_behavior}
              </div>
            </div>
          </div>
        )}

        {/* Divergence & Evidence Row */}
        {evaluation && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              marginBottom: '10px',
              padding: '6px 8px',
              backgroundColor: 'var(--bg-app)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {/* First Divergence */}
            {divergenceEvent ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>First Divergence:</span>
                <button
                  onClick={() => onSelectEvent(divergenceEvent)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    color: 'var(--error, #ef4444)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '0.68rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  title="Click to inspect this event in Inspector"
                >
                  Step #{divergenceEvent.sequence}: {divergenceEvent.name}
                  <ExternalLink size={10} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>First Divergence:</span>
                <span style={{ fontSize: '0.68rem', color: 'var(--success, #10b981)', fontWeight: 600 }}>
                  None (Conforms to specification)
                </span>
              </div>
            )}

            {/* Evidence Events */}
            {evaluation.evidence_event_ids.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Trace Evidence:</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {evaluation.evidence_event_ids.map((eid) => {
                    const evt = findEventById(eid);
                    return (
                      <button
                        key={eid}
                        onClick={() => evt && onSelectEvent(evt)}
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-default)',
                          borderRadius: '3px',
                          padding: '1px 5px',
                          fontSize: '0.65rem',
                          cursor: evt ? 'pointer' : 'default',
                        }}
                        title={evt ? `Inspect Step #${evt.sequence}: ${evt.name}` : eid}
                      >
                        {evt ? `#${evt.sequence} ${evt.name}` : eid.substring(0, 8)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Structured Findings List */}
        {evaluation?.findings && evaluation.findings.length > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <div
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <ShieldAlert size={12} />
              Evidence-Backed Audit Findings ({evaluation.findings.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {evaluation.findings.map((finding, idx) => {
                const sStyle = getSeverityStyle(finding.severity);
                return (
                  <div
                    key={idx}
                    style={{
                      padding: '8px 10px',
                      backgroundColor: 'var(--bg-app)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.72rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span
                        style={{
                          padding: '1px 6px',
                          borderRadius: '3px',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          backgroundColor: sStyle.bg,
                          color: sStyle.color,
                          border: `1px solid ${sStyle.border}`,
                          textTransform: 'uppercase',
                        }}
                      >
                        {finding.severity}
                      </span>
                      <span
                        style={{
                          padding: '1px 6px',
                          borderRadius: '3px',
                          fontSize: '0.65rem',
                          backgroundColor: 'var(--bg-surface)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        {finding.category.replace('_', ' ')}
                      </span>
                      {finding.evidence_event_ids.length > 0 && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                          Evidence: {finding.evidence_event_ids.join(', ')}
                        </span>
                      )}
                    </div>
                    <div style={{ color: 'var(--text-primary)', marginBottom: '3px' }}>
                      {finding.explanation}
                    </div>
                    {finding.recommended_correction && (
                      <div style={{ color: 'var(--accent, #818cf8)', fontSize: '0.7rem' }}>
                        <span style={{ fontWeight: 600 }}>Recommendation: </span>
                        {finding.recommended_correction}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Diagnosis & Suggested Correction */}
        {evaluation && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontSize: '0.72rem',
            }}
          >
            <div style={{ color: 'var(--text-secondary)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginRight: '6px' }}>
                Diagnosis:
              </span>
              {evaluation.reason}
            </div>

            {evaluation.suggested_correction && (
              <div
                style={{
                  color: 'var(--accent, #818cf8)',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '4px',
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  Suggested Correction:
                </span>
                <span>{evaluation.suggested_correction}</span>
              </div>
            )}

            {evaluation.limitations && (
              <div style={{ color: 'var(--warning, #f59e0b)', fontSize: '0.68rem', fontStyle: 'italic' }}>
                Limitations / Notice: {evaluation.limitations}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
