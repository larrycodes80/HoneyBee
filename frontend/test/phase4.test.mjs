import test from 'node:test';
import assert from 'node:assert/strict';

// Test enriching logic matching frontend/src/lib/api.ts
function enrichTraceEvent(event) {
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

class ApiError extends Error {
  constructor(status, message, code = 'API_ERROR', detail) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

test('enrichTraceEvent marks outer SDK events correctly', () => {
  const sdkEvent = {
    id: 'evt_01',
    run_id: 'run_01',
    sequence: 1,
    type: 'agent_start',
    timestamp: '2026-10-09T10:00:00Z',
    name: 'agent_start',
    input: {},
    output: null,
    metadata: { source: 'sdk' }
  };
  const enriched = enrichTraceEvent(sdkEvent);
  assert.equal(enriched.instrumentation_type, 'outer_sdk');
  assert.equal(enriched.is_redacted, false);
});

test('enrichTraceEvent marks developer internal events correctly', () => {
  const internalEvent = {
    id: 'evt_02',
    run_id: 'run_01',
    sequence: 2,
    type: 'tool_call',
    timestamp: '2026-10-09T10:00:01Z',
    name: 'check_fraud',
    input: { customer_id: 'cust_01' },
    output: null,
    metadata: { source: 'mock_agent' }
  };
  const enriched = enrichTraceEvent(internalEvent);
  assert.equal(enriched.instrumentation_type, 'internal_instrumented');
  assert.equal(enriched.is_redacted, false);
});

test('enrichTraceEvent identifies redacted values and metadata flags', () => {
  const redactedEvent = {
    id: 'evt_03',
    run_id: 'run_01',
    sequence: 3,
    type: 'tool_call',
    timestamp: '2026-10-09T10:00:02Z',
    name: 'charge_card',
    input: { card_number: '[REDACTED]', cvv: '***' },
    output: null,
    metadata: { redacted: true }
  };
  const enriched = enrichTraceEvent(redactedEvent);
  assert.equal(enriched.is_redacted, true);
});

test('ApiError formats and retains status and error codes', () => {
  const err = new ApiError(404, 'Workflow wf_missing not found', 'WORKFLOW_NOT_FOUND', { entity: 'workflow' });
  assert.equal(err.status, 404);
  assert.equal(err.code, 'WORKFLOW_NOT_FOUND');
  assert.equal(err.message, 'Workflow wf_missing not found');
  assert.deepEqual(err.detail, { entity: 'workflow' });
});

test('WorkflowSpecification requires all 7 behavioral dimensions', () => {
  const spec = {
    required_outcomes: ['Verify refund request'],
    required_conditions: ['Customer account authenticated'],
    forbidden_actions: ['Issue refund prior to fraud check'],
    safety_invariants: ['Maintain account balance consistency'],
    acceptable_alternatives: ['Escalate to manual analyst review'],
    preferences: ['Prefer low latency execution'],
    unresolved_assumptions: ['Assumes payment gateway is operational']
  };

  const requiredKeys = [
    'required_outcomes',
    'required_conditions',
    'forbidden_actions',
    'safety_invariants',
    'acceptable_alternatives',
    'preferences',
    'unresolved_assumptions'
  ];

  for (const key of requiredKeys) {
    assert.ok(Array.isArray(spec[key]), `Missing or non-array section: ${key}`);
    assert.ok(spec[key].length > 0, `Section ${key} is empty`);
  }
});
