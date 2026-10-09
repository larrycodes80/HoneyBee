# API_CONTRACT.md — TraceForge

**Purpose:** Shared contract for the four-person hackathon team. Frontend and backend developers should implement against this document so work can proceed in parallel.

**Base URL:** `http://localhost:8000`

**API prefix:** `/api`

**Format:** JSON. All timestamps are ISO-8601 UTC strings.

---

## 1. Contract Rules

1. Treat this document as the source of truth for endpoint paths, field names, and response shapes.
2. Frontend developers should use fixtures matching these shapes until the backend is available.
3. Backend developers should return these shapes even if the internal implementation differs.
4. Keep baseline runs immutable. A replay always creates a new run.
5. Do not return fabricated success states. Diff and assertion results must be computed from actual recorded events.
6. Use deterministic mock agent/tool behavior for the hackathon demo; a live LLM is optional and must not be a dependency for the core demo.
7. If a field must change, agree as a team and update this file before changing implementations.

## 2. Shared Types

### 2.1 Run

```json
{
  "id": "run_01",
  "status": "completed",
  "created_at": "2026-10-09T10:00:00Z",
  "baseline_run_id": null,
  "config": {
    "scenario": "refund_safety",
    "prompt": "Check fraud status before issuing a refund."
  },
  "summary": {
    "event_count": 6,
    "tool_call_count": 2,
    "error_count": 0
  }
}
```

Fields:
- `id`: string; unique run identifier.
- `status`: `running | completed | failed`.
- `created_at`: ISO-8601 UTC timestamp.
- `baseline_run_id`: string or `null`; set for replay runs.
- `config`: object containing the scenario and effective prompt/configuration.
- `summary`: object containing `event_count`, `tool_call_count`, and `error_count` (non-negative integers).

### 2.2 TraceEvent

```json
{
  "id": "evt_01",
  "run_id": "run_01",
  "sequence": 1,
  "type": "tool_call",
  "timestamp": "2026-10-09T10:00:01Z",
  "name": "fraud_check",
  "input": {
    "customer_id": "cust_demo_01"
  },
  "output": null,
  "metadata": {
    "source": "mock_agent"
  }
}
```

Fields:
- `id`: string; unique event identifier.
- `run_id`: string; owning run ID.
- `sequence`: integer starting at `1`, strictly increasing within a run.
- `type`: one of `agent_start | model_input | model_output | tool_call | tool_result | error | agent_end`.
- `timestamp`: ISO-8601 UTC timestamp.
- `name`: string; event or tool name, e.g. `fraud_check`, `issue_refund`, `model_output`.
- `input`: JSON object or `null`.
- `output`: JSON object, string, number, boolean, or `null`.
- `metadata`: JSON object; use `{}` when no metadata exists.

### 2.3 AssertionResult

```json
{
  "name": "fraud_check_before_refund",
  "passed": false,
  "message": "issue_refund occurred before fraud_check."
}
```

- `name`: stable assertion identifier.
- `passed`: boolean.
- `message`: human-readable result explanation.

### 2.4 DiffChange

```json
{
  "sequence": 3,
  "change_type": "changed",
  "baseline_event": {
    "id": "evt_03",
    "run_id": "run_01",
    "sequence": 3,
    "type": "tool_call",
    "timestamp": "2026-10-09T10:00:03Z",
    "name": "issue_refund",
    "input": {"customer_id": "cust_demo_01"},
    "output": null,
    "metadata": {}
  },
  "replay_event": {
    "id": "evt_13",
    "run_id": "run_02",
    "sequence": 3,
    "type": "tool_call",
    "timestamp": "2026-10-09T10:01:03Z",
    "name": "fraud_check",
    "input": {"customer_id": "cust_demo_01"},
    "output": null,
    "metadata": {}
  }
}
```

- `sequence`: aligned comparison position, starting at `1`.
- `change_type`: `added | removed | changed`.
- `baseline_event`: TraceEvent or `null`.
- `replay_event`: TraceEvent or `null`.

---

## 3. Endpoints

### 3.1 Health

`GET /health`

Response `200 OK`:

```json
{
  "status": "ok"
}
```

### 3.2 Create and execute a run

`POST /api/runs`

Request:

```json
{
  "scenario": "refund_safety",
  "prompt": "Check fraud status before issuing a refund."
}
```

Fields:
- `scenario`: string; for the hackathon, support `refund_safety`.
- `prompt`: string; optional override. If omitted, use the scenario's default prompt.

Response `201 Created`:

```json
{
  "run": {
    "id": "run_01",
    "status": "completed",
    "created_at": "2026-10-09T10:00:00Z",
    "baseline_run_id": null,
    "config": {
      "scenario": "refund_safety",
      "prompt": "Check fraud status before issuing a refund."
    },
    "summary": {
      "event_count": 6,
      "tool_call_count": 2,
      "error_count": 0
    }
  },
  "events": []
}
```

`events` contains the ordered TraceEvent array for the run. The example is abbreviated; return the actual recorded events.

### 3.3 List runs

`GET /api/runs`

Optional query parameters:
- `limit`: integer, default `50`, maximum `100`.
- `offset`: integer, default `0`.

Response `200 OK`:

```json
{
  "items": [
    {
      "id": "run_01",
      "status": "completed",
      "created_at": "2026-10-09T10:00:00Z",
      "baseline_run_id": null,
      "config": {
        "scenario": "refund_safety",
        "prompt": "Check fraud status before issuing a refund."
      },
      "summary": {
        "event_count": 6,
        "tool_call_count": 2,
        "error_count": 0
      }
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

Runs should be returned newest first.

### 3.4 Get a run and its trace

`GET /api/runs/{run_id}`

Response `200 OK`:

```json
{
  "run": {
    "id": "run_01",
    "status": "completed",
    "created_at": "2026-10-09T10:00:00Z",
    "baseline_run_id": null,
    "config": {
      "scenario": "refund_safety",
      "prompt": "Check fraud status before issuing a refund."
    },
    "summary": {
      "event_count": 6,
      "tool_call_count": 2,
      "error_count": 0
    }
  },
  "events": []
}
```

`events` must be sorted by `sequence` ascending.

### 3.5 Replay a run

`POST /api/runs/{run_id}/replay`

Request:

```json
{
  "prompt": "Always check fraud before issuing any refund.",
  "config_overrides": {}
}
```

Both request fields are optional, but at least one of `prompt` or `config_overrides` may be supplied. If neither is supplied, replay with the baseline configuration.

Response `201 Created`:

```json
{
  "run": {
    "id": "run_02",
    "status": "completed",
    "created_at": "2026-10-09T10:01:00Z",
    "baseline_run_id": "run_01",
    "config": {
      "scenario": "refund_safety",
      "prompt": "Always check fraud before issuing any refund."
    },
    "summary": {
      "event_count": 6,
      "tool_call_count": 2,
      "error_count": 0
    }
  },
  "events": []
}
```

Rules:
- The source run must remain unchanged.
- The replay run gets a new ID and `baseline_run_id` equal to the source run ID.
- Return the replay run and its actual recorded events.
- Re-execute the deterministic scenario using the new configuration.
- Never reuse a cached result for a tool call that does not match the replayed call's tool name and inputs.

### 3.6 Compare baseline and replay

`GET /api/runs/{baseline_run_id}/diff/{replay_run_id}`

Response `200 OK`:

```json
{
  "baseline_run_id": "run_01",
  "replay_run_id": "run_02",
  "first_divergence_sequence": 3,
  "changes": [
    {
      "sequence": 3,
      "change_type": "changed",
      "baseline_event": null,
      "replay_event": null
    }
  ],
  "summary": {
    "added": 1,
    "removed": 0,
    "changed": 1
  }
}
```

Rules:
- `first_divergence_sequence` is the earliest aligned position where event type, name, or normalized input/output differs; use `null` if traces are equivalent.
- `changes` contains only positions with meaningful differences.
- Use `added` when only a replay event exists at an aligned position; `removed` when only a baseline event exists; otherwise `changed`.
- Ignore event IDs and timestamps when comparing semantic equivalence.
- Compare events in sequence order. Keep the algorithm simple and deterministic for the hackathon.
- Backend must return actual event objects in `baseline_event` and `replay_event` where present.

### 3.7 Evaluate assertions

`GET /api/runs/{run_id}/assertions`

Response `200 OK`:

```json
{
  "run_id": "run_01",
  "results": [
    {
      "name": "fraud_check_before_refund",
      "passed": false,
      "message": "issue_refund occurred before fraud_check."
    }
  ]
}
```

Required initial assertion:
- `fraud_check_before_refund`: passes only if a `fraud_check` tool call occurs before any `issue_refund` tool call. If a refund is issued without a fraud check, it fails. If no refund is issued, report according to the implementation's documented scenario rule and keep that rule consistent.

Assertions must be evaluated from the actual event sequence, not hardcoded based on run ID or UI state.

---

## 4. Error Format

Return errors using this structure:

```json
{
  "error": {
    "code": "RUN_NOT_FOUND",
    "message": "Run 'run_missing' was not found."
  }
}
```

Use appropriate HTTP status codes:
- `400 Bad Request`: malformed or invalid request.
- `404 Not Found`: run does not exist.
- `422 Unprocessable Entity`: valid JSON but invalid field values.
- `500 Internal Server Error`: unexpected server failure.

Do not return internal stack traces to the frontend.

---

## 5. CORS and Local Development

- Backend should allow the frontend dev origin, normally `http://localhost:5173`.
- Backend base URL: `http://localhost:8000`.
- Frontend should read the API base URL from an environment variable such as `VITE_API_BASE_URL`, with `http://localhost:8000` as the local development default.
- Do not hardcode the backend URL throughout components; centralize it in one API client module.

---

## 6. Suggested Frontend API Client

Centralize API calls in a module such as `src/lib/api.ts`.

Suggested functions:
- `listRuns(params?)`
- `getRun(runId)`
- `createRun(payload)`
- `replayRun(runId, payload)`
- `getRunDiff(baselineRunId, replayRunId)`
- `getAssertions(runId)`

Suggested TypeScript unions:

```ts
export type RunStatus = "running" | "completed" | "failed";

export type TraceEventType =
  | "agent_start"
  | "model_input"
  | "model_output"
  | "tool_call"
  | "tool_result"
  | "error"
  | "agent_end";

export type ChangeType = "added" | "removed" | "changed";
```

---

## 7. Demo Scenario Contract

Use one deterministic scenario, `refund_safety`.

The mock agent should be able to produce two meaningful traces:
- **Unsafe baseline:** issues a refund before checking fraud, causing the assertion to fail.
- **Safe replay:** checks fraud before issuing a refund, causing the assertion to pass.

The behavior may be implemented as deterministic mock decisions based on the supplied prompt/configuration. Make the distinction visible in actual events and computed assertion results. Do not claim a real model changed its behavior if the demo is using a mock policy.

A successful end-to-end demo should:
1. Create and inspect an unsafe baseline run.
2. Show `fraud_check_before_refund` failing.
3. Replay with a corrected prompt/configuration.
4. Compare baseline and replay and show the first divergence.
5. Show the assertion passing on the safe replay.

---

## 8. Definition of Done

- [ ] All four developers use these shared schemas.
- [ ] Frontend can run on fixtures before backend integration.
- [ ] `POST /api/runs` returns a persisted run and ordered events.
- [ ] `GET /api/runs` and `GET /api/runs/{run_id}` work.
- [ ] Replay creates a new run and preserves the baseline.
- [ ] Diff reports semantic changes and first divergence.
- [ ] Assertions are computed from event order.
- [ ] The full demo works locally without requiring an external LLM API.
