export type RunStatus = 'running' | 'completed' | 'failed';

export type TraceEventType =
  | 'agent_start'
  | 'model_input'
  | 'model_output'
  | 'tool_call'
  | 'tool_result'
  | 'error'
  | 'agent_end';

export type ChangeType = 'added' | 'removed' | 'changed';

export interface RunConfig {
  scenario: string;
  prompt: string;
  agent_name?: string;
  workflow_id?: string;
  workflow_version?: number | string;
  [key: string]: any;
}

export interface RunSummary {
  event_count: number;
  tool_call_count: number;
  error_count: number;
}

export interface Run {
  id: string;
  status: RunStatus;
  created_at: string;
  baseline_run_id: string | null;
  expected_workflow?: string | null;
  config: RunConfig;
  summary: RunSummary;
  agent_name?: string;
  workflow_id?: string | null;
  workflow_version?: number | string | null;
}

export interface TraceEvent {
  id: string;
  run_id: string;
  sequence: number;
  type: TraceEventType;
  timestamp: string;
  name: string;
  input: Record<string, any> | null;
  output: Record<string, any> | string | number | boolean | null;
  metadata: Record<string, any>;
  is_redacted?: boolean;
  instrumentation_type?: 'outer_sdk' | 'internal_instrumented';
}

export interface RunDetailResponse {
  run: Run;
  events: TraceEvent[];
}

export interface ListRunsResponse {
  items: Run[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateRunPayload {
  scenario: string;
  prompt?: string;
  expected_workflow?: string;
}

export interface ReplayRunPayload {
  prompt?: string;
  expected_workflow?: string;
  config_overrides?: Record<string, any>;
}

export type EvaluationVerdict = 'PASS' | 'FAIL' | 'INCONCLUSIVE';
export type EvaluationStatus = 'passed' | 'failed' | 'needs_review' | 'error';

export interface EvaluationFinding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: 'safety_violation' | 'missing_outcome' | 'prerequisite_violation' | 'forbidden_action' | 'valid_alternative' | 'general';
  explanation: string;
  expected_behavior: string;
  observed_behavior: string;
  evidence_event_ids: string[];
  recommended_correction: string;
}

export interface SampleTraceItem {
  id: string;
  name: string;
  description: string;
  expected_workflow: string;
  scenario: string;
  event_count: number;
}

export interface AuditRequestPayload {
  expected_workflow?: string;
  run_id?: string;
  sample_trace_id?: string;
}

export interface EvaluateRunPayload {
  expected_workflow?: string;
}

export interface EvaluationResponse {
  id: string;
  run_id: string;
  created_at: string;
  verdict: EvaluationVerdict;
  status?: EvaluationStatus;
  summary?: string;
  expected_workflow: string;
  first_divergence_event_id?: string | null;
  expected_behavior: string;
  observed_behavior: string;
  evidence_event_ids: string[];
  reason: string;
  suggested_correction: string;
  limitations?: string | null;
  evaluator_type: string;
  findings?: EvaluationFinding[];
  provider_metadata?: Record<string, any> | null;
}

export interface AssertionResult {
  name: string;
  passed: boolean;
  message: string;
}

export interface AssertionResponse {
  run_id: string;
  results: AssertionResult[];
}

export interface DiffChange {
  sequence: number;
  change_type: ChangeType;
  baseline_event: TraceEvent | null;
  replay_event: TraceEvent | null;
}

export interface DiffResponse {
  baseline_run_id: string;
  replay_run_id: string;
  first_divergence_sequence: number | null;
  changes: DiffChange[];
  summary?: {
    added: number;
    removed: number;
    changed: number;
  };
}

/* =========================================================================
   Phase 4: Workflow Specifications & Interview Types
   ========================================================================= */

export type WorkflowStatus = 'draft' | 'in_interview' | 'approved' | 'rejected';

export interface WorkflowSpecification {
  required_outcomes: string[];
  required_conditions: string[];
  forbidden_actions: string[];
  safety_invariants: string[];
  acceptable_alternatives: string[];
  preferences: string[];
  unresolved_assumptions: string[];
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  context?: string;
  category?: string;
  answer?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  version: number;
  status: WorkflowStatus;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
  specification: WorkflowSpecification;
  clarification_questions: ClarificationQuestion[];
  model_provider_status?: {
    available: boolean;
    provider: string;
    error?: string;
  };
}

export interface CreateWorkflowDraftPayload {
  name: string;
  description: string;
}

export interface SubmitInterviewAnswersPayload {
  answers: Array<{ question_id: string; answer: string }>;
}

export interface UpdateWorkflowDraftPayload {
  name?: string;
  description?: string;
  specification?: Partial<WorkflowSpecification>;
}
