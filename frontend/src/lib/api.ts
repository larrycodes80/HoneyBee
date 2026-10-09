import type {
  Run,
  TraceEvent,
  RunDetailResponse,
  ListRunsResponse,
  CreateRunPayload,
  ReplayRunPayload,
  AssertionResponse,
  DiffResponse,
  DiffChange,
  Workflow,
  CreateWorkflowDraftPayload,
  SubmitInterviewAnswersPayload,
  UpdateWorkflowDraftPayload,
} from '../types';
import { MOCK_RUNS, MOCK_EVENTS_BY_RUN } from '../fixtures/mockData';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export class ApiError extends Error {
  status: number;
  code: string;
  detail?: any;

  constructor(status: number, message: string, code: string = 'API_ERROR', detail?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

let forceFixtures = false;

export function isForcingFixtures(): boolean {
  if (typeof window !== 'undefined') {
    const stored =
      localStorage.getItem('honeybee_force_fixtures') ??
      localStorage.getItem('traceforge_force_fixtures');
    if (stored !== null) {
      return stored === 'true';
    }
  }
  return forceFixtures;
}

export function setForceFixtures(force: boolean): void {
  forceFixtures = force;
  if (typeof window !== 'undefined') {
    localStorage.setItem('honeybee_force_fixtures', force ? 'true' : 'false');
  }
}

export async function checkHealth(): Promise<{ isBackendLive: boolean }> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      return { isBackendLive: true };
    }
    return { isBackendLive: false };
  } catch {
    return { isBackendLive: false };
  }
}

/**
 * Enriches a trace event with Phase 4 metadata attributes:
 * - Detects outer-function SDK instrumentation vs internal developer-instrumented events.
 * - Detects backend redaction markers so redacted fields are not displayed as raw data.
 */
export function enrichTraceEvent(event: TraceEvent): TraceEvent {
  const isOuter =
    event.metadata?.source === 'sdk' ||
    event.metadata?.auto_instrumented === true ||
    event.metadata?.wrapper === true ||
    event.metadata?.scope === 'outer' ||
    event.type === 'agent_start' ||
    event.type === 'agent_end';

  const jsonStr = JSON.stringify(event);
  const isRedacted =
    jsonStr.includes('[REDACTED]') ||
    Boolean(event.metadata?.redacted) ||
    Boolean(event.metadata?.omitted);

  return {
    ...event,
    instrumentation_type: isOuter ? 'outer_sdk' : 'internal_instrumented',
    is_redacted: isRedacted,
  };
}

// In-memory fallback run store (only used when fixture mode is explicitly active)
let localRuns: Run[] = [...MOCK_RUNS];
let localEventsByRun: Record<string, TraceEvent[]> = { ...MOCK_EVENTS_BY_RUN };

/* =========================================================================
   Runs & Trace APIs
   ========================================================================= */

export async function listRuns(params?: { limit?: number; offset?: number }): Promise<ListRunsResponse> {
  const limit = params?.limit ?? 50;
  const offset = params?.offset ?? 0;

  if (!isForcingFixtures()) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/runs?limit=${limit}&offset=${offset}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const errorDetail = errJson?.error || {};
        throw new ApiError(
          res.status,
          errorDetail.message || `Failed to fetch runs (HTTP ${res.status})`,
          errorDetail.code || `HTTP_${res.status}`,
          errorDetail
        );
      }
      const data: ListRunsResponse = await res.json();
      return data;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(
        0,
        `Cannot connect to HoneyBee backend (${API_BASE_URL}). Ensure the backend server is running.`,
        'NETWORK_ERROR'
      );
    }
  }

  // Explicit fixture mode fallback
  const items = localRuns.slice(offset, offset + limit);
  return {
    items,
    total: localRuns.length,
    limit,
    offset,
  };
}

export async function getRun(runId: string): Promise<RunDetailResponse> {
  if (!isForcingFixtures()) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/runs/${runId}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const errorDetail = errJson?.error || {};
        throw new ApiError(
          res.status,
          errorDetail.message || `Run '${runId}' not found (HTTP ${res.status})`,
          errorDetail.code || 'RUN_NOT_FOUND',
          errorDetail
        );
      }
      const data: RunDetailResponse = await res.json();
      return {
        run: data.run,
        events: data.events.map(enrichTraceEvent),
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(
        0,
        `Cannot connect to HoneyBee backend (${API_BASE_URL}).`,
        'NETWORK_ERROR'
      );
    }
  }

  const run = localRuns.find((r) => r.id === runId);
  if (!run) {
    throw new ApiError(404, `Run '${runId}' not found`, 'RUN_NOT_FOUND');
  }
  const events = (localEventsByRun[runId] || []).map(enrichTraceEvent);
  return { run, events };
}

export async function createRun(payload: CreateRunPayload): Promise<RunDetailResponse> {
  if (!isForcingFixtures()) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const errorDetail = errJson?.error || {};
        throw new ApiError(
          res.status,
          errorDetail.message || `Run creation failed (HTTP ${res.status})`,
          errorDetail.code || 'CREATE_RUN_FAILED',
          errorDetail
        );
      }
      const data: RunDetailResponse = await res.json();
      return {
        run: data.run,
        events: data.events.map(enrichTraceEvent),
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(0, 'Failed to connect to backend.', 'NETWORK_ERROR');
    }
  }

  const runId = `run_${Date.now().toString(36)}`;
  const isSafe = Boolean(
    payload.prompt?.toLowerCase().includes('safe') ||
      payload.prompt?.toLowerCase().includes('fraud')
  );

  const newRun: Run = {
    id: runId,
    status: 'completed',
    created_at: new Date().toISOString(),
    baseline_run_id: null,
    config: {
      scenario: payload.scenario,
      prompt: payload.prompt || 'Default scenario prompt',
    },
    summary: {
      event_count: 6,
      tool_call_count: 2,
      error_count: 0,
    },
  };

  const rawEvents: TraceEvent[] = isSafe
    ? [
        {
          id: `evt_${Date.now()}_1`,
          run_id: runId,
          sequence: 1,
          type: 'agent_start',
          timestamp: new Date().toISOString(),
          name: 'agent_start',
          input: { scenario: payload.scenario, prompt: payload.prompt },
          output: null,
          metadata: { source: 'sdk', policy: 'safe' },
        },
        {
          id: `evt_${Date.now()}_2`,
          run_id: runId,
          sequence: 2,
          type: 'tool_call',
          timestamp: new Date().toISOString(),
          name: 'check_fraud',
          input: { customer_id: 'cust_01' },
          output: null,
          metadata: { source: 'mock_agent' },
        },
        {
          id: `evt_${Date.now()}_3`,
          run_id: runId,
          sequence: 3,
          type: 'tool_result',
          timestamp: new Date().toISOString(),
          name: 'check_fraud',
          input: null,
          output: { risk_level: 'LOW', cleared_for_refund: true },
          metadata: { source: 'mock_tool' },
        },
        {
          id: `evt_${Date.now()}_4`,
          run_id: runId,
          sequence: 4,
          type: 'tool_call',
          timestamp: new Date().toISOString(),
          name: 'issue_refund',
          input: { amount: 50.0, reason: 'Customer dispute' },
          output: null,
          metadata: { source: 'mock_agent' },
        },
        {
          id: `evt_${Date.now()}_5`,
          run_id: runId,
          sequence: 5,
          type: 'tool_result',
          timestamp: new Date().toISOString(),
          name: 'issue_refund',
          input: null,
          output: { status: 'DISBURSED', amount: 50.0 },
          metadata: { source: 'mock_tool' },
        },
        {
          id: `evt_${Date.now()}_6`,
          run_id: runId,
          sequence: 6,
          type: 'agent_end',
          timestamp: new Date().toISOString(),
          name: 'agent_end',
          input: null,
          output: { summary: 'Fraud check verified, refund issued.' },
          metadata: { source: 'sdk' },
        },
      ]
    : [
        {
          id: `evt_${Date.now()}_1`,
          run_id: runId,
          sequence: 1,
          type: 'agent_start',
          timestamp: new Date().toISOString(),
          name: 'agent_start',
          input: { scenario: payload.scenario, prompt: payload.prompt },
          output: null,
          metadata: { source: 'sdk', policy: 'unsafe' },
        },
        {
          id: `evt_${Date.now()}_2`,
          run_id: runId,
          sequence: 2,
          type: 'tool_call',
          timestamp: new Date().toISOString(),
          name: 'issue_refund',
          input: { amount: 50.0, reason: 'Customer dispute' },
          output: null,
          metadata: { source: 'mock_agent' },
        },
        {
          id: `evt_${Date.now()}_3`,
          run_id: runId,
          sequence: 3,
          type: 'tool_result',
          timestamp: new Date().toISOString(),
          name: 'issue_refund',
          input: null,
          output: { status: 'DISBURSED', amount: 50.0 },
          metadata: { source: 'mock_tool' },
        },
        {
          id: `evt_${Date.now()}_4`,
          run_id: runId,
          sequence: 4,
          type: 'tool_call',
          timestamp: new Date().toISOString(),
          name: 'check_fraud',
          input: { customer_id: 'cust_01' },
          output: null,
          metadata: { source: 'mock_agent' },
        },
        {
          id: `evt_${Date.now()}_5`,
          run_id: runId,
          sequence: 5,
          type: 'tool_result',
          timestamp: new Date().toISOString(),
          name: 'check_fraud',
          input: null,
          output: { risk_level: 'LOW', cleared_for_refund: true },
          metadata: { source: 'mock_tool' },
        },
        {
          id: `evt_${Date.now()}_6`,
          run_id: runId,
          sequence: 6,
          type: 'agent_end',
          timestamp: new Date().toISOString(),
          name: 'agent_end',
          input: null,
          output: { summary: 'Refund issued before fraud check.' },
          metadata: { source: 'sdk' },
        },
      ];

  const enriched = rawEvents.map(enrichTraceEvent);
  localRuns = [newRun, ...localRuns];
  localEventsByRun[runId] = enriched;

  return { run: newRun, events: enriched };
}

export async function replayRun(runId: string, payload: ReplayRunPayload): Promise<RunDetailResponse> {
  if (!isForcingFixtures()) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/runs/${runId}/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const errorDetail = errJson?.error || {};
        throw new ApiError(
          res.status,
          errorDetail.message || `Replay failed (HTTP ${res.status})`,
          errorDetail.code || 'REPLAY_FAILED',
          errorDetail
        );
      }
      const data: RunDetailResponse = await res.json();
      return {
        run: data.run,
        events: data.events.map(enrichTraceEvent),
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(0, 'Failed to connect to backend during replay.', 'NETWORK_ERROR');
    }
  }

  // Fallback replay
  const baseRun = localRuns.find((r) => r.id === runId);
  const effectivePrompt = payload.prompt || baseRun?.config.prompt || 'Always check fraud before refund.';

  const created = await createRun({
    scenario: baseRun?.config.scenario || 'refund_safety',
    prompt: effectivePrompt,
  });

  created.run.baseline_run_id = runId;
  return created;
}

export async function getRunDiff(baselineRunId: string, replayRunId: string): Promise<DiffResponse> {
  if (!isForcingFixtures()) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/runs/${baselineRunId}/diff/${replayRunId}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const errorDetail = errJson?.error || {};
        throw new ApiError(
          res.status,
          errorDetail.message || `Diff calculation failed (HTTP ${res.status})`,
          errorDetail.code || 'DIFF_FAILED',
          errorDetail
        );
      }
      return await res.json();
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(0, 'Failed to connect to backend for diff comparison.', 'NETWORK_ERROR');
    }
  }

  // Compute diff locally
  const baseRes = await getRun(baselineRunId);
  const replayRes = await getRun(replayRunId);

  const baseEvents = baseRes.events;
  const repEvents = replayRes.events;

  const maxLen = Math.max(baseEvents.length, repEvents.length);
  const changes: DiffChange[] = [];
  let firstDivergence: number | null = null;

  for (let i = 0; i < maxLen; i++) {
    const bEvt = baseEvents[i] || null;
    const rEvt = repEvents[i] || null;
    const seq = i + 1;

    if (!bEvt && rEvt) {
      changes.push({ sequence: seq, change_type: 'added', baseline_event: null, replay_event: rEvt });
      if (firstDivergence === null) firstDivergence = seq;
    } else if (bEvt && !rEvt) {
      changes.push({ sequence: seq, change_type: 'removed', baseline_event: bEvt, replay_event: null });
      if (firstDivergence === null) firstDivergence = seq;
    } else if (bEvt && rEvt) {
      if (bEvt.name !== rEvt.name || bEvt.type !== rEvt.type) {
        changes.push({ sequence: seq, change_type: 'changed', baseline_event: bEvt, replay_event: rEvt });
        if (firstDivergence === null) firstDivergence = seq;
      }
    }
  }

  return {
    baseline_run_id: baselineRunId,
    replay_run_id: replayRunId,
    first_divergence_sequence: firstDivergence,
    changes,
    summary: {
      added: changes.filter((c) => c.change_type === 'added').length,
      removed: changes.filter((c) => c.change_type === 'removed').length,
      changed: changes.filter((c) => c.change_type === 'changed').length,
    },
  };
}

export async function getAssertions(runId: string): Promise<AssertionResponse> {
  if (!isForcingFixtures()) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/runs/${runId}/assertions`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const errorDetail = errJson?.error || {};
        throw new ApiError(
          res.status,
          errorDetail.message || `Failed to fetch assertions (HTTP ${res.status})`,
          errorDetail.code || 'ASSERTIONS_FAILED',
          errorDetail
        );
      }
      return await res.json();
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(0, 'Failed to connect to backend for assertions.', 'NETWORK_ERROR');
    }
  }

  const { events } = await getRun(runId);
  const fraudIdx = events.findIndex((e) => e.name === 'fraud_check' || e.name === 'check_fraud');
  const refundIdx = events.findIndex((e) => e.name === 'issue_refund');

  const passed = fraudIdx !== -1 && (refundIdx === -1 || fraudIdx < refundIdx);

  return {
    run_id: runId,
    results: [
      {
        name: 'fraud_check_before_refund',
        passed,
        message: passed
          ? 'Passed: Fraud verification completed before issuing customer refund.'
          : 'Failed: issue_refund occurred before or without fraud_check verification.',
      },
    ],
  };
}

/* =========================================================================
   Phase 4: Workflow Specifications & Interview APIs
   ========================================================================= */

// In-memory store for client-side editing when explicitly working in offline/mock mode
let localWorkflows: Workflow[] = [
  {
    id: 'wf_refund_01',
    name: 'Customer Refund Safety Flow',
    description: 'Autonomous customer dispute refund agent with mandatory prior fraud verification and safety ceilings.',
    version: 1,
    status: 'approved',
    approved_at: '2026-10-09T10:00:00Z',
    created_at: '2026-10-09T09:30:00Z',
    updated_at: '2026-10-09T10:00:00Z',
    specification: {
      required_outcomes: [
        'Disburse approved refund amount to original payment method',
        'Send confirmation email and SMS receipt to customer on file',
        'Log transaction record in audit ledger'
      ],
      required_conditions: [
        'Order dispute filed within 30 days of purchase',
        'Customer identity and fraud risk score < 0.15'
      ],
      forbidden_actions: [
        'Do not issue any refund before fraud check returns approved status',
        'Do not exceed maximum single refund ceiling of $500 without manual manager override'
      ],
      safety_invariants: [
        'Refund amount must be strictly equal to or less than original order charge',
        'Customer bank account currency must match original order currency'
      ],
      acceptable_alternatives: [
        'Offer store credit with 10% bonus if card provider declines chargeback',
        'Queue for human agent review if fraud risk score is between 0.15 and 0.50'
      ],
      preferences: [
        'Prefer automated processing if fraud check is clear within 3 seconds',
        'Notify customer within 60 seconds of processing'
      ],
      unresolved_assumptions: [
        'Assumes external fraud detection API SLA is 99.9% uptime',
        'Assumes banking gateway supports instant settlement'
      ]
    },
    clarification_questions: [
      {
        id: 'q_01',
        category: 'Thresholds',
        question: 'What is the maximum refund amount permitted without manager authorization?',
        answer: '$500 USD'
      },
      {
        id: 'q_02',
        category: 'Edge Cases',
        question: 'How should the agent handle situations where the original payment card is expired?',
        answer: 'Fallback to issuing electronic store credit directly to customer account.'
      }
    ],
    model_provider_status: {
      available: true,
      provider: 'Gemma 2 9B (DigitalOcean Inference)'
    }
  }
];

export async function listWorkflows(): Promise<Workflow[]> {
  if (!isForcingFixtures()) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/workflows`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const errorDetail = errJson?.error || {};
        throw new ApiError(
          res.status,
          errorDetail.message || `Failed to fetch workflows (HTTP ${res.status})`,
          errorDetail.code || `HTTP_${res.status}`,
          errorDetail
        );
      }
      return await res.json();
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(
        0,
        `Cannot connect to HoneyBee backend (${API_BASE_URL}) to fetch workflows.`,
        'NETWORK_ERROR'
      );
    }
  }
  return [...localWorkflows];
}

export async function getWorkflow(id: string): Promise<Workflow> {
  if (!isForcingFixtures()) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/workflows/${id}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const errorDetail = errJson?.error || {};
        throw new ApiError(
          res.status,
          errorDetail.message || `Workflow '${id}' not found (HTTP ${res.status})`,
          errorDetail.code || 'WORKFLOW_NOT_FOUND',
          errorDetail
        );
      }
      return await res.json();
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(0, `Cannot connect to backend to fetch workflow '${id}'.`, 'NETWORK_ERROR');
    }
  }

  const found = localWorkflows.find((w) => w.id === id);
  if (!found) {
    throw new ApiError(404, `Workflow '${id}' was not found.`, 'WORKFLOW_NOT_FOUND');
  }
  return found;
}

export async function createWorkflowDraft(payload: CreateWorkflowDraftPayload): Promise<Workflow> {
  if (!isForcingFixtures()) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/workflows/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const errorDetail = errJson?.error || {};
        throw new ApiError(
          res.status,
          errorDetail.message || `Failed to create workflow draft (HTTP ${res.status})`,
          errorDetail.code || 'CREATE_DRAFT_FAILED',
          errorDetail
        );
      }
      return await res.json();
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(
        0,
        `Failed to connect to backend at ${API_BASE_URL}/api/workflows/draft. Backend implementation by Devs 1 & 2 may be pending.`,
        'NETWORK_ERROR'
      );
    }
  }

  // Fallback for fixture mode only
  const newWf: Workflow = {
    id: `wf_${Date.now().toString(36)}`,
    name: payload.name || 'Untitled Workflow',
    description: payload.description,
    version: 1,
    status: 'draft',
    approved_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    specification: {
      required_outcomes: ['Complete requested task cleanly', 'Return verified response'],
      required_conditions: ['Input requirements verified'],
      forbidden_actions: ['Do not execute side-effects without validation'],
      safety_invariants: ['Maintain data consistency across tools'],
      acceptable_alternatives: ['Fallback to safe degradation if service is slow'],
      preferences: ['Prefer low latency execution'],
      unresolved_assumptions: ['Assumes downstream tool availability']
    },
    clarification_questions: [
      {
        id: `q_${Date.now()}_1`,
        category: 'Scope',
        question: 'Are there any maximum timeout constraints for this workflow?',
        answer: ''
      }
    ],
    model_provider_status: {
      available: true,
      provider: 'Gemma 2 9B (Local Simulation)'
    }
  };

  localWorkflows = [newWf, ...localWorkflows];
  return newWf;
}

export async function submitInterviewAnswers(
  id: string,
  payload: SubmitInterviewAnswersPayload
): Promise<Workflow> {
  if (!isForcingFixtures()) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/workflows/${id}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const errorDetail = errJson?.error || {};
        throw new ApiError(
          res.status,
          errorDetail.message || `Failed to submit clarification answers (HTTP ${res.status})`,
          errorDetail.code || 'SUBMIT_ANSWERS_FAILED',
          errorDetail
        );
      }
      return await res.json();
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(0, `Cannot submit answers to backend for workflow '${id}'.`, 'NETWORK_ERROR');
    }
  }

  const found = localWorkflows.find((w) => w.id === id);
  if (!found) {
    throw new ApiError(404, `Workflow '${id}' was not found.`, 'WORKFLOW_NOT_FOUND');
  }

  // Update questions with answers
  payload.answers.forEach((ans) => {
    const q = found.clarification_questions.find((cq) => cq.id === ans.question_id);
    if (q) q.answer = ans.answer;
  });

  found.updated_at = new Date().toISOString();
  return { ...found };
}

export async function updateWorkflowDraft(
  id: string,
  payload: UpdateWorkflowDraftPayload
): Promise<Workflow> {
  if (!isForcingFixtures()) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/workflows/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const errorDetail = errJson?.error || {};
        throw new ApiError(
          res.status,
          errorDetail.message || `Failed to update workflow draft (HTTP ${res.status})`,
          errorDetail.code || 'UPDATE_DRAFT_FAILED',
          errorDetail
        );
      }
      return await res.json();
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(0, `Cannot update draft on backend for workflow '${id}'.`, 'NETWORK_ERROR');
    }
  }

  const idx = localWorkflows.findIndex((w) => w.id === id);
  if (idx === -1) {
    throw new ApiError(404, `Workflow '${id}' was not found.`, 'WORKFLOW_NOT_FOUND');
  }

  const current = localWorkflows[idx];
  const updated: Workflow = {
    ...current,
    name: payload.name ?? current.name,
    description: payload.description ?? current.description,
    specification: payload.specification
      ? { ...current.specification, ...payload.specification }
      : current.specification,
    updated_at: new Date().toISOString(),
  };

  localWorkflows[idx] = updated;
  return updated;
}

export async function approveWorkflow(id: string): Promise<Workflow> {
  if (!isForcingFixtures()) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/workflows/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const errorDetail = errJson?.error || {};
        throw new ApiError(
          res.status,
          errorDetail.message || `Workflow approval failed (HTTP ${res.status})`,
          errorDetail.code || 'APPROVAL_FAILED',
          errorDetail
        );
      }
      return await res.json();
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(
        0,
        `Cannot approve workflow '${id}'. Backend approval endpoint not reachable.`,
        'NETWORK_ERROR'
      );
    }
  }

  const idx = localWorkflows.findIndex((w) => w.id === id);
  if (idx === -1) {
    throw new ApiError(404, `Workflow '${id}' was not found.`, 'WORKFLOW_NOT_FOUND');
  }

  const current = localWorkflows[idx];
  const updated: Workflow = {
    ...current,
    status: 'approved',
    version: current.version,
    approved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  localWorkflows[idx] = updated;
  return updated;
}
