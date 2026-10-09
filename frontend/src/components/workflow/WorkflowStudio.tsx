import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  Trash2,
  RefreshCw,
  Send,
  Lock,
  FileText,
  AlertTriangle,
  HelpCircle,
  Info
} from 'lucide-react';
import type {
  Workflow,
  WorkflowSpecification,
  ClarificationQuestion,
  CreateWorkflowDraftPayload
} from '../../types';
import {
  listWorkflows,
  createWorkflowDraft,
  submitInterviewAnswers,
  updateWorkflowDraft,
  approveWorkflow,
  ApiError
} from '../../lib/api';

interface WorkflowStudioProps {
  onWorkflowSelected?: (workflow: Workflow) => void;
}

export const WorkflowStudio: React.FC<WorkflowStudioProps> = ({ onWorkflowSelected }) => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backendPending, setBackendPending] = useState<boolean>(false);

  // Form states for draft creation
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');

  // Clarification interview answer state
  const [interviewAnswers, setInterviewAnswers] = useState<Record<string, string>>({});

  // Editable specification state for active workflow
  const [editableSpec, setEditableSpec] = useState<WorkflowSpecification | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const activeWorkflow = workflows.find((w) => w.id === selectedWorkflowId) || null;

  const loadWorkflowsList = useCallback(async (selectIdAfterLoad?: string) => {
    setLoading(true);
    setErrorMessage(null);
    setBackendPending(false);
    try {
      const items = await listWorkflows();
      setWorkflows(items);
      const targetId = selectIdAfterLoad || selectedWorkflowId || (items.length > 0 ? items[0].id : null);
      if (targetId) {
        setSelectedWorkflowId(targetId);
      }
    } catch (err: any) {
      if (err instanceof ApiError && (err.status === 404 || err.code === 'NETWORK_ERROR')) {
        setBackendPending(true);
        setErrorMessage(
          err.message || 'Workflow API endpoints are being finalized by Backend Developers 1 & 2.'
        );
      } else {
        setErrorMessage(err.message || 'Failed to retrieve workflows.');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedWorkflowId]);

  useEffect(() => {
    loadWorkflowsList();
  }, [loadWorkflowsList]);

  // Sync active workflow into editable specification state
  useEffect(() => {
    if (activeWorkflow) {
      setEditableSpec(JSON.parse(JSON.stringify(activeWorkflow.specification)));
      const initialAnswers: Record<string, string> = {};
      activeWorkflow.clarification_questions.forEach((q) => {
        initialAnswers[q.id] = q.answer || '';
      });
      setInterviewAnswers(initialAnswers);
      setIsCreatingNew(false);
      setSaveSuccessMsg(null);
      if (onWorkflowSelected) {
        onWorkflowSelected(activeWorkflow);
      }
    } else {
      setEditableSpec(null);
    }
  }, [activeWorkflow, onWorkflowSelected]);

  // Handle draft creation
  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) return;

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const payload: CreateWorkflowDraftPayload = {
        name: newTitle.trim(),
        description: newDescription.trim()
      };
      const created = await createWorkflowDraft(payload);
      setWorkflows((prev) => [created, ...prev]);
      setSelectedWorkflowId(created.id);
      setIsCreatingNew(false);
      setNewTitle('');
      setNewDescription('');
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Unable to generate workflow draft. Check model provider or backend connection.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Handle interview answers submission
  const handleSubmitAnswers = async () => {
    if (!activeWorkflow) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const answersPayload = Object.entries(interviewAnswers).map(([qid, ans]) => ({
        question_id: qid,
        answer: ans
      }));
      const updated = await submitInterviewAnswers(activeWorkflow.id, { answers: answersPayload });
      setWorkflows((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      setSaveSuccessMsg('Clarification answers recorded & specification refined.');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit interview answers.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle saving specification changes
  const handleSaveDraftChanges = async () => {
    if (!activeWorkflow || !editableSpec) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const updated = await updateWorkflowDraft(activeWorkflow.id, {
        specification: editableSpec
      });
      setWorkflows((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      setSaveSuccessMsg('Workflow specification draft updated.');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update workflow draft.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle explicit workflow approval
  const handleApproveWorkflow = async () => {
    if (!activeWorkflow) return;
    if (activeWorkflow.status === 'approved') return;

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const approved = await approveWorkflow(activeWorkflow.id);
      // Only set to approved when backend confirms approval response
      setWorkflows((prev) => prev.map((w) => (w.id === approved.id ? approved : w)));
      setSaveSuccessMsg(`Workflow v${approved.version} officially approved!`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Approval rejected by backend.');
    } finally {
      setActionLoading(false);
    }
  };

  // Helpers for editing spec section items
  const handleAddSpecItem = (sectionKey: keyof WorkflowSpecification) => {
    if (!editableSpec || activeWorkflow?.status === 'approved') return;
    setEditableSpec({
      ...editableSpec,
      [sectionKey]: [...editableSpec[sectionKey], '']
    });
  };

  const handleUpdateSpecItem = (
    sectionKey: keyof WorkflowSpecification,
    index: number,
    value: string
  ) => {
    if (!editableSpec || activeWorkflow?.status === 'approved') return;
    const items = [...editableSpec[sectionKey]];
    items[index] = value;
    setEditableSpec({
      ...editableSpec,
      [sectionKey]: items
    });
  };

  const handleRemoveSpecItem = (sectionKey: keyof WorkflowSpecification, index: number) => {
    if (!editableSpec || activeWorkflow?.status === 'approved') return;
    const items = editableSpec[sectionKey].filter((_, i) => i !== index);
    setEditableSpec({
      ...editableSpec,
      [sectionKey]: items
    });
  };

  const specSections: Array<{
    key: keyof WorkflowSpecification;
    title: string;
    description: string;
    color: string;
  }> = [
    {
      key: 'required_outcomes',
      title: 'Required Outcomes',
      description: 'Definitive success criteria and verifiable end states that must be achieved.',
      color: 'var(--success)'
    },
    {
      key: 'required_conditions',
      title: 'Required Conditions',
      description: 'Preconditions, validation gates, and environment states required before execution.',
      color: 'var(--accent)'
    },
    {
      key: 'forbidden_actions',
      title: 'Forbidden Actions',
      description: 'Strict prohibitions (e.g. issuing refund without prior fraud check).',
      color: 'var(--error)'
    },
    {
      key: 'safety_invariants',
      title: 'Safety Invariants',
      description: 'Global invariants that must never be violated across any tool step.',
      color: 'var(--warning)'
    },
    {
      key: 'acceptable_alternatives',
      title: 'Acceptable Alternatives',
      description: 'Permitted recovery branches or graceful fallbacks if primary path fails.',
      color: 'var(--text-secondary)'
    },
    {
      key: 'preferences',
      title: 'Execution Preferences',
      description: 'Optimization priorities such as latency, token budget, or tool selection.',
      color: 'var(--accent-subtle)'
    },
    {
      key: 'unresolved_assumptions',
      title: 'Unresolved Assumptions',
      description: 'Ambiguities or external dependencies requiring verification.',
      color: '#e5c07b'
    }
  ];

  return (
    <div className="workflow-studio-root">
      {/* Sidebar: Workflows list & New Workflow button */}
      <aside className="workflow-studio-sidebar">
        <div className="workflow-sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              SPECIFICATIONS
            </span>
            <button
              onClick={() => loadWorkflowsList()}
              className="wb-btn wb-btn-outline"
              style={{ padding: '2px 4px', fontSize: '0.7rem', border: 'none' }}
              title="Refresh workflows"
            >
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          <button
            onClick={() => {
              setIsCreatingNew(true);
              setSelectedWorkflowId(null);
            }}
            className="wb-btn wb-btn-primary"
            style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center' }}
          >
            <Plus size={12} fill="#07090e" /> New Specification
          </button>
        </div>

        <div className="workflow-sidebar-list">
          {loading && workflows.length === 0 ? (
            <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }}>
              Loading specifications...
            </div>
          ) : workflows.length === 0 ? (
            <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }}>
              No workflow specifications found. Create a draft to get started.
            </div>
          ) : (
            workflows.map((wf) => {
              const isSelected = wf.id === selectedWorkflowId && !isCreatingNew;
              return (
                <div
                  key={wf.id}
                  className={`workflow-item-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedWorkflowId(wf.id);
                    setIsCreatingNew(false);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span className="workflow-card-name">{wf.name}</span>
                    <span
                      className={`workflow-status-badge ${
                        wf.status === 'approved' ? 'status-approved' : 'status-draft'
                      }`}
                    >
                      v{wf.version} · {wf.status}
                    </span>
                  </div>
                  <p className="workflow-card-desc">{wf.description}</p>
                  <div className="workflow-card-time">
                    <Clock size={10} />
                    <span>Updated {new Date(wf.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Panel */}
      <main className="workflow-studio-main">
        {/* Global error banner */}
        {errorMessage && (
          <div className="workflow-banner error-banner">
            <AlertCircle size={14} color="var(--error)" />
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600 }}>API Warning: </span>
              <span>{errorMessage}</span>
            </div>
            {backendPending && (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Waiting for backend endpoints
              </span>
            )}
          </div>
        )}

        {/* Success toast */}
        {saveSuccessMsg && (
          <div className="workflow-banner success-banner">
            <CheckCircle2 size={14} color="var(--success)" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Mode A: Create New Workflow Draft */}
        {isCreatingNew ? (
          <div className="workflow-editor-container">
            <div className="workflow-header-section">
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Define Intended Agent Behavior
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Provide a natural-language description of the expected workflow. HoneyBee's inference
                  engine will structure the specification and surface clarification questions.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateDraft} className="workflow-draft-form">
              <div className="form-group">
                <label className="form-label">Specification Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Safe Refund Orchestration"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Natural Language Workflow Description
                </label>
                <textarea
                  className="form-textarea"
                  rows={6}
                  placeholder="Describe what the agent should accomplish, mandatory ordering constraints (e.g. check fraud flags before issuing refunds), safety boundaries, acceptable fallback behavior, and user assumptions..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  required
                />
                <span className="form-help-text">
                  Be explicit about invariants and sensitive side-effects. The engine will extract
                  required outcomes and forbidden behaviors automatically.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
                <button
                  type="submit"
                  disabled={actionLoading || !newTitle.trim() || !newDescription.trim()}
                  className="wb-btn wb-btn-primary"
                  style={{ padding: '6px 14px' }}
                >
                  <Sparkles size={13} fill="#07090e" />
                  {actionLoading ? 'Analyzing & Creating Draft...' : 'Generate Workflow Draft'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNew(false);
                    if (workflows.length > 0) setSelectedWorkflowId(workflows[0].id);
                  }}
                  className="wb-btn wb-btn-outline"
                  style={{ padding: '6px 14px' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : activeWorkflow ? (
          /* Mode B: Inspect & Edit Selected Workflow */
          <div className="workflow-editor-container">
            {/* Top Identity & Action Bar */}
            <div className="workflow-header-section">
              <div className="workflow-title-block">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {activeWorkflow.name}
                  </h2>
                  <span
                    className={`workflow-status-badge ${
                      activeWorkflow.status === 'approved' ? 'status-approved' : 'status-draft'
                    }`}
                  >
                    Version {activeWorkflow.version} · {activeWorkflow.status.toUpperCase()}
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {activeWorkflow.description}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {activeWorkflow.status !== 'approved' && (
                  <button
                    onClick={handleSaveDraftChanges}
                    disabled={actionLoading}
                    className="wb-btn wb-btn-secondary"
                  >
                    <FileText size={12} />
                    {actionLoading ? 'Saving...' : 'Save Draft Changes'}
                  </button>
                )}

                {activeWorkflow.status !== 'approved' ? (
                  <button
                    onClick={handleApproveWorkflow}
                    disabled={actionLoading}
                    className="wb-btn wb-btn-primary"
                    style={{ background: 'var(--success)', borderColor: 'var(--success-border)', color: '#07090e' }}
                  >
                    <CheckCircle2 size={13} fill="#07090e" />
                    {actionLoading ? 'Submitting Approval...' : 'Approve Specification'}
                  </button>
                ) : (
                  <div className="approved-lock-chip">
                    <Lock size={12} color="var(--success)" />
                    <span>Locked & Audited</span>
                  </div>
                )}
              </div>
            </div>

            {/* Provider status check */}
            {activeWorkflow.model_provider_status && (
              <div
                className={`provider-status-strip ${
                  activeWorkflow.model_provider_status.available ? 'provider-ok' : 'provider-err'
                }`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={12} />
                  <span>
                    Model Provider: {activeWorkflow.model_provider_status.provider}
                  </span>
                </div>
                {!activeWorkflow.model_provider_status.available && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--error)' }}>
                    <AlertTriangle size={12} />
                    <span>
                      {activeWorkflow.model_provider_status.error || 'Provider unavailable. Questions may be degraded.'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Historical Immutability Protection Notice */}
            {activeWorkflow.status === 'approved' && (
              <div className="immutable-alert-banner">
                <Info size={14} color="var(--accent)" />
                <div>
                  <strong>Approved Version Immutable:</strong> Version {activeWorkflow.version} was approved on{' '}
                  {activeWorkflow.approved_at ? new Date(activeWorkflow.approved_at).toLocaleString() : 'record'}.
                  Specifications cannot be silently modified after approval. To refine behavior, create a new draft
                  version.
                </div>
              </div>
            )}

            {/* Clarification Questions Interview Interface */}
            {activeWorkflow.clarification_questions.length > 0 && (
              <div className="interview-section">
                <div className="interview-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <HelpCircle size={14} color="var(--warning)" />
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      Clarification Interview ({activeWorkflow.clarification_questions.length} questions)
                    </span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Answer ambiguity questions to sharpen invariants before approval
                  </span>
                </div>

                <div className="interview-questions-list">
                  {activeWorkflow.clarification_questions.map((q: ClarificationQuestion, idx: number) => (
                    <div key={q.id} className="interview-question-card">
                      <div className="question-header">
                        <span className="question-number">Q{idx + 1}</span>
                        {q.category && (
                          <span className="question-category-tag">{q.category}</span>
                        )}
                        <span className="question-text">{q.question}</span>
                      </div>

                      {q.context && (
                        <p className="question-context-text">{q.context}</p>
                      )}

                      <div className="question-answer-box">
                        <input
                          type="text"
                          className="question-answer-input"
                          placeholder="Provide clarification answer or policy constraint..."
                          disabled={activeWorkflow.status === 'approved'}
                          value={interviewAnswers[q.id] || ''}
                          onChange={(e) =>
                            setInterviewAnswers({ ...interviewAnswers, [q.id]: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {activeWorkflow.status !== 'approved' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button
                      onClick={handleSubmitAnswers}
                      disabled={actionLoading}
                      className="wb-btn wb-btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                    >
                      <Send size={11} />
                      {actionLoading ? 'Refining...' : 'Submit Clarifications'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Structured Specification Editor (7 Mandatory Sections) */}
            <div className="specification-editor-wrap">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Structured Behavioral Specification
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  7 Required Behavioral Dimensions
                </span>
              </div>

              {editableSpec && (
                <div className="spec-sections-grid">
                  {specSections.map((sec) => {
                    const items = editableSpec[sec.key] || [];
                    const isLocked = activeWorkflow.status === 'approved';

                    return (
                      <div key={sec.key} className="spec-section-card">
                        <div className="spec-card-top">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: sec.color
                              }}
                            />
                            <span className="spec-card-title">{sec.title}</span>
                            <span className="spec-card-count">({items.length})</span>
                          </div>

                          {!isLocked && (
                            <button
                              onClick={() => handleAddSpecItem(sec.key)}
                              className="wb-btn wb-btn-outline"
                              style={{ padding: '1px 4px', fontSize: '0.68rem', border: 'none' }}
                              title="Add item"
                            >
                              <Plus size={11} /> Add
                            </button>
                          )}
                        </div>

                        <p className="spec-card-desc">{sec.description}</p>

                        <div className="spec-items-list">
                          {items.length === 0 ? (
                            <span className="spec-empty-text">No items defined</span>
                          ) : (
                            items.map((item, index) => (
                              <div key={index} className="spec-item-row">
                                <span className="spec-item-bullet">•</span>
                                {isLocked ? (
                                  <span className="spec-item-readonly">{item}</span>
                                ) : (
                                  <input
                                    type="text"
                                    className="spec-item-input"
                                    value={item}
                                    placeholder="Enter constraint or condition..."
                                    onChange={(e) =>
                                      handleUpdateSpecItem(sec.key, index, e.target.value)
                                    }
                                  />
                                )}
                                {!isLocked && (
                                  <button
                                    onClick={() => handleRemoveSpecItem(sec.key, index)}
                                    className="wb-btn wb-btn-outline delete-btn"
                                    title="Remove item"
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="workflow-empty-placeholder">
            <FileText size={32} color="var(--text-muted)" />
            <h3 style={{ marginTop: '0.75rem', fontSize: '0.95rem', fontWeight: 600 }}>
              No Specification Selected
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: 360, marginTop: '4px' }}>
              Select an existing specification from the sidebar or click "New Specification" to draft
              intended agent behavior with Gemma.
            </p>
            <button
              onClick={() => setIsCreatingNew(true)}
              className="wb-btn wb-btn-primary"
              style={{ marginTop: '1rem' }}
            >
              <Plus size={12} fill="#07090e" /> Create First Specification
            </button>
          </div>
        )}
      </main>
    </div>
  );
};
