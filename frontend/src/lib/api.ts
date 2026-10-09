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
} from '../types';
import { MOCK_RUNS, MOCK_EVENTS_BY_RUN } from '../fixtures/mockData';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

let forceFixtures = false;

export function isForcingFixtures(): boolean {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('honeybee_force_fixtures') ?? localStorage.getItem('traceforge_force_fixtures');
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

// In-memory run store for fallback mock runs
let localRuns: Run[] = [...MOCK_RUNS];
let localEventsByRun: Record<string, TraceEvent[]> = { ...MOCK_EVENTS_BY_RUN };

export async function listRuns(params?: { limit?: number; offset?: number }): Promise<ListRunsResponse> {
  const limit = params?.limit ?? 50;
  const offset = params?.offset ?? 0;

  if (!isForcingFixtures()) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/runs?limit=${limit}&offset=${offset}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback to local mock data if backend unavailable
    }
  }

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
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
  }

  const run = localRuns.find((r) => r.id === runId);
  if (!run) {
    throw new Error(`Run '${runId}' not found`);
  }
  const events = localEventsByRun[runId] || [];
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
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
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

  const events: TraceEvent[] = isSafe
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
          metadata: { source: 'mock_agent', policy: 'safe' },
        },
        {
          id: `evt_${Date.now()}_2`,
          run_id: runId,
          sequence: 2,
          type: 'tool_call',
          timestamp: new Date().toISOString(),
          name: 'fraud_check',
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
          name: 'fraud_check',
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
          metadata: { source: 'mock_agent' },
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
          metadata: { source: 'mock_agent', policy: 'unsafe' },
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
          name: 'fraud_check',
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
          name: 'fraud_check',
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
          metadata: { source: 'mock_agent' },
        },
      ];

  localRuns = [newRun, ...localRuns];
  localEventsByRun[runId] = events;

  return { run: newRun, events };
}

export async function replayRun(runId: string, payload: ReplayRunPayload): Promise<RunDetailResponse> {
  if (!isForcingFixtures()) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/runs/${runId}/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
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
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
  }

  // Compute diff from events
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
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
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
